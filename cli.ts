#!/usr/bin/env node
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as http from "http";
import * as fs from "fs";
import * as fse from 'fs-extra';
import * as path from 'path';
import * as Common from './common';
import * as Format from './format';
import * as Client from './client';
import * as Logger from './log';
import program = require('commander');
import * as glob from 'glob';
import * as Moment from 'moment';
import Configstore = require('configstore');
let ProgressBar = require('progress');

let conf = new Configstore('jerk');

let commitConfigOptionDescription = 'Create new commit based on previously written out old commit' +
    ` (e.g. with ${colors.bold('pull')}, ${colors.bold('merge')} ` +
    `or ${colors.bold('reset')} commands).`;
let resetCommitGivenHint = "You have specified commit to reset given index entries to. In JERK, index" +
    ` entries do NOT relate to any commit, instead use "${colors.bold('jerk checkout')}` +
    " command to load file contents from the specified commit. Option ignored.";
let quietDescription = 'Be quiet, only print warnings and errors, any other output will be suppressed.';

module CLI {
    export let log = new Logger.Logger();

    function cwdRepo(): Common.Repo {
        var repo = Common.cwdRepo();
        if (!repo) {
            log.info("not currently in a jerk repository.");
            process.exit(1);
        }
        return repo;
    }

    export function init(options: any) {
        if (!!options.quiet) log.silence();

        Client.init(process.cwd());
    }

    function progressBarCallback(): (val: number) => void {
        let bar = new ProgressBar('  remote [:bar] :percent :etas', { total: 100, clear: true });
        return (val: number) => {
            if (val === -1) {
                bar.tick(0);
                return;
            }
            bar.update(val);
        };
    }

    export function clone(url: string, options: any) {
        if (!!options.quiet) log.silence();
        if (fs.existsSync('.jerk')) {
            return log.error('You can not clone inside existing repository');
        }

        Client.clone(url, progressBarCallback(), () => {
            let repo = new Common.Repo(process.cwd());
            log.info(repo.name + ':', colors.yellow('' + repo.commits.length), 'commits');
        }, () => {
            log.success('repository cloned successfully!');
        });
    }

    export function status(options: any) {
        if (!!options.quiet) log.silence();
        var repo = cwdRepo();
        var res = Client.status(repo);

        var mod = 'not modified';
        if (res.anyChanges) mod = 'modified';
        if (res.anyStagedChanges) mod += ', staged';
        if (!!repo.merging) {
            mod = 'merging';
        }
        var curCommit = repo.currentBranchName;
        if (!curCommit) {
            curCommit = 'HEAD #' + repo.head.head.substring(0, 7);
        }

        log.info(colors.blue(repo.name), '>', colors.yellow(curCommit), '>', colors.bold(mod));
        if (res.anyNewChanges) {
            log.info('changes not staged for commit:');

            res.modified.forEach(v => log.log(`    ${colors.red('modified:')}  ${v}`));
            res.added.forEach(v => log.log(`    ${colors.red('added:')}  ${v}`));
            res.removed.forEach(v => log.log(`    ${colors.red('removed:')}  ${v}`));
        }
        if (res.anyStagedChanges) {
            log.info('changes to be committed:');
            res.modifiedStaged.forEach(v => log.log(`    ${colors.green('modified:')}  ${v}`));
            res.addedStaged.forEach(v => log.log(`    ${colors.green('added:')}  ${v}`));
            res.removedStaged.forEach(v => log.log(`    ${colors.green('removed:')}  ${v}`));
        }
    }

    export function add(files: string[], options: any) {
        if (!!options.quiet) log.silence();
        var repo = cwdRepo();

        if (options.all) {
            var res = Client.status(repo);
            res.allNewChanges.forEach(v => repo.stage(v));
            return;
        }

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            try {
                var stat = fs.lstatSync(file);
                if (stat.isDirectory()) {
                    log.warn(`not staging "${file}" directory`);
                    continue;
                }
                repo.stage(file);
            } catch (e) {
                log.warn(`file "${file}" not found, not staging`);
            }
        }
    }

    export function commit(message: string, options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let allowEmpty = !!options.allowEmpty;
        if (repo.staged.length < 1 && !allowEmpty) {
            log.info('no changes to commit');
            return;
        }

        let authorName: string = conf.get('authorName');
        let authorEMail: string = conf.get('authorEMail');
        var noAuthor = !authorName || !authorEMail;
        if (noAuthor) {
            log.error('either author name or email is not specified!');
            return;
        }

        if (!repo.currentBranchName) {
            log.error('you can not commit in detached HEAD state. Create new branch.');
            return;
        }

        let optionConfig: string = options.reeditMessage || options.reuseMessage;
        let amend = !!options.amend;
        var oldCommitData: string[] = null;

        if (!!optionConfig) {
            let resolved = Client.resolveWhat(repo, optionConfig).commit;
            if (!!resolved) oldCommitData = resolved.data();
        }

        var commit = repo.head.commit;
        var newCommit = repo.createCommit(commit, message, authorName, authorEMail, amend, oldCommitData);
        log.success(Format.formatCommitMessage(newCommit, '%Cyellow%h%Creset: %s'));
    }

    export function config(op: string, args: string[]) {
        log.header('Configuration Manager');

        switch (op) {
            case "list": {
                log.log(colors.cyan('Global'), 'options:');

                var allConf = Common.iterateStringKeyObject<any>(conf.all);
                allConf.forEach(v => {
                    if (!v.key.startsWith('repo_')) {
                        log.log(v.key, "=", v.value);
                    }
                });

                let repo = Common.cwdRepo();
                if (!!repo) {
                    var lc = conf.get('repo_' + repo.name);
                    if (!!lc) {
                        log.log(colors.cyan('Local repository'), 'options:');

                        Common.iterateStringKeyObject<any>(lc).forEach(v => {
                            log.log(v.key, "=", v.value);
                        });
                    }
                }
                break;
            }
            case "set": {
                if (args.length < 2) {
                    log.error('Not enough arguments for set operation.' +
                        'You must specify both key and value to set.');
                    return;
                }

                var key = args[0];
                let repo = Common.cwdRepo();
                if (key.startsWith('this.')) {
                    if (!repo) {
                        log.error(`You use local repository referencing (${colors.italic('this.')})` +
                            ` while outside of any repository directory. Aborting.`);
                        return;
                    }
                    key = key.replace('this.', 'repo_' + repo.name + '.');
                }
                conf.set(key, args[1]);
                log.log(args[0], '=', conf.get(key));
                break;
            }
            case "delete": {
                let repo = cwdRepo();
                if (args.length < 2) {
                    log.error('Not enough arguments for set operation.' +
                        'You must specify both key and value to set.');
                    return;
                }

                var key = args[0];
                if (key.startsWith('this.')) {
                    key = key.replace('this.', 'repo_' + repo.name + '.');
                }
                conf.set(key, args[1]);
                log.log(args[0], '=', conf.get(key));
                break;
            }
            default: {
                log.error('unknown operation');
                break;
            }
        }
    }

    export function commitLog(options: any) {
        if (!!options.quiet) log.silence();
        var repo = cwdRepo();
        log.header('Commit Log');

        var commit = repo.head.commit;
        var graph = !!options.graph;
        if (options.format === true) {
            log.error('unknown log format');
            return;
        }

        var format: string = options.format
            || (graph ? 'onelineWide' : 'short');
        format = Format.decodeFormat(format);

        if (!commit) {
            log.warn('No commits found.');
            return;
        }

        if (!!repo.merging) {
            log.warn('In merging mode, latest commits not shown.');
        }

        while (!!commit) {
            var nextCommit = commit.parent;

            var isLastCommit = nextCommit == null;
            var message = Format.formatCommitMessage(commit, format);

            if (graph) {
                var lines = message.split('\n');
                if (lines.length == 1) {
                    log.log(colors.yellow('*'), message);
                } else {
                    log.log(colors.yellow('*'), lines[0]);
                    for (var i = 1; i < lines.length; i++) {
                        if (isLastCommit) {
                            log.log('  ', lines[i]);
                        } else {
                            log.log(colors.red('|'), '', lines[i]);
                        }
                    }
                }
            } else {
                log.log(message);
                if (!isLastCommit) log.log();
            }

            commit = nextCommit;
        }
    }

    export function branch(name: string, options: any) {
        if (!!options.quiet) log.silence();
        var repo = cwdRepo();

        if (!name) {
            log.header('Branches');

            repo.refs().filter(x => x instanceof Common.Branch).forEach(x => {
                if (x.name.startsWith('remote/') && !options.all) return;
                log.log(colors.yellow('*'), x.name);
            });

            return;
        }

        try {
            var branch = repo.createBranch(name, repo.head.head);

            log.success(`Branch "${branch.name}" created successfully!`);
        } catch (e) {
            log.error('Failed to create branch: ' + e);
        }
    }

    export function checkout(what: string, options: any) {
        if (!!options.quiet) log.silence();
        var repo = cwdRepo();

        let res = Client.resolveWhat(repo, what);
        if (!res.commit) {
            log.error('Commit or branch to checkout not found!');
            return;
        }

        if (options.force) {
            Client.revertAllWorkingTreeChanges(repo);
        } else if (!!repo.merging) {
            log.error(`You are in merging mode, specify ${colors.bold('--force')} or finish and commit merging results.`)
            return;
        }

        repo.setMerging(null, null);

        Client.checkout(repo, res.commit, (res.ref instanceof Common.Branch) ? res.ref : null);

        if (!repo.currentBranchName) {
            log.info("Detached HEAD");
            log.log("You have entered 'detached HEAD' state. You can look around, make experimental changes" +
                " and create new branch based on this commit to retain all changes you would like to make." +
                "\nYou can NOT commit in detached HEAD state, but you can always create a new branch.");
        }
    }

    export function rm(file: string[], options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let cached = !!options.cached;
        let deleted = !!options.deleted;
        if (deleted) {
            let res = Client.status(repo);
            file = res.removed
                .concat(res.removedStaged);
        }

        file.forEach(v => {
            repo.unstage(v);
            if (!cached) {
                fse.remove(v, v => { });
            }
        });
    }

    export function reset(paths: string[], options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();
        paths = paths || [];

        var mode = 0;
        switch (paths.length) {
            case 0: {
                mode = 2;
                break;
            }
            case 1: {
                if (options.soft || options.mixed || options.hard || options.merge) {
                    mode = 2;
                    break;
                }
                var cm = repo.commit(paths[0]);
                if (!!cm) {
                    mode = 2;
                    targetCommit = cm;
                } else {
                    mode = 1;
                }
                break;
            }
            default: {
                mode = 1;
                break;
            }
        }

        let givenCommit = paths.length > 0 ? Client.resolveWhat(repo, paths[0]).commit : null;
        var targetCommit = givenCommit || repo.head.commit;
        if (!targetCommit) {
            log.error('no target commit found, working in an empty repository?');
            return;
        }
        if (!!givenCommit) paths.shift();

        if (mode == 1) {
            if (!!givenCommit) {
                log.info("Git-specific behavior");
                log.log(resetCommitGivenHint);
            }

            Client.resetFirstMode(repo, paths, targetCommit);
        } else {
            let soft = !!options.soft;
            var mixed = !!options.mixed;
            let hard = !!options.hard;
            let merge = !!options.merge;
            if (!soft && !mixed && !hard && !merge) mixed = true;

            Client.resetSecondMode(repo, soft, mixed, hard, merge, targetCommit);
        }
    }

    export function pull(options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let url = conf.get('repo_' + repo.name + '.url');
        if (!url) {
            log.error(`remote address not specified. Use ${colors.bold('jerk config set this.url <url>')} to set remote address to ${colors.italic('<url>')}`);
            return;
        }

        if (!repo.currentBranchName) {
            log.error(`you can not pull in detached HEAD state. Create new branch or use ${colors.bold('jerk fetch')}.`);
            return;
        }

        Client.fetch(repo, url, progressBarCallback(), (success) => {
            if (success) {
                let authorName: string = conf.get('authorName');
                let authorEMail: string = conf.get('authorEMail');
                var noAuthor = !authorName || !authorEMail;
                if (noAuthor) {
                    log.error('either author name or email is not specified!');
                    return;
                }
                let resolved = Client.resolveWhat(repo, 'FETCH_HEAD');
                Client.merge(repo, resolved.commit, 'Remote pull merging commit', authorName, authorEMail);
                log.success('pull finished successfully');
            } else {
                log.error('fetch failed');
            }
        });
    }

    export function push(options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let url = conf.get('repo_' + repo.name + '.url');
        if (!url) {
            log.error(`remote address not specified. Use ${colors.bold('jerk config set this.url <url>')} to set remote address to ${colors.italic('<url>')}`);
            return;
        }

        var mode = conf.get('repo_' + repo.name + '.mode');
        if (!mode) mode = 'rsync';
        if (mode !== 'rsync' && mode !== 'http') {
            log.error(`unknown connection mode. Supported modes are: ${colors.italic('rsync')} and ${colors.italic('http')}`);
            return;
        }

        Client.push(repo, url, mode, () => {
            log.error('cannot push to remote server, pull remote changes and try again.');
        }, progressBarCallback(), (res: Client.PushSuccessState) => {
            switch (res) {
                case Client.PushSuccessState.UP_TO_DATE:
                    log.success('up-to-date!');
                    break;
                case Client.PushSuccessState.CONNECTION_FAILED:
                    log.error('connection to remote failed!');
                    break;
                case Client.PushSuccessState.OK:
                    log.success('push finished successfully!');
                    break;
                case Client.PushSuccessState.FAIL:
                default:
                    log.error('error occured while pushing to remote!');
                    break;
            }
        });
    }

    export function merge(what: string, message: string, options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let res = Client.resolveWhat(repo, what);

        let authorName: string = conf.get('authorName');
        let authorEMail: string = conf.get('authorEMail');
        var noAuthor = !authorName || !authorEMail;
        if (noAuthor) {
            log.error('either author name or email is not specified!');
            return;
        }

        if (!repo.currentBranchName) {
            log.error('you can not merge in detached HEAD state. Create new branch.');
            return;
        }

        let commit = Client.merge(repo, res.commit, message, authorName, authorEMail);

        if (!!commit) {
            log.success('Merge successful!');
        } else {
            log.error("Merge failures occured, see MERGE_*.txt files for details.\n" +
                "Resolve conflicts, stage resolutions and commit to finish merge process.");
        }
    }

    export function fetch(options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let url = conf.get('repo_' + repo.name + '.url');
        if (!url) {
            log.error(`remote address not specified. Use ${colors.bold('jerk config set this.url <url>')} to set remote address to ${colors.italic('<url>')}`);
            return;
        }

        Client.fetch(repo, url, progressBarCallback(), (success) => {
            if (success) {
                log.success('fetch finished successfully');
            } else {
                log.error('fetch failed');
            }
        });
    }
}

program
    .version(colors.rainbow("WIP") + " build");

program
    .command("init")
    .description("Initialize new repo in current working directory")
    .option('-q, --quiet', quietDescription)
    .action(CLI.init);

program
    .command("clone <url>")
    .alias("cl")
    .description("Clone local or remote repo")
    .option('-q, --quiet', quietDescription)
    .action(CLI.clone);

program
    .command('status')
    .description('Show the repository status')
    .option('-q, --quiet', quietDescription)
    .action(CLI.status);

program
    .command('add [files...]')
    .description('Stage files to be commited in the nearest future')
    .option('-A, --all', 'Add all available files to stage')
    .option('-q, --quiet', quietDescription)
    .action(CLI.add);

program
    .command('commit [message]')
    .description('Record staged changes to repository')
    .option('-c, --reedit-message <commit>', commitConfigOptionDescription)
    .option('-C, --reuse-message <commit>', commitConfigOptionDescription)
    .option('--amend',
    'Replace the last commit with a new commit, retaining all changes made, commit time,' +
    ' optionally message and author.')
    .option('--allow-empty', 'Bypass changes count check, allows you to create commits without changes')
    .option('-q, --quiet', quietDescription)
    .action(CLI.commit);

program
    .command('config <op> [args...]')
    .description('Configuration manager')
    .action(CLI.config);

program
    .command('log')
    .description('Show commits log')
    .option('-g, --graph', 'Output as commit graph')
    .option('-f, --format <format>', 'Set output formatting, available options are: oneline|onelineWide|short|medium|full|fuller|format=<...>', /^(oneline|onelineWide|short|medium|full|fuller|format=.*)$/i)
    .option('-q, --quiet', quietDescription)
    .action(CLI.commitLog);

program
    .command('branch [name]')
    .description('List, create or delete branches')
    .option('-a, --all', 'Show all branches')
    .option('-q, --quiet', quietDescription)
    .action(CLI.branch);

program
    .command('checkout <what>')
    .description('Checkout a branch, a tag or a specific commit to the working tree')
    .option('-f, --force', 'Throw away local changes, if any.')
    .option('-q, --quiet', quietDescription)
    .action(CLI.checkout);

program
    .command('rm [file...]')
    .description('Remove files from the index, and optionally from the working tree too')
    .option('-C, --cached', 'Leave working tree unchanged, only remove from the index')
    .option('-D, --deleted', 'Remove locally deleted files from the index')
    .option('-q, --quiet', quietDescription)
    .action(CLI.rm);

program
    .command('reset [paths...]')
    .description('Reset current HEAD to the specified state')
    .option('-q, --quiet', quietDescription)
    .option('--soft', 'Only move HEAD to the specified target')
    .option('--mixed', 'Reset index, but not the working tree (default)')
    .option('--hard', 'Reset the index and the working tree')
    .option('--merge', 'Revert failed merge attempt but keep any other local changes')
    .action(CLI.reset);

program
    .command('pull')
    .description('Fetch and merge remote changes with local branches')
    .option('-q, --quiet', quietDescription)
    .action(CLI.pull);

program
    .command('push')
    .description('Upload local object and ref changes to remote repository')
    .option('-q, --quiet', quietDescription)
    .action(CLI.push);

program
    .command('merge <branch> <message>')
    .description('Join two development histories together and tie them forever to death')
    .option('-q, --quiet', quietDescription)
    .action(CLI.merge);

program
    .command('fetch')
    .description('Download remote objects and refs from remote repository')
    .option('-q, --quiet', quietDescription)
    .action(CLI.fetch);

try {
    program.parse(process.argv);
} catch (e) {
    CLI.log.error('Error:', e);
}
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
