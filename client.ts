import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import * as child_process from "child_process";
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

    export function init(path: string) {
        var repo = new Common.Repo(path, true);
        if (!repo) {
            log.error("Repository initialization failed!");
        }
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
        }

        if (hard) {
            revertAllWorkingTreeChanges(repo);

            targetCommit.contents.forEach(v => {
                checkoutFileExtended(repo, targetCommit, v);
            });

            revertAllWorkingTreeChanges(repo);
        }
    }

    function commonRoot(repo: Common.Repo, a: Common.Commit, b: Common.Commit): {
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
                let hash = file.hash;
                let parentFile = parent.file(f);
                let parentHash = !!parentFile ? parentFile.hash : null;

                let obj = repo.fs.resolveObjectByHash(hash).asFile();
                let parentObj = !!parentHash ? repo.fs.resolveObjectByHash(parentHash).asFile() : null;
                let buf = obj.buffer();
                let parentBuf = !!parentObj ? parentObj.buffer() : null;

                var result: boolean = istextorbinary.isTextSync(f, buf);

                if (!result) {
                    blobs.put(f, file);
                    return;
                }

                var diff = Hulk.Diff.diff(parentBuf || new Buffer(''), buf);
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
    /*
    "merge",
    "dev",
    "* master <= dev"
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
            let newBuf = diff.apply(buf);
            fse.outputFileSync(v.key, newBuf);
        });
        aBlobs.iter().forEach(v => {
            let file = v.value;
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
}
export = Client;