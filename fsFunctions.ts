import * as nfs from 'fs';
import * as FS from './fs';

module FSFunctions {
    export class FSFunctions {
        stat(path) { try { return nfs.statSync(path); } catch(e) { return null; } }
        mkdir(path, num) { try { return nfs.mkdirSync(path, num); } catch(e) { return null; } }
        writeFile(path, buffer, modeNum) { try { return nfs.writeFileSync(path, buffer, { mode: modeNum }); } catch(e) { return null; } }
        readFile(path, code) { try { return nfs.readFileSync(path, code); } catch(e) { return null; } }
        readdir(path) { try { var fs = FS.fs(); return nfs.readdirSync(path).filter(v => v.length > 60).map(v => fs.resolveObjectByHash(v)); } catch(e) { return null; } }
    }
}
export = FSFunctions;