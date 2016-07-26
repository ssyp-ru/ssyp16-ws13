import * as assert from 'assert';
import * as HunkExp from '../hulk_crash';
import * as FS from '../fs';
import * as FSFunctions from '../fsFunctions';
var nfs = new FSFunctions.FSFunctions();
var createHash = require('sha.js');

describe("Hulk module", () => {
    /*before(() => {
        try {
            var stat = nfs.stat('.jerk');
        } catch (e) {
            nfs.mkdir('.jerk', 0o755);
        }*/
    describe("Class Diff", () => {
        it("get hunks", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFile('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFile('.jerk/' + secondHash, bf2, { mode: 0o644 });
            var hunks: HunkExp.Hunk[] = [];
            var words: Buffer[] = [];
            words[0] = new Buffer("Artyom");
            words[1] = new Buffer("World");
            words[2] = new Buffer("commit");
            words[3] = new Buffer("push");
            hunks.push(new HunkExp.Hunk(words[0], words[1]));
            hunks.push(new HunkExp.Hunk(words[2], words[3]));
            var diff = new HunkExp.Diff(hunks);
            assert.deepEqual(hunks, diff.hunks);
        });

        it(".appendHunk", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFile('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFile('.jerk/' + secondHash, bf2, { mode: 0o644 });
            var hunks: HunkExp.Hunk[] = [];
            var words: Buffer[] = [];
            words[0] = new Buffer("Artyom");
            words[1] = new Buffer("World");
            words[2] = new Buffer("commit");
            words[3] = new Buffer("push");
            hunks.push(new HunkExp.Hunk(words[0], words[1]));
            var diff = new HunkExp.Diff(hunks);
            diff.appendHunk(new HunkExp.Hunk(words[2], words[3]));
            assert.deepEqual(hunks, diff.hunks);
        });

        it(".diffFiles", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFile('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFile('.jerk/' + secondHash, bf2, { mode: 0o644 });
            var hunks: HunkExp.Hunk[] = [];
            var diff = new HunkExp.Diff(hunks);
            var words: Buffer[] = [];
            words[0] = new Buffer("Artyom");
            words[1] = new Buffer("World");
            words[2] = new Buffer("commit");
            words[3] = new Buffer("push");
            hunks.push(new HunkExp.Hunk(words[0], words[1]));
            hunks.push(new HunkExp.Hunk(words[2], words[3]));
            assert.deepEqual(HunkExp.Diff.diffFiles(firstFileObject, secondFileObject)[0], new HunkExp.Diff(hunks)[0]);
        });

        it(".merge", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFile('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFile('.jerk/' + secondHash, bf2, { mode: 0o644 });
            var hunks: HunkExp.Hunk[] = [];
            var Diff1 = HunkExp.Diff.diffFiles(firstFileObject, secondFileObject);
            var Diff2 = HunkExp.Diff.diffFiles(firstFileObject, secondFileObject);
            var words: Buffer[] = [];
            words[0] = new Buffer("Artyom");
            words[1] = new Buffer("World");
            words[2] = new Buffer("commit");
            words[3] = new Buffer("push");
            var conflicts: HunkExp.MergeConflict[] = [];
            conflicts.push(new HunkExp.MergeConflict(Diff1.hunks[0], Diff2.hunks[0]));
            conflicts.push(new HunkExp.MergeConflict(Diff1.hunks[1], Diff2.hunks[1]));
            assert.equal(typeof(HunkExp.Diff.merge(Diff1, Diff2)), typeof(conflicts));
            assert.deepEqual(HunkExp.Diff.merge(Diff1, Diff2)[0], Diff1.hunks[0]);
        });
    });
});