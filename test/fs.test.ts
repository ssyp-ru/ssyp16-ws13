import * as FSFunctions from '../fsFunctions';
import * as FS from '../fs';
import * as assert from 'assert';
var createHash = require('sha.js');
var nfs = new FSFunctions.FSFunctions();

describe("File System", () => {
    before(() => {
        try {
            var stat = nfs.statSync('.jerk');
        } catch (e) {
            nfs.mkdirSync('.jerk', 0o755);
        }
    });

    describe("Class FSImplementation implements IFileSystem", () => {
        it(".create", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, 0o644);
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), bf1.toString());
            /*var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, 0o644);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondFileObject);*/
        });

        it(".symlink", () => {
            var fs = FS.fs();
            var path1 = "Hello";
            var firstSymlinkObject = fs.symlink(path1);
            var firstHash = createHash('sha256').update(path1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, path1, 0o644);
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), path1);
            /*var path2 = new String("World");
            var secondFileSymlink = fs.symlink(path2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, path2, 0o644);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondSymlinkObject);*/
        });


        it(".resolveObjectByHash", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, 0o644);
            assert.deepEqual(fs.resolveObjectByHash(firstHash), firstFileObject);
            /*var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, 0o644);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), fs.resolveObjectByHash(secondHash));*/
        });

        it(".resolveObjectByContents", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, 0o644);
            assert.deepEqual(fs.resolveObjectByContents(bf1), firstFileObject);
            /*var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, 0o644);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), fs.resolveObjectByContents(bf2));*/
        });

        it(".entries", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, 0o644);
            var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, 0o644);
            assert.deepEqual(nfs.readdirSync('.jerk'), fs.entries());
        });

        it(".remove", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            /*assert.doesNotThrow(() => fs.remove(firstHash));
            assert.deepEqual(nfs.readFileSync('.jerk/' + firstHash, 'utf8'), undefined);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), secondFileObject);
            assert.throws(() => fs.remove(firstHash), /err/);*/
            assert.equal(fs.remove(firstHash), true);
            assert.deepEqual(nfs.readFileSync('.jerk/' + secondHash, 'utf8'), bf2.toString());
        });
    });

    describe("Classes 'FObject' + 'SObject' implements FileObject", () => {
        it(".buffer", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(bf1, fileObject.buffer());
        });

        it(".size", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(bf1.length, fileObject.size());
        });
        
        it(".symlinkPath", () => {
            var fs = FS.fs();
            var path1 = "Hello";
            var symlinkObject = fs.symlink(path1);
            var hash = createHash('sha256').update(path1, 'utf8').digest('hex');
            assert.deepEqual(path1, symlinkObject.symlinkPath());
        });

        it(".hash", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(hash, fileObject.hash());
        });

        it(".fullPath", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual('.jerk/' + hash, fileObject.fullPath());
        });

        it(".isFile", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var fileHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(true, fileObject.isFile());
            var path1 = "Hello";
            var symlinkObject = fs.symlink(path1);
            var objectHash = createHash('sha256').update(path1).digest('hex');
            assert.deepEqual(false, symlinkObject.isFile());
        });

        it(".isSymlink", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var fileHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(false, fileObject.isSymlink());
            var path1 = "Hello";
            var symlinkObject = fs.symlink(path1);
            var objectHash = createHash('sha256').update(path1).digest('hex');
            assert.deepEqual(true, symlinkObject.isSymlink());
        });

        it(".asFile", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var fileHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(fileObject, fileObject.asFile());
            var path1 = "Hello";
            var symlinkObject = fs.symlink(path1);
            var objectHash = createHash('sha256').update(path1).digest('hex');
            assert.deepEqual(null, symlinkObject.asFile());
        });

        it(".asSymlink", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var fileHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(null, fileObject.asSymlink());
            var path1 = "Hello";
            var symlinkObject = fs.symlink(path1);
            var objectHash = createHash('sha256').update(path1).digest('hex');
            assert.deepEqual(symlinkObject, symlinkObject.asSymlink());
        });
    });
});