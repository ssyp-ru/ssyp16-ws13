var program = require('commander');
var colors = require('colors/safe');
import * as child_process from "child_process";
var logSymbols = require('log-symbols');

console.log(logSymbols.success, 'finished successfully!');
console.log(logSymbols.info, 'there is a trap here!');
console.log(logSymbols.warning, 'done, with warnings!');
console.log(logSymbols.error, 'operation failed!');
//import * as commander from 'commander';
module CLI {
    function main(params: string[]) {

    }
}
program
    .version(colors.rainbow("dev") + " build");
program
    .command("init")
    .description("Initialize new repo in current working directory")
    .action((env, options) => {
        console.log('init');
    });
program
    .command("clone <url>")
    .alias("cl")
    .description("Clone local or remote repo")
    .action((url, options) => {
        console.log(url);
        child_process.execFile("rsync", ['rsync://127.1:19246/git'], (err, stdout, stderr) => {
            if (!!err) console.log(err);
            if (!!stdout) console.log(stdout);
            if (!!stderr) console.log(stderr);
        });
    });
program
    .command('status')
    .action((env) => {
        console.log("status");
    });
program.parse(process.argv);