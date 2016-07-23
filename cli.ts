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
import * as Moment from 'moment';
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
    .description('Stage files to be commited in the nearest future')
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
const onelineFormat = "%Cyellow%h%Creset %s";
const onelineWideFormat = "%Cyellow%h%Creset %Cgreen(%an, %ar)%Creset %s";
const shortFormat = "commit %Cyellow%h%Creset%nAuthor: %Cgreen%an%Creset%n%s";
const mediumFormat = "commit %Cyellow%h%Creset%nAuthor: %Cgreen%an%Creset%nDate: %ad%n%b";
const fullFormat = "commit %Cyellow%h%Creset%nAuthor: %Cgreen%an%Creset%nCommit: %Cgreen%cn%Creset%n%b";
const fullerFormat = "commit %Cyellow%h%Creset%nAuthor: %Cgreen%an%Creset%nAuthorDate: %ad%nCommit: %Cgreen%cn%Creset%nCommitDate: %cd%n%b";
program
    .command('log')
    .description('Show commits log')
    .option('-g, --graph', 'Output as commit graph')
    .option('-f, --format <format>', 'Set output formatting', /^(oneline|onelineWide|short|medium|full|fuller|format=.*)$/i, 'short')
    .action((options: any) => {
        var repo = cwdRepo();
        console.log(colors.dim('JERK'), 'Commit Log');
        var commitID = repo.currentBranch.head;
        var commit = !!commitID ? repo.commit(commitID) : null;
        var graph = !!options.graph;
        var format: string = options.format || (graph ? 'onelineWide' : 'short');
        if (format.startsWith('format=')) {
            format = format.substring(7);
        } else {
            switch (format) {
                case 'oneline':
                    format = onelineFormat;
                    break;
                case 'onelineWide':
                    format = onelineWideFormat;
                    break;
                case 'short':
                    format = shortFormat;
                    break;
                case 'medium':
                    format = mediumFormat;
                    break;
                case 'full':
                    format = fullFormat;
                    break;
                case 'fuller':
                    format = fullerFormat;
                    break;
                default:
                    break;
            }
        }
        if (!commit) {
            console.log('No commits found.');
            return;
        }
        while (!!commit) {
            var message = "";
            var special = false;
            for (var i = 0; i < format.length; i++) {
                var c = format[i];
                if (c !== '%' && !special) {
                    message += c;
                    continue;
                } else if (c !== '%' && special) {
                    if (c == 'C') {
                        // Color
                        function isNext(str: string): boolean {
                            if (format.length - (i + 1) < str.length) return false;
                            var strI = 0;
                            for (var j = i + 1; j < format.length; j++) {
                                if (format[j] != str[strI++]) return false;
                                if (strI >= str.length) break;
                            }
                            i += str.length;
                            return true;
                        }
                        var colorCodes = {
                            black: 30,
                            red: 31,
                            green: 32,
                            yellow: 33,
                            blue: 34,
                            magenta: 35,
                            cyan: 36,
                            white: 37,
                            gray: 90,
                            grey: 90
                        }
                        if (isNext('reset')) message += '\u001b[' + 39 + 'm'; else
                            if (isNext('black')) message += '\u001b[' + colorCodes.black + 'm'; else
                                if (isNext('red')) message += '\u001b[' + colorCodes.red + 'm'; else
                                    if (isNext('green')) message += '\u001b[' + colorCodes.green + 'm'; else
                                        if (isNext('yellow')) message += '\u001b[' + colorCodes.yellow + 'm'; else
                                            if (isNext('blue')) message += '\u001b[' + colorCodes.blue + 'm'; else
                                                if (isNext('magenta')) message += '\u001b[' + colorCodes.magenta + 'm'; else
                                                    if (isNext('cyan')) message += '\u001b[' + colorCodes.cyan + 'm'; else
                                                        if (isNext('white')) message += '\u001b[' + colorCodes.white + 'm'; else
                                                            if (isNext('gray')) message += '\u001b[' + colorCodes.gray + 'm'; else
                                                                if (isNext('grey')) message += '\u001b[' + colorCodes.grey + 'm';

                    } else if (c == 'h') {
                        // SHA
                        message += commit.id;
                    } else if (c == 's') {
                        // Title
                        message += commit.message.split('\n').shift();
                    } else if (c == 'b') {
                        // Body
                        message += commit.message;
                    } else if (c == 'a') {
                        // Author
                        if (format[i + 1] == 'd') {
                            message += Moment(new Date(commit.time)).format('DD-MM-YYYY HH:MM:SS');
                        } else if (format[i + 1] == 'n') {
                            message += commit.authorName;
                        } else if (format[i + 1] == 'e') {
                            message += commit.authorEMail;
                        } else if (format[i + 1] == 'r') {
                            message += Moment(new Date(commit.time)).fromNow();
                        }
                        i++;
                    } else if (c == 'c') {
                        // Committer
                        if (format[i + 1] == 'd') {
                            message += Moment(new Date(commit.time)).format('DD-MM-YYYY HH:MM:SS');
                        } else if (format[i + 1] == 'n') {
                            message += commit.authorName;
                        } else if (format[i + 1] == 'e') {
                            message += commit.authorEMail;
                        } else if (format[i + 1] == 'r') {
                            message += Moment(new Date(commit.time)).fromNow();
                        }
                        i++;
                    } else if (c == 'n') {
                        // New line
                        message += '\n';
                    } else if (c == '%') {
                        // %
                        message += '%';
                    }
                    special = false;
                    continue;
                }
                special = true;
            }
            console.log(colors.yellow('*'), message);
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