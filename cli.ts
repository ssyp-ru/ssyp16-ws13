#!/usr/bin/node
/// <reference path="log-symbols.d.ts" />
/// <reference path="colors.d.ts" />
/// <reference path="commander.d.ts" />
/// <reference path="configstore.d.ts" />
import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as fs from "fs";
import * as fse from 'fs-extra';
import * as path from 'path';
import * as Common from './common';
import * as Format from './format';
import * as Client from './client';
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
program
    .version(colors.rainbow("WIP") + " build");
program
    .command("init")
    .description("Initialize new repo in current working directory")
    .option('-q, --quiet', 'Only print error and warning messages, all other output will be suppressed.')
    .action((options) => {
        var q = !!options.quiet;
        Client.init(process.cwd(), q);
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
        var res = Client.status(repo);
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
        var curCommit = repo.currentBranchName;
        if (!curCommit) {
            curCommit = 'HEAD #' + repo.detachedHEADID.substring(0, 7);
        }
        console.log(colors.dim('JERK'), logSymbols.info, colors.blue(repo.name), '>',
            colors.yellow(curCommit), '>', colors.bold(mod));
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
            var res = Client.status(repo, true);
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
    .action((message: string, options: any) => {
        var repo = cwdRepo();
        if (repo.staged.length < 1) {
            console.log(colors.dim('JERK'), logSymbols.info, 'no changes to commit');
            return;
        }
        var authorName: string = conf.get('authorName');
        var authorEMail: string = conf.get('authorEMail');
        var noAuthor = !authorName || !authorEMail;
        if (noAuthor) {
            console.log(colors.dim('JERK'), logSymbols.error,
                'either author name or email is not specified!');
            return;
        }
        if (!!repo.detachedHEADID) {
            console.log(colors.dim('JERK'), logSymbols.error,
                'You can not commit in detached HEAD state. Create new branch.');
            return;
        }
        var commit = repo.lastCommit;
        var newCommit = repo.createCommit(commit, message, authorName, authorEMail);
        console.log(colors.dim('JERK'), logSymbols.success,
            Format.formatCommitMessage(newCommit, '%Cyellow%h%Creset: %s'));
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
    .option('-f, --format <format>', 'Set output formatting, available options are: oneline|onelineWide|short|medium|full|fuller|format=<...>', /^(oneline|onelineWide|short|medium|full|fuller|format=.*)$/i)
    .action((options: any) => {
        var repo = cwdRepo();
        console.log(colors.dim('JERK'), 'Commit Log');
        var commit = repo.lastCommit;
        var graph = !!options.graph;
        if (options.format === true) {
            console.log(colors.dim('JERK'), logSymbols.error, 'unknown log format');
        }
        var format: string = options.format || (graph ? 'onelineWide' : 'short');
        if (format.startsWith('format=')) {
            format = format.substring(7);
        } else {
            switch (format) {
                case 'oneline':
                    format = Format.onelineFormat;
                    break;
                case 'onelineWide':
                    format = Format.onelineWideFormat;
                    break;
                case 'short':
                    format = Format.shortFormat;
                    break;
                case 'medium':
                    format = Format.mediumFormat;
                    break;
                case 'full':
                    format = Format.fullFormat;
                    break;
                case 'fuller':
                    format = Format.fullerFormat;
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
            var nextCommit = commit.parent;
            var isLastCommit = nextCommit == null;
            var message = Format.formatCommitMessage(commit, format);
            if (graph) {
                var lines = message.split('\n');
                if (lines.length == 1) {
                    console.log(colors.yellow('*'), message);
                } else {
                    console.log(colors.yellow('*'), lines[0]);
                    for (var i = 1; i < lines.length; i++) {
                        if (isLastCommit) {
                            console.log('  ', lines[i]);
                        } else {
                            console.log(colors.red('|'), '', lines[i]);
                        }
                    }
                }
            } else {
                console.log(message);
                if (!isLastCommit) console.log();
            }
            commit = nextCommit;
        }
    });
program
    .command('branch [name]')
    .description('List, create or delete branches')
    .option('-a, --all', 'Show all branches')
    .action((name: string, options: any) => {
        var repo = cwdRepo();
        if (!name) {
            console.log(colors.dim('JERK'), 'Branches');
            repo.refs().filter(x => x instanceof Common.Branch).forEach(x => {
                if (x.name.startsWith('remote/') && !options.all) return;
                console.log(colors.yellow('*'), x.name);
            });
            return;
        }
        try {
            var branch = repo.createBranch(name, repo.lastCommitID);
            console.log(colors.dim('JERK'), logSymbols.success,
                'Branch "' + branch.name + '" created successfully!');
        } catch (e) {
            console.log(colors.dim('JERK'), logSymbols.error, 'Failed to create branch: ' + e);
        }
    });
program
    .command('checkout <what>')
    .description('Checkout a branch, a tag or a specific commit to the working tree')
    .option('-f, --force', 'Throw away local changes, if any.')
    .action((what: string, options: any) => {
        var repo = cwdRepo();
        var commit = repo.commit(what);
        var branch = repo.ref<Common.Branch>(what);
        if (!commit && !!branch) {
            commit = repo.commit(branch.head);
        }
        if (!commit) {
            console.log(colors.dim('JERK'), logSymbols.error, 'Commit or branch to checkout not found!');
            return;
        }
        if (options.force) Client.revertAllWorkingTreeChanges(repo);
        Client.checkout(repo, commit, branch);
        if (!branch) {
            console.log(colors.dim('JERK'), logSymbols.info, "Detached HEAD");
            console.log("You have entered 'detached HEAD' state. You can look around, make experimental changes" +
                " and create new branch based on this commit to retain all changes you would like to make.\n" +
                "You can NOT commit in detached HEAD state, but you can always create a new branch.");
        }
    });
program
    .command('rm [file...]')
    .description('Remove files from the index, and optionally from the working tree too')
    .option('-C, --cached', 'Leave working tree unchanged, only remove from the index')
    .option('-D, --deleted', 'Remove locally deleted files from the index')
    .action((file: string[], options: any) => {
        let repo = cwdRepo();
        let cached = !!options.cached;
        let deleted = !!options.deleted;
        if (deleted) {
            let res = Client.status(repo);
            file = res.removed.concat(res.removedStaged);
        }
        file.forEach(v => {
            repo.unstage(v);
            if (!cached) {
                fse.remove(v, v => { });
            }
        });
    });
program
    .command('reset [paths...]')
    .description('Reset current HEAD to the specified state')
    .option('-q, --quiet', 'Be quiet, do not print any notices')
    .option('--soft', 'Only move HEAD to the specified target')
    .option('--mixed', 'Reset index, but not the working tree (default)')
    .option('--hard', 'Reset the index and the working tree')
    .option('--merge', 'Revert failed merge attempt but keep any other local changes')
    .action((paths: string[], options: any) => {
        let repo = cwdRepo();
        paths = paths || [];
        var mode = 0;
        if (paths.length == 0) mode = 2; else
            if (paths.length == 1) {
                if (options.soft || options.mixed || options.hard || options.merge) mode = 2;
                else {
                    var cm = repo.commit(paths[0]);
                    if (!!cm) {
                        mode = 2;
                        targetCommit = cm;
                    } else {
                        mode = 1;
                    }
                }
            } else {
                mode = 1;
            }
        let quiet = !!options.quiet;
        let givenCommit = paths.length > 0 ? repo.commit(paths[0]) : null;
        var targetCommit = givenCommit || repo.lastCommit;
        if (!!givenCommit) {
            paths.shift();
        }
        if (mode == 1) {
            if (!!givenCommit) {
                console.log(colors.dim('JERK'), logSymbols.info, "Git-specific behavior");
                console.log("You have specified commit to reset given index entries to. In JERK, index" +
                    " entries do NOT relate to any commit, instead use " + colors.bold('jerk checkout') +
                    " command to load file contents from the specified commit. Option ignored.");
            }
            Client.resetFirstMode(repo, paths, targetCommit, quiet);
        } else {
            let soft = !!options.soft;
            var mixed = !!options.mixed;
            let hard = !!options.hard;
            let merge = !!options.merge;
            if (!soft && !mixed && !hard && !merge) mixed = true;
            Client.resetSecondMode(repo, soft, mixed, hard, merge, targetCommit, quiet);
        }
    });
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}