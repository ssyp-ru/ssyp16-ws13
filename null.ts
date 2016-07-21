/**
 * CLI Function implementation
 */
import * as fs from "fs";
import * as Common from "./common";
export function init(path: string, quiet: boolean = false)
{ 
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
export function add(dryRun: boolean = false,
    verbose: boolean = false, force: boolean = false, ignoreErrors = false,
    ...paths: string[])
{
    
}
export function rm(dryRun: boolean = false, cached: boolean = false,
    force: boolean = false, quiet: boolean = false,
    ...paths: string[])
{ throw "Not Implemented"; }
export function commit(message: string = null,
    authorName: string = null, authorEMail: string = null,
    quiet: boolean = false, verbose: boolean = false)
{ throw "Not Implemented"; }
export enum CloneLocalMode {
    AUTO, REMOTE, LOCAL, LOCAL_NO_HARDLINKS
}
export function clone(url: string, path: string, local: CloneLocalMode = CloneLocalMode.AUTO,
    quiet: boolean = false, verbose: boolean = false, bare: boolean = false,
    mirror: boolean = false, branch: string = null, recurse: boolean = true)
{ throw "Not Implemented"; }