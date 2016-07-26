#!/usr/bin/node
import * as child_process from "child_process";
import * as nfs from 'fs';
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
let mkdirp = require('mkdirp');
let uuid = require('uuid');
let xdgBasedir = require('xdg-basedir');
let osTmpdir = require('os-tmpdir');
let writeFileAtomic = require('write-file-atomic');

module Server {
    // Initialize major subsystems
    let log = new Logger.Logger();
    let conf = new Configstore('jerk-server');

    // Create command line prompt
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.setPrompt(colors.green("JERK => "));

    // Configstore options
    let user = (osenv.user() || uuid.v4()).replace(/\\/g, '');
    let configDir = xdgBasedir.config || path.join(osTmpdir(), user, '.config');
    let defaultPathMode = 0o755;
    let writeFileOptions = { mode: 0o644 };

    // Current host repo properties
    let repoPath = process.cwd();
    let repoName = repoPath.split(path.sep).pop();
    let repoConfig = 'use chroot = no\n\n[git]\n\tpath = ' + repoPath;
    let configPath = path.join(configDir, 'jerk-server', repoName);

    class ServerRepo extends Common.Repo {
        constructor(rootPath: string, quiet: boolean = false) {
            super(rootPath, false, quiet);
            this.fs = fs.fs(true);

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
    }

    let repo = Common.cwdRepo();

    // rsync daemon process handle
    var rsyncDaemon: child_process.ChildProcess;

    export function createRSYNCConfig() {
        log.success("Starting JERK server...");
        try {
            // make sure the folder exists as it
            // could have been deleted in the meantime
            mkdirp.sync(path.dirname(configPath), defaultPathMode);

            writeFileAtomic.sync(configPath, repoConfig, writeFileOptions);
        } catch (err) {
            // improve the message of permission errors
            if (err.code === 'EACCES') {
                err.message += '\nNo access permission\n';
            }

            throw err;
        }
    }

    export function startRSYNCDaemon() {
        var out = nfs.openSync('./out.log', 'a');
        var err = nfs.openSync('./err.log', 'a');
        rsyncDaemon = child_process.spawn('rsync',
            ['--daemon', '-v', '--port=19246', '--config="' + configPath + '"'],
            {
                detached: true,
                stdio: ['ignore', out, err]
            });
        rsyncDaemon.unref();
        let hostname = '127.0.0.1';
        let port = 19247;
        const server = http.createServer((req, res) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Hello World\n');
        });
        server.listen(port, hostname, () => {
            console.log(`Server running at http://${hostname}:${port}/`);
        });
    }

    export function loopRSYNCDaemon() {
        rl.prompt();
        rl.on('line', (line: string) => {
            switch (line.trim()) {
                case 'exit':
                case 'stop':
                case 'kill': {
                    stop();
                    return;
                }
            }
            rl.prompt();
        })
            .on('SIGINT', stop)
            .on('SIGTERM', stop);
    }

    export function stop() {
        rl.pause();
        rl.close();
        log.log();
        log.info(`Killing rsync ${colors.red('daemon')}...`)
        rsyncDaemon.kill('SIGTERM');
        log.info(colors.blue("Good night, sweetheart!"));
        process.exit(0);
    }
}

// Execute server startup and loop sequence
Server.createRSYNCConfig();
Server.startRSYNCDaemon();
Server.loopRSYNCDaemon();