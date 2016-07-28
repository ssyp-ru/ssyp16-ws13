#!/usr/bin/node
import * as child_process from "child_process";
import * as nfs from 'fs';
import * as fse from 'fs-extra';
import * as http from "http";
import * as path from 'path';
import * as readline from 'readline';
import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import Configstore = require('configstore');
import fs = require('./fs');
import * as Logger from './log';
import * as Common from './common';
import * as Format from './format';
import * as glob from 'glob';
import * as Moment from 'moment';
let osenv = require('osenv');
let uuid = require('uuid');
let xdgBasedir = require('xdg-basedir');
let osTmpdir = require('os-tmpdir');
let writeFileAtomic = require('write-file-atomic');
let ProgressBar = require('progress');

module Server {
    // Initialize major subsystems
    let log = new Logger.Logger();
    let conf = new Configstore('jerk-server');

    // Create command line prompt
    // let rl = readline.createInterface({
    //     input: process.stdin,
    //     output: process.stdout,
    // });
    let promptString = colors.green("JERK => ");
    // rl.setPrompt(promptString);

    // Configstore options
    let user = (osenv.user() || uuid.v4()).replace(/\\/g, '');
    let configDir = xdgBasedir.config || path.join(osTmpdir(), user, '.config');

    // Current host repo properties
    let repoPath = process.cwd();
    let repoName = repoPath.split(path.sep).pop();
    let repoConfig = `use chroot = no\nread only = no\n\n[jerk]\n\tpath = ${repoPath}\n\tcomment = JERK ${repoName} repository`;
    let configPath = path.join(configDir, 'jerk-server', repoName);

    class ServerRepo extends Common.Repo {
        private _revision: number = 0;
        constructor(rootPath: string) {
            super(rootPath, false);
            this._fs = fs.fs(true);

            var stat: nfs.Stats;
            try {
                stat = nfs.statSync(path.join(this.root, 'config'));
            } catch (e) { }
            if (!stat || !stat.isFile()) {
                this.createBranch('master', null);

                this.saveConfig();

                log.success("repository created successfully!");
                return;
            }

            this._loadConfig();
        }

        get jerkPath(): string { return this.root; }

        get local(): boolean {
            return false;
        }

        saveConfig() {
            var config = {
                defaultBranchName: this._defaultBranchName,
                refs: {},
                commits: {},
                revision: this._revision
            };

            this._refs.iter().forEach(v => {
                config.refs[v.key] = v.value.data();
            });

            this._commits.iter().forEach(v => {
                config.commits[v.key] = v.value.data();
            });

            var json = JSON.stringify(config);
            fse.outputFileSync(path.join(this.jerkPath, 'config'), json);
        }

        protected _loadConfig() {
            var json: string = nfs.readFileSync(path.join(this.jerkPath, 'config'), 'utf8');

            var config: {
                defaultBranchName: string,
                refs: Object,
                commits: Object,
                revision: number
            } = JSON.parse(json);

            this._defaultBranchName = config.defaultBranchName;

            this._refs = Common.loadRefsFromObject(config.refs, this);
            this._commits = Common.loadCommitsFromObject(config.commits, this);

            this._revision = config.revision;
        }

        get currentBranchName(): string { throw 42; }

        set currentBranchName(name: string) { throw 42; }

        get currentBranch(): Common.Branch { throw 42; }

        get detachedHEADID(): string { throw 42; }

        set detachedHEADID(id: string) { throw 42; }

        get detachedHEAD(): Common.Commit { throw 42; }

        get staged(): string[] { throw 42; }

        set staged(paths: string[]) { throw 42; }

        stage(path: string) { throw 42; }

        unstage(path: string) { throw 42; }

        createRemoteRepo(url: string, quiet: boolean = false): Common.Repo { throw 42; }

        get lastCommitID(): string { throw 42; }

        get lastCommit(): Common.Commit { throw 42; }

        writeHEADCommitData() { throw 42; }

        writeORIGHEADCommitData(commit: Common.Commit) { throw 42; }

        applyCommits(commits: Common.StringMap<Common.Commit>) {
            commits.iter().forEach(v => {
                let key = v.key;
                if (!!this._commits.data[key]) throw 'rejected, commit already exists on remote';
                this._commits.data[v.key] = v.value;
            });
        }

        applyRefs(refs: Common.StringMap<Common.Ref>) {
            this._refs.copyFrom(refs);
        }

        get revision(): number { return this._revision; }

        set revision(num: number) {
            this._revision = num;
            this.saveConfig();
        }
    }

    let repo = new ServerRepo(repoPath);

    // rsync daemon process handle
    var rsyncDaemon: child_process.ChildProcess;

    // HTTP Web API
    let html = `<!DOCTYPE html><html><head><title>JERK Repo</title></head><body><h1>"${repo.name}" repository</h1><p>Command to clone this repository:</p><pre><code>jerk clone %hostname%</code></pre></body></html>`
    let server = http.createServer(httpHandle);
    function httpHandle(req: http.IncomingMessage, res: http.ServerResponse) {
        res.statusCode = 200;
        let url = req.url;
        if (url.startsWith("/favicon")) {
            res.end();
            return;
        }
        // log.info(JSON.stringify(req.headers));
        if (url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end(html.replace('%hostname%', req.headers['host']));
            return;
        }
        res.setHeader('Content-Type', 'text/plain');
        if (url === '/config') {
            res.end(nfs.readFileSync(path.join(repo.jerkPath, 'config'), 'utf8'));
            return;
        }
        if (url === '/push') {
            var body = '';
            req.setEncoding('utf8');

            req.on('data', (chunk) => {
                body += chunk;
            });

            req.on('end', () => {
                // log.info('Received push request');
                try {
                    let data = JSON.parse(body);
                    return handlePush(data, req, res);
                } catch (er) {
                    res.statusCode = 400;
                    log.warn('Push failed');
                    return res.end(`error: ${er.message}`);
                }
            });
        }
    }

    function handlePush(data: any, req: http.IncomingMessage, res: http.ServerResponse) {
        // log.info(JSON.stringify(data));
        if (!data.revision && data.revision !== 0) {
            log.warn('Push rejected, revision not specified');
            return res.end('rejected, revision not specified');
        }
        if (data.revision !== repo.revision) {
            log.info('Push rejected, revision mismatch');
            return res.end('rejected, revision mismatch');
        }
        if (!!data.commits) {
            try {
                repo.applyCommits(Common.loadCommitsFromObject(data.commits, null));
            } catch (e) {
                log.error(e);
                return res.end(e);
            }
        }
        if (!!data.refs) {
            repo.applyRefs(Common.loadRefsFromObject(data.refs, null));
        }
        repo.revision++;
        log.success('push successful');
        return res.end('OK');
    }

    export function createRSYNCConfig() {
        log.success("Starting JERK server...");
        try {
            // make sure the folder exists as it
            // could have been deleted in the meantime
            fse.ensureDirSync(path.dirname(configPath));

            writeFileAtomic.sync(configPath, repoConfig);
        } catch (err) {
            // improve the message of permission errors
            if (err.code === 'EACCES') {
                err.message += '\nNo access permission\n';
            }

            throw err;
        }
    }

    export function startRSYNCDaemon() {
        rsyncDaemon = child_process.spawn('rsync',
            ['--daemon', '-v', '--no-detach', '--port=19246', '--config=' + configPath],
            {
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore']
            });
        // rsyncDaemon.unref();
        let hostname = '0.0.0.0';
        let port = 19248;
        server.listen(port, hostname, () => {
            log.success(`Server running at port ${port}...`);
        });
    }

    export function loopRSYNCDaemon() {
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
    }

    export function stop() {
        log.log();
        log.info(`Killing rsync ${colors.red('daemon')}...`)
        rsyncDaemon.kill('SIGTERM');
        server.close();
        log.info(colors.blue("Good night, sweetheart!"));
        process.exit(0);
    }
}

// Execute server startup and loop sequence
Server.createRSYNCConfig();
Server.startRSYNCDaemon();
Server.loopRSYNCDaemon();