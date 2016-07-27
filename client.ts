import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as fs from "fs";
import * as fse from 'fs-extra';
import * as path from 'path';
import * as Logger from './log';
import * as Common from './common';
import * as Format from './format';
import * as glob from 'glob';
import * as Moment from 'moment';

module Client {
    let log = new Logger.Logger();

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
        var commit = repo.lastCommit;
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

                try {
                    var stat = fs.lstatSync(v);

                    if (tf.time < stat.mtime.getTime()) {
                        result.push(v, 0);
                    }
                } catch (e) {
                    log.warn(`file "${v}" died in vain...`);
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
            if (all.indexOf(v) < 0) {
                log.warn(`staged file "${v}" removed`);
                repo.unstage(v);
            }
        });

        return result;
    };

    export function checkoutFile(repo: Common.Repo, commit: Common.Commit = repo.lastCommit, path: string) {
        if (!commit) {
            fs.unlinkSync(path);
            repo.unstage(path);
            return;
        }

        let tf = commit.file(path);
        if (!tf) {
            fs.unlinkSync(path);
            repo.unstage(path);
        } else {
            return checkoutFileExtended(repo, commit, tf);
        }
    }

    export function checkoutFileExtended(repo: Common.Repo, commit: Common.Commit = repo.lastCommit, tf: Common.TreeFile) {
        let fo = repo.fs.resolveObjectByHash(tf.hash).asFile();

        var stat: fs.Stats;
        try {
            stat = fs.lstatSync(tf.path);
            if (!!stat) {
                if (tf.time === stat.mtime.getTime()) {
                    return;
                }
            }
        } catch (e) {
        }

        let dTime = new Date(tf.time);
        fse.outputFileSync(tf.path, fo.buffer());
        fs.utimesSync(tf.path, dTime, dTime);
    }

    export function revertAllWorkingTreeChanges(repo: Common.Repo) {
        var commit = repo.lastCommit;
        var res = status(repo);
        if (!res.anyChanges) {
            return;
        }

        res.modified
            .concat(res.modifiedStaged)
            .forEach(v => {
                if (!commit) {
                    fs.unlinkSync(v);
                    return;
                }

                var tf = commit.file(v);
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();

                fse.outputFileSync(v, fo.buffer());
                fs.utimesSync(v, new Date(tf.time), new Date(tf.time));
                repo.unstage(v);
            });

        res.added
            .concat(res.addedStaged)
            .forEach(v => {
                fs.unlinkSync(v);
                repo.unstage(v);
            });

        res.removed
            .concat(res.removedStaged)
            .forEach(v => {
                if (!commit) {
                    log.error('unexpected file removal without HEAD commit');
                    return;
                }

                var tf = commit.file(v);
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();
                fse.outputFileSync(v, fo.buffer());
                fs.utimesSync(v, new Date(tf.time), new Date(tf.time));
            });
    }

    export function checkout(repo: Common.Repo, commit: Common.Commit, branch?: Common.Branch) {
        if (!!branch) {
            repo.currentBranchName = branch.name;
            repo.detachedHEADID = null;
        } else {
            repo.currentBranchName = null;
            repo.detachedHEADID = commit.id;
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
        if (targetCommit.id != repo.lastCommitID) {
            let oldHEADCommit = repo.lastCommit;

            repo.writeORIGHEADCommitData(oldHEADCommit);
            repo.currentBranch.move(targetCommit.id);
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
}
export = Client;