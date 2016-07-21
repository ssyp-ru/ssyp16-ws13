import * as child_process from "child_process";
import * as fs from "fs";
import * as readline from 'readline';
module Server {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    // rl.setPrompt("JERK => ");

    rl.setPrompt("");

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
        rsyncDaemon = child_process.spawn('strace',
            ['rsync', '--daemon', '-v', '--no-detach', '--port=19246', '--config=rsyncd.conf']);
        rsyncDaemon.stdout.on('data', d => console.log(d.toString()));
        rsyncDaemon.stderr.on('data', d => console.error(d.toString()));

        rsyncDaemon.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        });


            // (err, stdout, stderr) => {
            //     console.log(stdout);
            //     console.error(stderr);
            //     if (err) {
            //         console.error(err);
            //         return;
            //     }
            // });
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

// subprocess.call(shlex.split('rsync --daemon -v --no-detach --port=19246 --config=rsyncd.conf'))