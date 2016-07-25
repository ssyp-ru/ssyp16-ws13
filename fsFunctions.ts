import * as nfs from 'fs';
import * as FS from './fs';

module FSFunctions {
    export class FSFunctions {
        statSync(path) { return nfs.statSync(path); }
        mkdirSync(path, num) { return nfs.mkdirSync(path, num); }
        writeFileSync(path, buffer, modeNum) { return nfs.writeFileSync(path, buffer, { mode: modeNum }); }
        readFileSync(path, code) { return nfs.readFileSync(path, code); }
        readdirSync(path) { var fs = FS.fs(); return nfs.readdirSync(path).filter(v => v.length > 60).map(v => fs.resolveObjectByHash(v)); }
    }
}
export = FSFunctions;