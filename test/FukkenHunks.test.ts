import * as assert from 'assert';
import * as HunkExp from '../hulk_crash';
import * as FS from '../fs';
import * as FSFunctions from '../fsFunctions';
var nfs = new FSFunctions.FSFunctions();
var createHash = require('sha.js');

describe("Hulk module", () => {
    /*before(() => {
        try {
            var stat = nfs.statSync('.jerk');
        } catch (e) {
            nfs.mkdirSync('.jerk', 0o755);
        }*/
    describe("Class Diff", () => {
        it("get hunks", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
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
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
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
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
            var hunks: HunkExp.Hunk[] = [];
            var diff = new HunkExp.Diff(hunks);
            var words: Buffer[] = [];
            words[0] = new Buffer("Artyom");
            words[1] = new Buffer("World");
            words[2] = new Buffer("commit");
            words[3] = new Buffer("push");
            hunks.push(new HunkExp.Hunk(words[0], words[1]));
            hunks.push(new HunkExp.Hunk(words[2], words[3]));
            assert.deepEqual(HunkExp.Diff.diffFiles(firstFileObject, secondFileObject), new HunkExp.Diff(hunks));
        });

        it(".merge", () => {
            var fs = FS.fs();
            var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
            var firstFileObject = fs.create(bf1);
            var firstHash = createHash('sha256').update(bf1).digest('hex');
            nfs.writeFileSync('.jerk/' + firstHash, bf1, { mode: 0o644 });
            var bf2 = new Buffer("Hello, World! Jerk push!");
            var secondFileObject = fs.create(bf1);
            var secondHash = createHash('sha256').update(bf2).digest('hex');
            nfs.writeFileSync('.jerk/' + secondHash, bf2, { mode: 0o644 });
            var hunks: HunkExp.Hunk[] = [];
            var diff = new HunkExp.Diff(hunks);
            var words: Buffer[] = [];
            words[0] = new Buffer("Artyom");
            words[1] = new Buffer("World");
            words[2] = new Buffer("commit");
            words[3] = new Buffer("push");

            //assert.deepEqual(HunkExp.Diff.merge());
        });
        /*
                it("checks MergeConflict", () => {
                    var Diff1 = new Hulk.Diff(fs0, fs1);
                    var Diff2 = new HunkExp.Diff(fs1, fs2);
                    assert.ok(typeof(Hulk.Diff.merge(Diff1,Diff2)) === typeof(Hulk.MergeConflict))
                    assert.equal(Hulk.Diff.merge(Diff1, Diff2)[0].base, Diff1.hunks[0]);
                })
        */
    });
});