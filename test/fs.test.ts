import * as FSFunctions from '../fsFunctions';
import * as FS from '../fs';
import * as nfs from 'fs';
import * as assert from 'assert';
import * as path from 'path';
import * as fse from 'fs-extra';
import * as Logger from '../log';
let log = new Logger.Logger();
var createHash = require('sha.js');
var fsf = new FSFunctions.FSFunctions();

describe("File System", () => {
    it('creates working directory', () => {
        log.silence();
        fse.ensureDirSync('mocha-tests');
        process.chdir('mocha-tests');
    });
    let objdir = path.join('.jerk', 'objects');
    let fs = FS.fs();
    describe("Class FSImplementation implements IFileSystem", () => {
        it(".create", () => {
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(fsf.readFile(path.join(objdir, firstHash), 'utf8'), bf1.toString());
            assert.deepEqual(firstFileObject.buffer().toString(), bf1.toString());
        });

        it(".symlink", () => {
            var path1 = "Hello";
            var firstSymlinkObject = fs.symlink(path1);
            var firstHash = createHash('sha256').update(path1).digest('hex');
            assert.deepEqual(fsf.readFile(path.join(objdir, firstHash + '.symlink'), 'utf8'), path1);
            assert.deepEqual(firstSymlinkObject.symlinkPath(), path1);
        });

        it(".resolveObjectByHash", () => {
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(fs.resolveObjectByHash(firstHash), firstFileObject);
        });

        it(".resolveObjectByContents", () => {
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(fs.resolveObjectByContents(bf1), firstFileObject);
        });

        it(".entries", () => {
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            assert.deepEqual(fsf.readdir(path.join(objdir)), fs.entries());
        });

        it(".remove", () => {
            var bf1 = new Buffer("Hello");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            var bf2 = new Buffer("World");
            var secondFileObject = fs.create(bf2);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            assert.equal(fs.remove(firstHash), true);
            assert.deepEqual(fsf.readFile(path.join(objdir, secondHash), 'utf8'), bf2.toString());
        });
    });

    describe("Classes 'FObject' + 'SObject' implements FileObject", () => {
        it(".buffer", () => {
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(bf1, fileObject.buffer());
        });

        it(".size", () => {
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(bf1.length, fileObject.size());
        });

        it(".symlinkPath", () => {
            var path1 = "Hello";
            var symlinkObject = fs.symlink(path1);
            var hash = createHash('sha256').update(path1, 'utf8').digest('hex');
            assert.deepEqual(path1, symlinkObject.symlinkPath());
        });

        it(".hash", () => {
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(hash, fileObject.hash());
        });

        it(".fullPath", () => {
            var bf1 = new Buffer("Hello");
            var fileObject = fs.create(bf1);
            var hash = createHash('sha256').update(bf1).digest('hex');
            assert.deepEqual(path.join(objdir, hash), fileObject.fullPath());
        });

        it(".isFile", () => {
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
    after(() => {
        process.chdir('..');
        fse.deleteSync('mocha-tests');
    });
});