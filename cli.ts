#!/usr/bin/node
/// <reference path="log-symbols.d.ts" />
var colors = require('colors/safe');
var program = require('commander');
import * as child_process from "child_process";
var logSymbols = require('log-symbols');
import * as fs from "fs";
import * as path from 'path';
import * as Common from './common';

module CLI {
    export function init(path: string, quiet: boolean = false) {
        fs.stat(path, (err, stats) => {
            if (!!err || !stats) {
                fs.mkdirSync(path);
            }
            var repo = new Common.Repo(path, true, quiet);
            if (!repo && !quiet) {
                console.log("Repository initialization failed!")
            }
        });
    }
}
program
    .version(colors.rainbow("WIP") + " build");
program
    .command("init")
    .description("Initialize new repo in current working directory")
    .option('-q, --quiet', 'Only print error and warning messages, all other output will be suppressed.')
    .action((options) => {
        var q = !!options.quiet;
        CLI.init(process.cwd(), q);
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
        var repo = Common.cwdRepo();
        if (!repo) {
            console.log(colors.dim('JERK'), logSymbols.info, "not currently in a jerk repository.");
            return;
        }
        var mod = 'not modified';
        console.log(colors.dim('JERK'), logSymbols.info,
            colors.blue(repo.name), '>', colors.orange(repo.currentBranchName), '>', colors.bold(mod));
    });
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}