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
        var commitID = repo.currentBranch.head;
        var commit = !!commitID ? repo.commit(commitID) : null;
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
                                if (tf.time < stat.ctime.getTime()) {
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
}
export = Client;