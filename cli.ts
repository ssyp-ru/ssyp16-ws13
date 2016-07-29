#!/usr/bin/env node
import * as colors from 'colors/safe';
import * as child_process from "child_process";
import * as http from "http";
import * as net from 'net';
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

    let rsyncPercentage = /\s+(\d+)%/;
    function rsyncOutputProgressUpdate(stdout: any, bar: any) {
        let s = stdout.toString().trim().split('\r').pop();
        if (rsyncPercentage.test(s)) {
            let perc = parseInt(rsyncPercentage.exec(s)[1]);
            return bar.update(perc / 100);
        }
        return bar.tick(0);
    }

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

    function parseRemoteAddress(url: string): { host: string, port: number } {
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

    function cloneOnConfigFetched(cfg: string) {
        var json: string = fs.readFileSync(cfg, 'utf8');

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
        log.info(repo.name + ':', colors.yellow('' + repo.commits.length), 'commits');
    }

    function cloneOnObjectsFetched() {
        log.info('objects fetched successfully!');
        let repo = new Common.Repo(process.cwd());
        let commit = repo.head.commit;
        if (!!commit) Client.checkout(repo, commit, repo.currentBranch);
        log.success('repository cloned successfully!');
    }

    export function clone(url: string, options: any) {
        if (!!options.quiet) log.silence();
        if (fs.existsSync('.jerk')) {
            return log.error('You can not clone inside existing repository');
        }

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

                let bar = new ProgressBar('  remote [:bar] :percent :etas', { total: 100, clear: true });
                let cp = child_process.spawn("rsync",
                    [`rsync://${remote.host}:${remote.port}/jerk/objects`, '--info=progress2',
                        '-E', '-hhh', '-r', '.jerk']);
                cp.stdout.on('data', (stdout) => {
                    rsyncOutputProgressUpdate(stdout, bar);
                });
                let cpInterval = setInterval(() => bar.tick(0), 100);

                res
                    .on('data', (chunk: Uint8Array) => {
                        let buf = new Buffer(chunk);
                        fs.appendFileSync(cfg, buf);
                    })
                    .on('end', () => {
                        cloneOnConfigFetched(cfg);

                        cp.on('exit', () => {
                            bar.tick(100);
                            clearInterval(cpInterval);
                            cloneOnObjectsFetched();
                        });
                    });
            })
            .on('error', (e) => {
                log.error(e);
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
        var basedOnSomeCommit = false;

        if (!!optionConfig) {
            let lcOption = optionConfig.toLowerCase();
            if (lcOption === "orig_head") {
                oldCommitData = fse.readJsonSync(path.join(repo.root, '.jerk', 'ORIG_HEAD'));
                basedOnSomeCommit = true;
            } else if (lcOption === "head") {
                oldCommitData = fse.readJsonSync(path.join(repo.root, '.jerk', 'HEAD'));
                basedOnSomeCommit = true;
            } else {
                let branch = repo.ref<Common.Ref>(optionConfig);
                if (!!branch) {
                    let cm = repo.commit(branch.head);
                    if (!!cm) {
                        oldCommitData = cm.data();
                        basedOnSomeCommit = true;
                    }
                } else {
                    let cm = repo.commit(optionConfig);
                    if (!!cm) {
                        oldCommitData = cm.data();
                        basedOnSomeCommit = true;
                    }
                }
            }
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

    export function resolveWhat(repo: Common.Repo, what: string): { commit: Common.Commit; ref: Common.Ref } {
        var commit = repo.commit(what);
        var ref = repo.ref<Common.Ref>(what);
        if (!commit && !ref) {
            ref = repo.createRef(what, true);
        }
        if (!commit && !!ref) {
            commit = ref.commit;
        }
        return { commit: commit, ref: ref };
    }

    export function checkout(what: string, options: any) {
        if (!!options.quiet) log.silence();
        var repo = cwdRepo();

        let res = resolveWhat(repo, what);
        if (!res.commit) {
            log.error('Commit or branch to checkout not found!');
            return;
        }

        if (options.force) Client.revertAllWorkingTreeChanges(repo);

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

        let givenCommit = paths.length > 0 ? resolveWhat(repo, paths[0]).commit : null;
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

        let remote = parseRemoteAddress(url);

        fetchConfig(url, (cfg) => {
            if (!cfg) return;

            let bar = new ProgressBar('  remote [:bar] :percent :etas', { total: 100, clear: true });

            let cp = child_process.spawn("rsync",
                [`rsync://${remote.host}:${remote.port}/jerk/objects`, '--info=progress2',
                    '-E', '-hhh', '-r', '-u', '.jerk']);
            cp.stdout.on('data', (stdout) => {
                rsyncOutputProgressUpdate(stdout, bar);
            });
            let cpInterval = setInterval(() => bar.tick(0), 100);

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

            cp.on('exit', (code: number, signal: string) => {
                bar.tick(100);
                clearInterval(cpInterval);
                log.success('pull finished successfully');
            });
        });
    }

    function fastForwardable(repo: Common.Repo, cfg: any): {
        remoteRefs: string[];
        changedRefs: string[];
        remoteCommits: string[]
    } {
        var fastForwardable = true;
        let refs = [];
        let changedRefs = [];
        let commits = [];
        Common.iterateStringKeyObject<string[]>(cfg.refs).forEach(v => {
            if (!fastForwardable) return;
            if (v.key === 'HEAD') return;
            let ref = repo.ref(v.key);
            let val = v.value;
            if (!ref) {
                fastForwardable = false;
                return;
            }
            refs.push(v.key);
            if (ref.head !== val[2]) changedRefs.push(v.key);
            if (ref.time !== parseInt(val[3])) changedRefs.push(v.key);
        });
        if (!fastForwardable) {
            log.error('fast-forward not available, pull remote changes and try again.');
            return null;
        }
        Common.iterateStringKeyObject<string[]>(cfg.commits).forEach(v => {
            if (!fastForwardable) return;
            let commit = repo.commit(v.key);
            let val = v.value;
            if (!commit) {
                fastForwardable = false;
                return;
            }
            commits.push(v.key);
            // ["Commit", this.id, this.message, this.authorName, this.authorEMail,
            // this.parentId, this.time.toString(), JSON.stringify(this._contents),
            // this._mergeOf, JSON.stringify(this.changed)]
            if (commit.id !== val[1]) fastForwardable = false;
            if (commit.message !== val[2]) fastForwardable = false;
            if (commit.authorName !== val[3]) fastForwardable = false;
            if (commit.authorEMail !== val[4]) fastForwardable = false;
            if (commit.parentId !== val[5]) fastForwardable = false;
            if (commit.time !== parseInt(val[6])) fastForwardable = false;
            let data = commit.data();
            if (data[7] !== val[7]) fastForwardable = false;
            if (data[8] !== val[8]) fastForwardable = false;
            if (data[9] !== val[9]) fastForwardable = false;
        });
        if (!fastForwardable) {
            log.error('fast-forward not available, pull remote changes and try again.');
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

    function uploadObjectsRsync(remote: { host: string; port: number }, callback: Function) {
        let bar = new ProgressBar('  sync [:bar] :percent :etas', { total: 100, clear: true });
        let cp = child_process.spawn("rsync",
            [path.join('.jerk', 'objects'), '--info=progress2', '-E', '-hhh',
                '-r', '-u', '--delete-delay', `rsync://${remote.host}:${remote.port}/jerk`]);
        cp.stdout.on('data', (stdout) => {
            rsyncOutputProgressUpdate(stdout, bar);
        });
        let cpInterval = setInterval(() => bar.tick(0), 100);

        cp.on('exit', (code: number, signal: string) => {
            bar.tick(100);
            clearInterval(cpInterval);
            if (code === 0) return callback(true);
            return callback(false);
        });
    }

    function uploadObjectsHTTP(remote: { host: string; port: number }, callback: Function) {
        log.error(`HTTP upload mode not implemented! Use ${colors.italic('rsync')} mode.`);
        /*
        let client = net.createConnection({ host: remote.host, port: remote.port + 4 }, () => {
            log.success('connected to remote...');
            //client.write();
        });
        client.on('data', (data) => {
            console.log(data.toString());
            client.end();
        });
        client.on('end', () => {
            log.success('disconnected from remote');
        });
        */
    }

    function uploadObjects(remote: { host: string; port: number }, mode: string, callback: Function) {
        if (mode === 'rsync') return uploadObjectsRsync(remote, callback);
        if (mode === 'http') return uploadObjectsHTTP(remote, callback);
        throw "Unknown mode type";
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

        fetchConfig(url, (cfg) => {
            if (!cfg) return;
            cfg = JSON.parse(cfg);
            let data = fastForwardable(repo, cfg);
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
                return log.success('up-to-date!');
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
                    log.error('push connection failed');
                    return;
                }
                if (res === 'OK') {
                    uploadObjects(remote, mode, (res) => {
                        if (res) return log.success('push finished successfully!');
                        return log.error('uploading objects failed');
                    });
                    return;
                }
                log.error('remote:', res);
            });
        });
    }
    export function merge(what: string, message: string, options: any) {
        if (!!options.quiet) log.silence();
        let repo = cwdRepo();

        let res = resolveWhat(repo, what);

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

try {
    program.parse(process.argv);
} catch (e) {
    CLI.log.error('Error:', e);
}
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
