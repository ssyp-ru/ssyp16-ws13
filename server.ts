#!/usr/bin/node
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from 'path';
import * as readline from 'readline';
import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';
import Configstore = require('configstore');
import * as Logger from './log';
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
        var out = fs.openSync('./out.log', 'a');
        var err = fs.openSync('./err.log', 'a');
        rsyncDaemon = child_process.spawn('rsync',
            ['--daemon', '-v', '--port=19246', '--config="' + configPath + '"'],
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