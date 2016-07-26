declare module "fs-extra" {
    import fs = require("fs");
    interface Callback {
        (err: Error);
    }
    export function copy(src: string, dest: string, options?: { clobber?: boolean, preserveTimestamps?: boolean }, callback?: Callback);
    export function copySync(src: string, dest: string, options?: { clobber?: boolean, preserveTimestamps?: boolean });
    export function createOutputStream(file: string, options?: Object): fs.WriteStream;
    export function emptyDir(dir: string, callback?: Callback);
    export function emptydir(dir: string, callback?: Callback);
    export function emptyDirSync(dir: string);
    export function emptydirSync(dir: string);
    export function ensureFile(file: string, callback: Callback);
    export function ensureDir(dir: string, callback: Callback);
    export function createFile(file: string, callback: Callback);
    export function ensureFileSync(file: string);
    export function ensureDirSync(dir: string);
    export function createFileSync(file: string);
    export function ensureLink(srcpath: string, dstpath: string, callback: Callback);
    export function ensureLinkSync(srcpath: string, dstpath: string);
    export function ensureSymlink(srcpath: string, dstpath: string, type?: any, callback?: Callback);
    export function ensureSymlinkSync(srcpath: string, dstpath: string, type?: any);
    export function mkdirs(dir: string, callback: Callback);
    export function mkdirp(dir: string, callback: Callback);
    export function mkdirsSync(dir: string);
    export function mkdirpSync(dir: string);
    export function move(src: string, dest: string, options?: { clobber?: boolean, limit?: number }, callback?: Callback);
    export function outputFile(file: string, data: any, callback: Callback);
    export function outputFileSync(file: string, data: any);
    export function outputJson(file: string, data: any, options?: Object, callback?: Callback);
    export function outputJSON(file: string, data: any, options?: Object, callback?: Callback);
    export function outputJsonSync(file: string, data: any, options?: Object);
    export function outputJSONSync(file: string, data: any, options?: Object);
    export function readJson(file: string, options?: Object, callback?: Callback);
    export function readJSON(file: string, options?: Object, callback?: Callback);
    export function readJsonSync(file: string, options?: Object);
    export function readJSONSync(file: string, options?: Object);
    export function remove(dir: string, callback: Callback);
    export function removeSync(dir: string);
    export function deleteSync(dir: string);
    export function writeJson(file: string, object: any, options?: Object, callback?: Callback);
    export function writeJSON(file: string, object: any, options?: Object, callback?: Callback);
    export function writeJsonSync(file: string, object: any, options?: Object);
    export function writeJSONSync(file: string, object: any, options?: Object);
}