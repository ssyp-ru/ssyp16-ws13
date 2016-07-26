import * as nfs from 'fs';
import * as FS from './fs';

module FSFunctions {
    export class FSFunctions {
        stat(path) { return nfs.statSync(path); }
        mkdir(path, num) { return nfs.mkdirSync(path, num); }
        writeFile(path, buffer, modeNum) { return nfs.writeFileSync(path, buffer, { mode: modeNum }); }
        readFile(path, code) { return nfs.readFileSync(path, code); }
        readdir(path) { var fs = FS.fs(); return nfs.readdirSync(path).filter(v => v.length > 60).map(v => fs.resolveObjectByHash(v)); }
    }
}
export = FSFunctions;