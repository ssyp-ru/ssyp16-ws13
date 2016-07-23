import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from 'path';
import * as Common from './common';
import * as Format from './format';
import program = require('commander');
var glob = require('glob');
import * as Moment from 'moment';
module Client {
    export function init(path: string, quiet: boolean = false) {
        fs.stat(path, (err, stats) => {
            if (!!err || !stats) {
                fs.mkdirSync(path);
            }
            var repo = new Common.Repo(path, true, quiet);
            if (!repo && !quiet) {
                console.log("Repository initialization failed!")
            }
        });
    }
    export function status(repo: Common.Repo, quiet: boolean = false): {
        modified: string[], added: string[], removed: string[],
        modifiedStaged: string[], addedStaged: string[],
        removedStaged: string[], anyNewChanges: boolean,
        anyStagedChanges: boolean, anyChanges: boolean
    } {
        var commit = repo.lastCommit;
        var ignore = ['.jerk', '.jerk/**/*'];
        var all: string[] = glob.sync('**/*',
            { dot: true, nodir: true, ignore: '{' + ignore.join() + '}' });
        var modified: string[] = [];
        var added: string[] = [];
        var removed: string[] = [];
        var modifiedStaged: string[] = [];
        var addedStaged: string[] = [];
        var removedStaged: string[] = [];
        var index = repo.index;
        var staged = repo.staged;
        function push(v: string, mode: number) {
            var isStaged = staged.indexOf(v) >= 0;
            var arr: string[];
            switch (mode) {
                case 0:
                    arr = isStaged ? modifiedStaged : modified;
                    break;
                case 1:
                    arr = isStaged ? addedStaged : added;
                    repo.addToIndex(v);
                    break;
                case 2:
                    arr = isStaged ? removedStaged : removed;
                    break;
                default:
                    throw "Illegal state mode";
            }
            arr.push(v);
        }
        all.forEach(v => {
            if (index.indexOf(v) >= 0) {
                if (!commit) {
                    push(v, 1);
                } else {
                    var tf = commit.file(v);
                    if (!tf) {
                        push(v, 1);
                    } else {
                        var stat: fs.Stats;
                        try {
                            stat = fs.lstatSync(v);
                            if (!!stat) {
                                if (tf.time < stat.mtime.getTime()) {
                                    push(v, 0);
                                }
                            }
                        } catch (e) {
                            if (!quiet) console.log(colors.dim('JERK'), logSymbols.warning,
                                'file "' + v + '" died in vain...');
                        }
                    }
                }
            } else {
                repo.addToIndex(v);
                push(v, 1);
            }
        });
        index.forEach(v => {
            if (all.indexOf(v) < 0) {
                push(v, 2);
            }
        });
        staged.forEach(v => {
            if (all.indexOf(v) < 0) {
                if (!quiet) console.log(colors.dim('JERK'), logSymbols.warning,
                    'staged file "' + v + '" removed');
                repo.unstage(v);
                repo.rmFromIndex(v);
            }
        });
        all = undefined;
        var anyNewChanges = modified.length > 0 || added.length > 0 || removed.length > 0;
        var anyStagedChanges = modifiedStaged.length > 0 || addedStaged.length > 0 || removedStaged.length > 0;
        var anyChanges = anyNewChanges || anyStagedChanges;
        return {
            modified: modified, added: added, removed: removed,
            modifiedStaged: modifiedStaged, addedStaged: addedStaged,
            removedStaged: removedStaged, anyNewChanges: anyNewChanges,
            anyStagedChanges: anyStagedChanges, anyChanges: anyChanges
        }
    }
    export function revertSingleWorkingTreeChange(repo: Common.Repo, path: string) {
        var commit = repo.lastCommit;
        if (!commit) {
            fs.unlinkSync(path);
            repo.rmFromIndex(path);
        } else {
            var tf = commit.file(path);
            if (!tf) {
                fs.unlinkSync(path);
                repo.rmFromIndex(path);
            } else {
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();
                var stat: fs.Stats;
                try {
                    stat = fs.lstatSync(path);
                    if (!!stat) {
                        if (tf.time != stat.mtime.getTime()) {
                            fs.writeFileSync(path, fo.buffer(), { flag: 'w' });
                            fs.utimesSync(path, new Date(tf.time), new Date(tf.time));
                            repo.addToIndex(path);
                        }
                    } else {
                        fs.writeFileSync(path, fo.buffer(), { flag: 'w' });
                        fs.utimesSync(path, new Date(tf.time), new Date(tf.time));
                        repo.addToIndex(path);
                    }
                } catch (e) {
                    fs.writeFileSync(path, fo.buffer(), { flag: 'w' });
                    fs.utimesSync(path, new Date(tf.time), new Date(tf.time));
                    repo.addToIndex(path);
                }
            }
        }
    }
    export function revertAllWorkingTreeChanges(repo: Common.Repo) {
        var commit = repo.lastCommit;
        var res = status(repo);
        var modified = res.modified;
        var modifiedStaged = res.modifiedStaged;
        var added = res.added;
        var addedStaged = res.addedStaged;
        var removed = res.removed;
        var removedStaged = res.removedStaged;
        var anyChanges = res.anyChanges;
        var anyNewChanges = res.anyNewChanges;
        var anyStagedChanges = res.anyStagedChanges;
        if (!anyChanges) {
            return;
        }
        modified.concat(modifiedStaged).forEach(v => {
            if (!commit) {
                fs.unlinkSync(v);
                repo.rmFromIndex(v);
            } else {
                var tf = commit.file(v);
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();
                fs.writeFileSync(v, fo.buffer(), { flag: 'w' });
                fs.utimesSync(v, new Date(tf.time), new Date(tf.time));
                repo.addToIndex(v);
            }
        });
        added.concat(addedStaged).forEach(v => {
            fs.unlinkSync(v);
            repo.rmFromIndex(v);
        })
        removed.concat(removedStaged).forEach(v => {
            if (!commit) {
                console.log(colors.dim('JERK'), logSymbols.error, 'unexpected file removal without HEAD commit');
                return;
            } else {
                var tf = commit.file(v);
                var fo = repo.fs.resolveObjectByHash(tf.hash).asFile();
                fs.writeFileSync(v, fo.buffer(), { flag: 'w' });
                fs.utimesSync(v, new Date(tf.time), new Date(tf.time));
                repo.addToIndex(v);
            }
        });
    }
    export function checkout(repo: Common.Repo, commit: Common.Commit, branch?: Common.Branch) {
        if (!!branch) {
            repo.currentBranchName = branch.name;
            repo.detachedHEADID = null;
            revertAllWorkingTreeChanges(repo);
        } else {
            repo.currentBranchName = null;
            repo.detachedHEADID = commit.id;
            revertAllWorkingTreeChanges(repo);
        }
        commit.contents.forEach(v => {
            var fo = repo.fs.resolveObjectByHash(v.hash).asFile();
            var stat: fs.Stats;
            try {
                stat = fs.lstatSync(v.path);
                if (!!stat) {
                    if (v.time != stat.mtime.getTime()) {
                        fs.writeFileSync(v.path, fo.buffer(), { flag: 'w' });
                        fs.utimesSync(v.path, new Date(v.time), new Date(v.time));
                        repo.addToIndex(v.path);
                    }
                } else {
                    fs.writeFileSync(v.path, fo.buffer(), { flag: 'w' });
                    fs.utimesSync(v.path, new Date(v.time), new Date(v.time));
                    repo.addToIndex(v.path);
                }
            } catch (e) {
                fs.writeFileSync(v.path, fo.buffer(), { flag: 'w' });
                fs.utimesSync(v.path, new Date(v.time), new Date(v.time));
                repo.addToIndex(v.path);
            }
        });
        revertAllWorkingTreeChanges(repo);
    }
}
export = Client;