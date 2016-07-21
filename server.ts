import * as child_process from "child_process";
import * as fs from "fs";
import * as readline from 'readline';
module Server {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.setPrompt("JERK => ");

    var rsyncDaemon: child_process.ChildProcess;

    export function createRSYNCConfigIfNeeded() {
        fs.stat("rsyncd.conf", (err, stats) => {
            if (!!err || !stats) {
                createRSYNCConfig();
            }
        });
    }
    export function createRSYNCConfig() {
        console.log("Creating rsync config...");
        fs.appendFileSync('rsyncd.conf', 'use chroot = no\n\n[git]\n\tpath = ' + process.cwd());
    }
    export function startRSYNCDaemon() {
        var out = fs.openSync('./out.log', 'a');
        var err = fs.openSync('./err.log', 'a');
        console.log("starting...");
        rsyncDaemon = child_process.spawn('rsync',
            ['--daemon', '-v', '--port=19246', '--config=rsyncd.conf'],
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
        console.log("Killing rsync daemon...")
        rsyncDaemon.kill('SIGTERM');
        console.log("Good night, sweetheart!");
        process.exit(0);
    }
}
console.log("Starting JERK server...");
Server.createRSYNCConfigIfNeeded();
Server.startRSYNCDaemon();
Server.loopRSYNCDaemon();