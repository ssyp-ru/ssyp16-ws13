import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as http from "http";
import * as fs from "./fs";
import * as nfs from "fs";
import * as fse from 'fs-extra';
import {FSFunctions} from './fsFunctions';
import * as path from 'path';
import * as Logger from './log';
import * as Hulk from './hulk';
import * as Common from './common';
import * as Format from './format';
import * as glob from 'glob';
import * as Moment from 'moment';
let createHash = require('sha.js');
let istextorbinary = require('istextorbinary');

module Client {
    let log = new Logger.Logger();
    let fsf = new FSFunctions();

    class WorkingTreeStatus {
        modified: string[] = [];
        added: string[] = [];
        removed: string[] = [];
        modifiedStaged: string[] = [];
        addedStaged: string[] = [];
        removedStaged: string[] = [];

        constructor(public repo: Common.Repo) { }

        get anyNewChanges(): boolean {
            return this.modified.length > 0
                || this.added.length > 0
                || this.removed.length > 0;
        }

        get anyStagedChanges(): boolean {
            return this.modifiedStaged.length > 0
                || this.addedStaged.length > 0
                || this.removedStaged.length > 0;
        }

        get anyChanges(): boolean {
            return this.anyNewChanges || this.anyStagedChanges;
        }

        get allNewChanges(): string[] {
            return this.added.concat(this.removed).concat(this.modified);
        }

        get allStagedChanges(): string[] {
            return this.addedStaged.concat(this.removedStaged).concat(this.modifiedStaged);
        }

        get allChanges(): string[] {
            return this.allNewChanges.concat(this.allStagedChanges);
        }

        get allModified(): string[] {
            return this.modified.concat(this.modifiedStaged);
        }

        get allAdded(): string[] {
            return this.added.concat(this.addedStaged);
        }

        get allRemoved(): string[] {
            return this.removed.concat(this.removedStaged);
        }

        push(v: string, mode: number) {
            var isStaged = this.repo.staged.indexOf(v) >= 0;

            var arr: string[];
            switch (mode) {
                case 0:
                    arr = isStaged ? this.modifiedStaged : this.modified;
                    break;
                case 1:
                    arr = isStaged ? this.addedStaged : this.added;
                    break;
                case 2:
                    arr = isStaged ? this.removedStaged : this.removed;
                    break;
                default:
                    throw "Illegal state mode";
            }
            arr.push(v);
        }
    }

    export function resolveWhat(repo: Common.Repo, what: string): { commit: Common.Commit; ref: Common.Ref } {
        var commit = repo.commit(what);
        var ref = repo.ref<Common.Ref>(what);
        if (!commit && !ref) {
            let fsFile = path.join(repo.jerkPath, what);
            if (nfs.existsSync(fsFile)) {
                let refData = fse.readJsonSync(fsFile);
                if (!!refData) {
                    ref = new Common.Ref(refData[2], refData[1], repo, refData[3]);
                }
            }
            if (!ref) {
                ref = repo.createRef(what, true);
            }
        }
        if (!commit && !!ref) {
            commit = ref.commit;
        }
        return { commit: commit, ref: ref };
    }

    export function init(path: string): Common.Repo {
        return new Common.Repo(path, true);
    }

    export function status(repo: Common.Repo): WorkingTreeStatus {
        var commit = repo.head.commit;
        var ignore = ['.jerk', '.jerk/**/*'];
        var all = glob.sync('**/*',
            { dot: true, nodir: true, ignore: '{' + ignore.join() + '}' });

        var result = new WorkingTreeStatus(repo);

        if (!commit) all.forEach(v => result.push(v, 1));
        else {
            all.forEach(v => {
                var tf = commit.file(v);
                if (!tf) {
                    result.push(v, 1);
                    return;
                }

                let stat = fsf.lstat(v);
                if (!stat) {
                    log.warn(`file "${v}" died in vain...`);
                    return;
                }

                if (tf.time < stat.mtime.getTime()) {
                    result.push(v, 0);
                }
            });
            commit.contents.forEach(v => {
                let path = v.path;
                if (all.indexOf(path) < 0) {
                    result.push(path, 2);
                }
            });
        }

        result.repo.staged.forEach(v => {
            if (all.indexOf(v) < 0 && result.removedStaged.indexOf(v) < 0) {
                log.warn(`staged file "${v}" removed`);
                repo.unstage(v);
            }
        });

        return result;
    };

    export function checkoutFile(repo: Common.Repo, commit: Common.Commit = repo.head.commit, path: string) {
        if (!commit) {
            nfs.unlinkSync(path);
            repo.unstage(path);
            return;
        }

        let tf = commit.file(path);
        if (!tf) {
            nfs.unlinkSync(path);
            repo.unstage(path);
        } else {
            return checkoutFileExtended(repo, commit, tf);
        }
    }

    export function checkoutFileExtended(repo: Common.Repo, commit: Common.Commit = repo.head.commit, tf: Common.TreeFile) {
        let fo = repo.fs.resolveObjectByHash(tf.hash).asFile();

        var stat = fsf.lstat(tf.path);
        if (!!stat) {
            if (tf.time === stat.mtime.getTime()) {
                return;
            }
        }

        let dTime = new Date(tf.time);
        fse.outputFileSync(tf.path, fo.buffer());
        nfs.utimesSync(tf.path, dTime, dTime);
    }

    export function revertAllWorkingTreeChanges(repo: Common.Repo) {
        var commit = repo.head.commit;
        var res = status(repo);
        if (!res.anyChanges) {
            return;
        }

        res.allModified
            .forEach(v => {
                if (!commit) {
                    nfs.unlinkSync(v);
                    return;
                }

                var tf = commit.file(v);
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();

                fse.outputFileSync(v, fo.buffer());
                nfs.utimesSync(v, new Date(tf.time), new Date(tf.time));
                repo.unstage(v);
            });

        res.allAdded
            .forEach(v => {
                nfs.unlinkSync(v);
                repo.unstage(v);
            });

        res.allRemoved
            .forEach(v => {
                if (!commit) {
                    log.error('unexpected file removal without HEAD commit');
                    return;
                }

                var tf = commit.file(v);
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();
                fse.outputFileSync(v, fo.buffer());
                nfs.utimesSync(v, new Date(tf.time), new Date(tf.time));
            });


    }

    export function checkout(repo: Common.Repo, commit: Common.Commit, branch?: Common.Branch) {
        let head = repo.head;
        let oldCommit = head.commit;
        head.move(commit.id);
        if (!!branch) {
            repo.currentBranchName = branch.name;
        } else {
            repo.currentBranchName = null;
        }

        revertAllWorkingTreeChanges(repo);

        commit.contents.forEach(v => {
            checkoutFileExtended(repo, commit, v);
        });

        revertAllWorkingTreeChanges(repo);

        var unique = (arr) => {
            var m = new Map();
            for (var el of arr)
                m.set(el, true);
            var result = [];
            for (var k of m.keys())
                result.push(k);
            return result;
        }

        let uniqueOld = unique(oldCommit.contents.map(f => path.dirname(f.path)));
        let uniqueNew = unique(commit.contents.map(f => path.dirname(f.path)));

        uniqueOld.forEach(v => {
            if (uniqueNew.indexOf(v) < 0) {
                fse.deleteSync(v);
            }
        });
    }
    export function resetFirstMode(repo: Common.Repo,
        paths: string[], targetCommit: Common.Commit) {
        paths.forEach(v => {
            repo.unstage(v);
        });
    }
    export function resetSecondMode(repo: Common.Repo,
        soft: boolean = false, mixed: boolean = true, hard: boolean = false, merge: boolean = false,
        targetCommit: Common.Commit
    ) {
        if (merge) {
            log.error('Merge mode not implemented...');
            return;
        }

        // log.info(targetCommit.id);
        if (targetCommit.id != repo.head.head) {
            // log.info(repo.head.head);
            repo.writeCommitData(repo.head, 'ORIG_HEAD');
            repo.currentBranch.move(targetCommit.id);
            repo.head.move(targetCommit.id);
            repo.saveConfig();
        }

        if (!soft) {
            repo.staged = [];
            repo.setMerging(null, null);
        }

        if (hard) {
            revertAllWorkingTreeChanges(repo);

            targetCommit.contents.forEach(v => {
                checkoutFileExtended(repo, targetCommit, v);
            });

            revertAllWorkingTreeChanges(repo);
        }
    }

    export function commonRoot(repo: Common.Repo, a: Common.Commit, b: Common.Commit): {
        root: Common.Commit;
        aBranch: Common.Commit[];
        bBranch: Common.Commit[];
    } {
        let aParents = new Common.StringMap<Common.Commit>()
        let bParents = new Common.StringMap<Common.Commit>();
        let aFlow: string[] = [];
        let bFlow: string[] = [];
        var parent = a;
        while (!!parent) {
            let id = parent.id;
            aParents.put(id, parent);
            aFlow.push(id);
            parent = parent.parent;
        }
        parent = b;
        while (!!parent) {
            let id = parent.id;
            bParents.put(id, parent);
            bFlow.push(id);
            if (aFlow.indexOf(id) >= 0) {
                break;
            }
            parent = parent.parent;
        }
        if (!parent) return null;
        bFlow.reverse();
        let aBranch: Common.Commit[] = [];
        let bBranch: Common.Commit[] = [];
        for (var i = 0; i < aFlow.length; i++) {
            var element = aFlow[i];
            aBranch.push(aParents.get(element));
            if (element === parent.id) break;
        }
        bFlow.forEach(v => bBranch.push(bParents.get(v)));
        aBranch.reverse();

        aBranch.shift();
        bBranch.shift();

        return {
            root: parent,
            aBranch: aBranch,
            bBranch: bBranch
        };
    }

    function generateBranchDiffs(repo: Common.Repo,
        commits: Common.Commit[], diffs: Common.StringMap<Hulk.Diff>,
        blobs: Common.StringMap<Common.TreeFile>): boolean {
        var ok = true;
        commits.forEach(c => {
            if (!ok) return;
            let parent = c.parent;

            c.changed.forEach(f => {
                if (!ok) return;

                let file = c.file(f);
                let hash = !!file ? file.hash : null;
                let parentFile = parent.file(f);
                let parentHash = !!parentFile ? parentFile.hash : null;

                let obj = !!hash ? repo.fs.resolveObjectByHash(hash).asFile() : null;
                let parentObj = !!parentHash ? repo.fs.resolveObjectByHash(parentHash).asFile() : null;
                let buf = !!obj ? obj.buffer() : null;
                let parentBuf = !!parentObj ? parentObj.buffer() : null;

                var result: boolean = !!buf ? istextorbinary.isTextSync(f, buf) :
                    !!parentBuf ? istextorbinary.isTextSync(f, parentBuf) : null;

                if (!result) {
                    blobs.put(f, file);
                    return;
                }

                var diff = Hulk.Diff.diff(parentBuf || new Buffer(''), buf || new Buffer(''));
                let oldDiff = diffs.get(f);
                if (!oldDiff) return diffs.put(f, diff);

                let merged = Hulk.merge(oldDiff, diff);
                if (!(merged instanceof Hulk.Diff)) {
                    ok = false;
                    return log.error('Subsequent commit merge failed!');
                }
                diffs.put(f, merged as Hulk.Diff);
            });
        });

        return ok;
    }

    /*
    1. Find common root
    2. Diff both branches
    3. Merge diffs
    4. Checkout common root
    5. Apply diff
    6. Stage
    7. If merge conflict => abort
    7. Commit
    */
    export function merge(repo: Common.Repo, target: Common.Commit, message: string,
        authorName: string = null, authorEMail: string = null): Common.Commit {
        let head = repo.head.commit;

        let root = commonRoot(repo, head, target);
        // log.info(JSON.stringify(root));
        if (!root) throw "Two branches do not have any common commits";

        var ts: number = new Date().getTime();
        var hash: string = createHash('sha256').update(message || ts, 'utf8').digest('hex');

        let aDiffs = new Common.StringMap<Hulk.Diff>();
        let bDiffs = new Common.StringMap<Hulk.Diff>();
        let aBlobs = new Common.StringMap<Common.TreeFile>();
        let bBlobs = new Common.StringMap<Common.TreeFile>();

        if (!generateBranchDiffs(repo, root.aBranch, aDiffs, aBlobs)) throw "Failed to calculate base branch diff";
        // log.info(JSON.stringify(aDiffs.data), JSON.stringify(aBlobs.data));
        if (!generateBranchDiffs(repo, root.bBranch, bDiffs, bBlobs)) throw "Failed to calculate merging branch diff";
        // log.info(JSON.stringify(bDiffs.data), JSON.stringify(bBlobs.data));

        var conflicted = false;
        bDiffs.iter().forEach(v => {
            let aDiff = aDiffs.get(v.key);
            if (!aDiff) return aDiffs.put(v.key, v.value);
            let merged = Hulk.merge(aDiff, v.value);
            if (merged.conflicted) {
                log.error(`Merge conflicts found in file [${v.key}]`);
                conflicted = true;
                return;
            }
            aDiffs.put(v.key, merged);
        });
        bBlobs.iter().forEach(v => {
            let aBlob = aBlobs.get(v.key);
            if (!aBlob) return aBlobs.put(v.key, v.value);
            if (v.value.hash != aBlob.hash) {
                log.info(`Blob[${v.key}] merge failed!`);
                conflicted = true;
                return aBlobs.put(v.key, v.value);
            }
        });

        // log.info(JSON.stringify(failures.data));
        // log.info(JSON.stringify(aDiffs.data));

        Client.checkout(repo, root.root, repo.currentBranch);

        aDiffs.iter().forEach(v => {
            let diff = v.value;
            var buf: Buffer;
            if (nfs.existsSync(v.key)) {
                buf = nfs.readFileSync(v.key);
            } else {
                buf = new Buffer('');
            }
            // log.info(JSON.stringify(diff), buf.toString());
            let newBuf = diff.apply(buf);
            fse.outputFileSync(v.key, newBuf);
        });
        aBlobs.iter().forEach(v => {
            let file = v.value;
            if (!file) {
                fse.deleteSync(v.key);
                return;
            }
            let fso = repo.fs.resolveObjectByHash(file.hash).asFile();
            fse.outputFileSync(v.key, fso.buffer());
        });

        let st = status(repo);

        st.allNewChanges.forEach(v => repo.stage(v));

        repo.setMerging(head.id, repo.currentBranchName);

        if (conflicted) {
            return null;
        }

        let commit = repo.createCommit(head, message, authorName, authorEMail, false, null);

        repo.setMerging(null, null);

        return commit;
    }

    export function parseRemoteAddress(url: string): { host: string, port: number } {
        var parts = url.split(':');
        var host = parts[0];
        var port = 19246;
        if (parts.length > 1) {
            port = parseInt(parts[1]);
        }
        return { host: host, port: port };
    }

    export function fetchConfig(url: string, callback: Function) {
        var cfg = '';
        let remote = parseRemoteAddress(url);
        let req = http.request(
            {
                host: remote.host,
                port: remote.port + 2,
                path: '/config'
            },
            (res) => {
                if (res.statusCode !== 200) {
                    callback(null);
                    return;
                }
                res.setEncoding('utf8');
                res
                    .on('data', (chunk: string) => {
                        cfg += chunk;
                    })
                    .on('end', () => {
                        callback(cfg);
                    });
            })
            .on('error', (e) => {
                log.error(e);
                callback(null);
            });
        req.end();
    }

    let rsyncPercentage = /\s+(\d+)%/;
    export function rsyncOutputProgressUpdate(stdout: any): number {
        let s = stdout.toString().trim().split('\r').pop();
        if (rsyncPercentage.test(s)) {
            let perc = parseInt(rsyncPercentage.exec(s)[1]);
            return perc / 100;
        }
        return -1;
    }

    function rsyncProgressCallback(cp: child_process.ChildProcess,
        progressCallback?: (val: number) => void) {

        cp.stdout.on('data', (stdout) => {
            let val = rsyncOutputProgressUpdate(stdout);
            if (!!progressCallback) progressCallback(val);
        });
    }

    function cloneOnConfigFetched(cfg: string) {
        var json: string = nfs.readFileSync(cfg, 'utf8');

        let config: {
            defaultBranchName: string,
            refs: Object,
            commits: Object,
        } = JSON.parse(json);

        let nconfig = {
            defaultBranchName: config.defaultBranchName,
            currentBranchName: config.defaultBranchName,
            refs: config.refs,
            commits: config.commits,
            merging: null,
            staged: []
        };

        var json = JSON.stringify(nconfig);
        fse.outputFileSync(cfg, json);

        let repo = new Common.Repo(process.cwd());
        repo.createRef('HEAD');
        repo.head.move(repo.defaultBranch.head);
        repo.saveConfig();
    }

    function cloneOnObjectsFetched() {
        let repo = new Common.Repo(process.cwd());
        let commit = repo.head.commit;
        if (!!commit) Client.checkout(repo, commit, repo.currentBranch);
    }

    export function clone(url: string,
        progressCallback?: (val: number) => void,
        configFetchedCallback?: () => void,
        finishCallback?: () => void) {

        let remote = parseRemoteAddress(url);
        let req = http.get(
            {
                host: remote.host,
                port: remote.port + 2,
                path: '/config'
            },
            (res) => {
                let cfg = path.join('.jerk', 'config');
                fse.ensureFileSync(cfg);

                let cp = child_process.spawn("rsync",
                    [`rsync://${remote.host}:${remote.port}/jerk/objects`, '--info=progress2',
                        '-E', '-hhh', '-r', '.jerk']);
                rsyncProgressCallback(cp, progressCallback);
                let cpInterval = setInterval(() => {
                    if (!!progressCallback) progressCallback(-1);
                }, 100);

                res
                    .on('data', (chunk: Uint8Array) => {
                        let buf = new Buffer(chunk);
                        nfs.appendFileSync(cfg, buf);
                    })
                    .on('end', () => {
                        cloneOnConfigFetched(cfg);
                        if (!!configFetchedCallback) configFetchedCallback();

                        cp.on('exit', () => {
                            if (!!progressCallback) progressCallback(1);
                            clearInterval(cpInterval);
                            cloneOnObjectsFetched();
                            if (!!finishCallback) finishCallback();
                        });
                    });
            })
            .on('error', (e) => {
                log.error(e);
            });
    }

    export function fetch(repo: Common.Repo,
        url: string,
        progressCallback?: (val: number) => void,
        finishCallback?: (success: boolean) => void) {

        let remote = parseRemoteAddress(url);

        fetchConfig(url, (cfg) => {
            if (!cfg) return;

            let cp = child_process.spawn("rsync",
                [`rsync://${remote.host}:${remote.port}/jerk/objects`, '--info=progress2',
                    '-E', '-hhh', '-r', '-u', '.jerk']);
            cp.stdout.on('data', (stdout) => {
                let val = rsyncOutputProgressUpdate(stdout);
                if (!!progressCallback) progressCallback(val);
            });
            let cpInterval = setInterval(() => {
                if (!!progressCallback) progressCallback(-1);
            }, 100);

            Common.iterateStringKeyObject<string[]>(cfg.refs).forEach(v => {
                let ref = repo.ref(v.key);
                let val = v.value;
                if (ref) {
                    ref.name = val[1];
                    ref.head = val[2];
                    ref.time = parseInt(val[3]);
                } else {
                    repo.addRef(new Common.Ref(val[2], val[1], repo, parseInt(val[3])));
                }
            });

            Common.iterateStringKeyObject<string[]>(cfg.commits).forEach(v => {
                let commit = repo.commit(v.key);
                let val = v.value;

                let contents = new Common.StringMap<Common.TreeFile>();
                Common.iterateStringKeyObject(JSON.parse(val[7])['data']).forEach(v => {
                    let path: string = v.value['path'];
                    contents.put(path, new Common.TreeFile(
                        path,
                        v.value['time'],
                        v.value['hash']));
                });

                let mergeOfObj: string[] = JSON.parse(val[8]);
                var mergeOf: Common.MergeOf = null;
                if (!!mergeOfObj) {
                    mergeOf = new Common.MergeOf(mergeOfObj[1], repo, mergeOfObj[2]);
                }

                if (commit) {
                    commit.message = val[2];
                    commit.authorName = val[3];
                    commit.authorEMail = val[4];
                    commit.parentId = val[5];
                    commit.time = parseInt(val[6]);
                    commit.mergeOf = mergeOf;
                    commit.changed = JSON.parse(val[9]);
                } else {
                    commit = new Common.Commit(val[1], repo,
                        val[5], val[2], val[3], val[4], parseInt(val[6]), contents,
                        mergeOf, JSON.parse(val[9]));
                    repo.commitsDB.put(commit.id, commit);
                }
            });

            repo.writeCommitData(repo.ref<Common.Ref>(repo.currentBranchName), 'FETCH_HEAD');

            cp.on('exit', (code: number, signal: string) => {
                if (!!progressCallback) progressCallback(1);
                clearInterval(cpInterval);
                if (!!finishCallback) finishCallback(code === 0);
            });
        });
    }

    function pushable(repo: Common.Repo, cfg: any, onFail?: () => void): {
        remoteRefs: string[];
        changedRefs: string[];
        remoteCommits: string[]
    } {
        var pushable = true;
        let refs = [];
        let changedRefs = [];
        let commits = [];
        Common.iterateStringKeyObject<string[]>(cfg.refs).forEach(v => {
            if (!pushable) return;
            if (v.key === 'HEAD') return;
            let ref = repo.ref(v.key);
            let val = v.value;
            if (!ref) {
                pushable = false;
                return;
            }
            refs.push(v.key);
            if (ref.head !== val[2]) changedRefs.push(v.key);
            if (ref.time !== parseInt(val[3])) changedRefs.push(v.key);
        });
        if (!pushable) {
            if (!!onFail) onFail();
            return null;
        }
        Common.iterateStringKeyObject<string[]>(cfg.commits).forEach(v => {
            if (!pushable) return;
            let commit = repo.commit(v.key);
            let val = v.value;
            if (!commit) {
                pushable = false;
                return;
            }
            commits.push(v.key);
            // ["Commit", this.id, this.message, this.authorName, this.authorEMail,
            // this.parentId, this.time.toString(), JSON.stringify(this._contents),
            // this._mergeOf, JSON.stringify(this.changed)]
            if (commit.id !== val[1]) pushable = false;
            if (commit.message !== val[2]) pushable = false;
            if (commit.authorName !== val[3]) pushable = false;
            if (commit.authorEMail !== val[4]) pushable = false;
            if (commit.parentId !== val[5]) pushable = false;
            if (commit.time !== parseInt(val[6])) pushable = false;
            let data = commit.data();
            if (data[7] !== val[7]) pushable = false;
            if (data[8] !== val[8]) pushable = false;
            if (data[9] !== val[9]) pushable = false;
        });
        if (!pushable) {
            if (!!onFail) onFail();
            return null;
        }
        return { remoteRefs: refs, changedRefs: changedRefs, remoteCommits: commits };
    }

    export function pushJSON(remote: { host: string; port: number }, json: string, callback: Function) {
        var cfg = '';
        let req = http.request(
            {
                host: remote.host,
                port: remote.port + 2,
                path: '/push',
                method: 'POST'
            },
            (res) => {
                if (res.statusCode !== 200) {
                    callback(null);
                    return;
                }
                res.setEncoding('utf8');
                res
                    .on('data', (chunk: string) => {
                        cfg += chunk;
                    })
                    .on('end', () => {
                        callback(cfg);
                    });
            })
            .on('error', (e) => {
                log.error(e);
                callback(null);
            });
        req.write(json);
        req.end();
    }

    function uploadObjectsRsync(remote: { host: string; port: number },
        progressCallback: (val: number) => void, callback: (success: boolean) => void) {
        let cp = child_process.spawn("rsync",
            [path.join('.jerk', 'objects'), '--info=progress2', '-E', '-hhh',
                '-r', '-u', '--delete-delay', `rsync://${remote.host}:${remote.port}/jerk`]);
        rsyncProgressCallback(cp, progressCallback);
        let cpInterval = setInterval(() => {
            if (!!progressCallback) progressCallback(-1);
        }, 100);

        cp.on('exit', (code: number, signal: string) => {
            if (!!progressCallback) progressCallback(1);
            clearInterval(cpInterval);
            if (code === 0) return callback(true);
            return callback(false);
        });
    }

    function uploadObjects(remote: { host: string; port: number }, mode: string,
        progressCallback: (val: number) => void, callback: (success: boolean) => void) {
        if (mode !== 'rsync') throw "Unknown mode type";
        uploadObjectsRsync(remote, progressCallback, callback);

    }

    export enum PushSuccessState {
        UP_TO_DATE, CONNECTION_FAILED, OK, FAIL
    }

    export function push(repo: Common.Repo, url: string, mode: string,
        onFail?: () => void, progressCallback?: (val: number) => void,
        callback?: (success: PushSuccessState) => void) {
        fetchConfig(url, (cfg) => {
            if (!cfg) {
                if (!!callback) callback(PushSuccessState.CONNECTION_FAILED);
                return;
            }
            cfg = JSON.parse(cfg);
            let data = pushable(repo, cfg, onFail);
            if (!data) return;

            let newCommits = repo.commits
                .map(x => (data.remoteCommits.indexOf(x.id) < 0) ? x : null)
                .filter(x => !!x)
                .map(x => x.data());
            let newRefs = repo.refs()
                .map(x => (data.remoteRefs.indexOf(x.name) < 0 && x.name !== 'HEAD') ? x : null)
                .filter(x => !!x)
                .map(x => x.data());
            let changedRefs = data.changedRefs
                .map(x => repo.ref(x).data());

            if (newCommits.length === 0 && newRefs.length === 0 && changedRefs.length === 0) {
                if (!!callback) callback(PushSuccessState.UP_TO_DATE);
                return;
            }

            let refs = {};
            let commits = {};
            newRefs.concat(changedRefs).forEach(x => refs[x[1]] = x);
            newCommits.forEach(x => commits[x[1]] = x);

            let json = {
                refs: refs,
                commits: commits,
                revision: cfg.revision
            }

            let remote = parseRemoteAddress(url);

            let jsonPush = JSON.stringify(json);

            pushJSON(remote, jsonPush, (res) => {
                if (!res) {
                    if (!!callback) callback(PushSuccessState.CONNECTION_FAILED);
                    return;
                }
                if (res === 'OK') {
                    uploadObjects(remote, mode, progressCallback, (success) => {
                        if (!success) {
                            if (!!callback) callback(PushSuccessState.FAIL);
                            return;
                        }
                        if (!!callback) callback(PushSuccessState.OK);
                    });
                    return;
                }
                log.error('remote:', res);
                if (!!callback) callback(PushSuccessState.FAIL);
            });
        });
    }
}
export = Client;