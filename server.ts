#!/usr/bin/node
/// <reference path="log-symbols.d.ts" />
/// <reference path="colors.d.ts" />
/// <reference path="configstore.d.ts" />
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from 'path';
import * as readline from 'readline';
import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import Configstore = require('configstore');
import {error, warn, success, info, silence, header, log} from './log';
var osenv = require('osenv');
var mkdirp = require('mkdirp');
var uuid = require('uuid');
var xdgBasedir = require('xdg-basedir');
var osTmpdir = require('os-tmpdir');
var writeFileAtomic = require('write-file-atomic');

const conf = new Configstore('jerk-server');
module Server {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.setPrompt(colors.green("JERK => "));

    var user = (osenv.user() || uuid.v4()).replace(/\\/g, '');
    var configDir = xdgBasedir.config || path.join(osTmpdir(), user, '.config');
    var defaultPathMode = 0o755;
    var writeFileOptions = { mode: 0o644 };


    let repoPath = process.cwd();
    let repoName = repoPath.split(path.sep).pop();

    function repoConfig() {
        return 'use chroot = no\n\n[git]\n\tpath = ' + repoPath;
    }
    function configPath(): string {
        let pathPrefix = path.join('jerk-server', repoName);
        let confPath = path.join(configDir, pathPrefix);
        return confPath;
    }
    function installConfig() {
        let confPath = configPath();
        try {
            // make sure the folder exists as it
            // could have been deleted in the meantime
            mkdirp.sync(path.dirname(confPath), defaultPathMode);

            writeFileAtomic.sync(confPath, repoConfig(), writeFileOptions);
        } catch (err) {
            // improve the message of permission errors
            if (err.code === 'EACCES') {
                err.message += '\nNo access permission\n';
            }

            throw err;
        }
    }

    var rsyncDaemon: child_process.ChildProcess;

    export function createRSYNCConfig() {
        installConfig();
    }
    export function startRSYNCDaemon() {
        var out = fs.openSync('./out.log', 'a');
        var err = fs.openSync('./err.log', 'a');
        rsyncDaemon = child_process.spawn('rsync',
            ['--daemon', '-v', '--port=19246', '--config="' + configPath() + '"'],
            {
                detached: true,
                stdio: ['ignore', out, err]
            });
        rsyncDaemon.unref();
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
        }).on('SIGINT', stop).on('SIGTERM', stop);
    }

    export function stop() {
        rl.pause();
        rl.close();
        log();
        info(`Killing rsync ${colors.red('daemon')}...`)
        rsyncDaemon.kill('SIGTERM');
        info(colors.blue("Good night, sweetheart!"));
        process.exit(0);
    }
}
success("Starting JERK server...");
Server.createRSYNCConfig();
Server.startRSYNCDaemon();
Server.loopRSYNCDaemon();