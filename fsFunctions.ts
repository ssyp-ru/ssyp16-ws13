import * as nfs from 'fs';
import * as fse from 'fs-extra';
import * as FS from './fs';

module FSFunctions {
    export class FSFunctions {
        stat(path: string) {
            try {
                return nfs.statSync(path);
            } catch (e) {
                return null;
            }
        }
        lstat(path: string) {
            try {
                return nfs.lstatSync(path);
            } catch (e) {
                return null;
            }
        }
        mkdir(path: string, mode?: number) {
            try {
                return nfs.mkdirSync(path, mode);
            } catch (e) {
                return null;
            }
        }
        writeFile(path: string, buffer: string | Buffer) {
            try {
                return fse.outputFileSync(path, buffer);
            } catch (e) {
                return null;
            }
        }
        readFile(path: string, encoding: string): string {
            try {
                return nfs.readFileSync(path, encoding);
            } catch (e) {
                return null;
            }
        }
        readdir(path: string): FS.IFileSystemObject[] {
            try {
                var fs = FS.fs();
                return nfs.readdirSync(path)
                    .filter(v => v.length > 60)
                    .map(v => fs.resolveObjectByHash(v));
            } catch (e) {
                return null;
            }
        }
    }
}
export = FSFunctions;