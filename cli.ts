#!/usr/bin/node
/// <reference path="log-symbols.d.ts" />
/// <reference path="colors.d.ts" />
/// <reference path="commander.d.ts" />
/// <reference path="configstore.d.ts" />
import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from 'path';
import * as Common from './common';
import program = require('commander');
var glob = require('glob');
import Configstore = require('configstore');
const conf = new Configstore('jerk');

function cwdRepo(): Common.Repo {
    var repo = Common.cwdRepo();
    if (!repo) {
        console.log(colors.dim('JERK'), logSymbols.info, "not currently in a jerk repository.");
        process.exit(1);
    }
    return repo;
}
module CLI {
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
program
    .version(colors.rainbow("WIP") + " build");
program
    .command("init")
    .description("Initialize new repo in current working directory")
    .option('-q, --quiet', 'Only print error and warning messages, all other output will be suppressed.')
    .action((options) => {
        var q = !!options.quiet;
        CLI.init(process.cwd(), q);
    });
program
    .command("clone <url>")
    .alias("cl")
    .description("Clone local or remote repo")
    .action((url) => {
        console.log(url);
        child_process.execFile("rsync", ['rsync://127.1:19246/git'], (err, stdout, stderr) => {
            if (!!err) console.log(err);
            if (!!stdout) console.log(stdout);
            if (!!stderr) console.log(stderr);
        });
    });
program
    .command('status')
    .description('Show the repository status')
    .action(() => {
        var repo = cwdRepo();
        var res = CLI.status(repo);
        var modified = res.modified;
        var modifiedStaged = res.modifiedStaged;
        var added = res.added;
        var addedStaged = res.addedStaged;
        var removed = res.removed;
        var removedStaged = res.removedStaged;
        var anyChanges = res.anyChanges;
        var anyNewChanges = res.anyNewChanges;
        var anyStagedChanges = res.anyStagedChanges;
        var mod = 'not modified';
        if (anyChanges) {
            mod = 'modified';
        }
        if (anyStagedChanges) {
            mod += ', staged';
        }
        console.log(colors.dim('JERK'), logSymbols.info,
            colors.blue(repo.name), '>', colors.yellow(repo.currentBranchName),
            '>', colors.bold(mod));
        if (anyNewChanges) {
            console.log(colors.dim('JERK'), logSymbols.info, 'changes not staged for commit:');
            modified.forEach(v => console.log('    ' + colors.red('modified:') + '  ' + v));
            added.forEach(v => console.log('    ' + colors.red('added:') + '  ' + v));
            removed.forEach(v => console.log('    ' + colors.red('removed:') + '  ' + v));
        }
        if (anyStagedChanges) {
            console.log(colors.dim('JERK'), logSymbols.info, 'changes to be committed:');
            modifiedStaged.forEach(v => console.log('    ' + colors.green('modified:') + '  ' + v));
            addedStaged.forEach(v => console.log('    ' + colors.green('added:') + '  ' + v));
            removedStaged.forEach(v => console.log('    ' + colors.green('removed:') + '  ' + v));
        }
    });
program
    .command('add [files...]')
    .description('Stage files to be commited in the nearest future.')
    .option('-A, --all', 'Add all available files to stage')
    .action((files: string[], options: any) => {
        var repo = cwdRepo();
        if (options.all) {
            var res = CLI.status(repo, true);
            var modified = res.modified;
            var modifiedStaged = res.modifiedStaged;
            var added = res.added;
            var addedStaged = res.addedStaged;
            var removed = res.removed;
            var removedStaged = res.removedStaged;
            var anyChanges = res.anyChanges;
            var anyNewChanges = res.anyNewChanges;
            var anyStagedChanges = res.anyStagedChanges;
            modified.forEach(v => repo.stage(v));
            added.forEach(v => repo.stage(v));
            removed.forEach(v => repo.stage(v));
            return;
        }
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            try {
                var stat = fs.lstatSync(file);
                if (stat.isDirectory()) {
                    console.log(colors.dim('JERK'), logSymbols.warning,
                        'not staging "' + file + '" directory');
                    continue;
                }
                repo.stage(file);
            } catch (e) {
                console.log(colors.dim('JERK'), logSymbols.warning,
                    'file "' + file + '" not found, not staging');
            }
        }
    });
program
    .command('commit [message]')
    .description('Record staged changes to repository')
    .option('--ignoreAuthor', 'Bypass author name and email existance checks. Beware, it leads to ambiguous situations in repo management!')
    .action((message: string, options: any) => {
        var repo = cwdRepo();
        if (repo.staged.length < 1) {
            console.log(colors.dim('JERK'), logSymbols.info, 'no changes to commit');
            return;
        }
        var authorName: string = conf.get('authorName');
        var authorEMail: string = conf.get('authorEMail');
        var noAuthor = !authorName || !authorEMail;
        if (noAuthor && !options.ignoreAuthor) {
            console.log(colors.dim('JERK'), logSymbols.error, 'either author name or email is not specified! Pass --ignoreAuthor option to bypass the check');
            return;
        }
        var commitID = repo.currentBranch.head;
        var commit = !!commitID ? repo.commit(commitID) : null;
        repo.createCommit(commit, message, authorName, authorEMail);
    });
program
    .command('config <op> [args...]')
    .description('Configuration manager')
    .action((op: string, args: string[]) => {
        console.log(colors.dim('JERK'), 'Configuration Manager');
        switch (op) {
            case "list": {
                console.log(colors.cyan('Global'), 'options:');
                var allConf = Common.iterateStringKeyObject<any>(conf.all);
                allConf.forEach(v => {
                    if (!v.key.startsWith('repo_')) {
                        console.log(v.key, "=", v.value);
                    }
                });
                var repo = Common.cwdRepo();
                if (!!repo) {
                    var lc = conf.get('repo_' + repo.name);
                    if (!!lc) {
                        console.log(colors.cyan('Local repository'), 'options:');
                        Common.iterateStringKeyObject<any>(lc).forEach(v => {
                            console.log(v.key, "=", v.value);
                        });
                    }
                }
                break;
            }
            case "set": {
                if (args.length < 2) {
                    console.log(colors.dim('JERK'), logSymbols.error, 'Not enough arguments for set operation. You must specify both key and value to set.');
                    return;
                }
                conf.set(args[0], args[1]);
                console.log(args[0], '=', conf.get(args[0]));
                break;
            }
            default: {
                console.log(colors.dim('JERK'), logSymbols.error, 'unknown operation');
                break;
            }
        }
    });
program
    .command('log')
    .description('Show commits log')
    .option('-g, --graph', 'Output as commit graph')
    .action((options: any) => {
        var repo = cwdRepo();
        console.log(colors.dim('JERK'), 'Commit Log');
        var commitID = repo.currentBranch.head;
        var commit = !!commitID ? repo.commit(commitID) : null;
        if (!commit) {
            console.log('No commits found.');
            return;
        }
        while (!!commit) {
            console.log(colors.yellow('*'), commit.message);
            commit = commit.parent;
        }
    });
program
    .command('branch')
    .description('List, create or delete branches')
    .option('-a, --all', 'Show all branches')
    .action((options: any) => {
        var repo = cwdRepo();
        console.log(colors.dim('JERK'), 'Branches');
        repo.refs().filter(x => x instanceof Common.Branch).forEach(x => {
            if (x.name.startsWith('remote/') && !options.all) return;
            console.log(colors.yellow('*'), x.name);
        });
    })
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}