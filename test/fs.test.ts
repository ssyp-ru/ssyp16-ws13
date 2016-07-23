import * as nfs from 'fs';
import * as path from 'path';
import * as FS from '../fs';
import * as assert from 'assert';
var createHash = require('sha.js');

describe("File System", () => {
    before(() => {
        process.chdir("");
    });
    describe("Class FSImplementation implements IFileSystem", () => {
        it(".create", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update("Hello").digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), firstFileObject);
            /*var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update("World").digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondFileObject);*/
        });

        it(".symlink", () => {
            var fs = FS.fs();
            var path1 = "Hello";
            var firstSymlinkObject = fs.symlink(path1);
            var firstHash = createHash('sha256').update("Hello").digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, path1, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), firstSymlinkObject);
            /*var path2 = new String("World");
            var secondFileSymlink = fs.symlink(path2);
            var secondHash = createHash('sha256').update("World").digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, path2, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondSymlinkObject);*/
        });


        it(".resolveObjectByHash", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update("Hello").digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), fs.resolveObjectByHash(firstHash));
            /*var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update("World").digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), fs.resolveObjectByHash(secondHash));*/
        });

        it(".resolveObjectByContents", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update("Hello").digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), fs.resolveObjectByContents(bf1));
            /*var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update("World").digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), fs.resolveObjectByContents(bf2));*/
        });

        it(".entries", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update("Hello").digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update("World").digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
            assert.deepEqual(nfs.readdirSync('.jerk').filter(v => v.length > 60).map(v => fs.resolveObjectByHash(v)), fs.entries());
        });

        it(".remove", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update("Hello").digest('hex');
            var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update("World").digest('hex');
            /*assert.doesNotThrow(() => fs.remove(firstHash));
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), undefined);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondFileObject);
            assert.throws(() => fs.remove(firstHash), /err/);*/
            assert.equal(fs.remove(firstHash), true);
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), undefined);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondFileObject);
            assert.equal(fs.remove(firstHash), false);
        });
    });
});