import * as assert from 'assert';
import * as HunkExp from '../hulk_crash';
import * as FS from '../fs';
import * as path from 'path';
import * as FSFunctions from '../fsFunctions';
var nfs = new FSFunctions.FSFunctions();
var createHash = require('sha.js');
var Hunk: HunkExp.Hunk;
var b1, b2: Buffer;
b1 = new Buffer("aaaaa");
b2 = new Buffer("abaaa");
class FakeFSObject {
    constructor(smth: string) { };
    buffer() { return }
}

before(() => {

});
describe("Hulk module", () => {
    /*before(() => {
        try {
            var stat = nfs.stat('.jerk');
        } catch (e) {
            nfs.mkdir('.jerk', 0o755);
        }*/
    describe("Class Diff", () => {
        var fs: FS.IFileSystem;

        beforeEach(() => {
            fs = FS.fs()
        });

        it("get hunks", () => {

            // Короткая версия -- лучший вариант.
            var h = new HunkExp.Hunk(new Buffer("a\nb\nc\n"), new Buffer("a\ne\nb\nc\n"));
            var d = new HunkExp.Diff([h]);

            assert.deepEqual(d.hunks, [h]);
        });
        it("", () => {

            it(".appendHunk", () => {
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
        });
    });


    it(".diffFiles", () => {
        //var fs = FS.fs();
        var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
        var firstFileObject = FS.fs().create(bf1);
        var firstHash = createHash('sha256').update(bf1).digest('hex');
        nfs.writeFile(path.join('.jerk', 'objects', firstHash), bf1);
        var bf2 = new Buffer("Hello, World! Jerk push!");
        var secondFileObject = FS.fs().create(bf1);
        var secondHash = createHash('sha256').update(bf2).digest('hex');
        nfs.writeFile(path.join('.jerk', 'objects', secondHash), bf2);
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

        /*
            first = a,b,c
            second = a,c,b,c
            third = a,b,c,d

            f -> s: a, +c, b, c
            f -> t: a, b, c, +d
        */


        var genFo = str => ({ size: () => str.length, buffer: () => new Buffer(str) })

        var first = genFo("a\nb\nc\n"), second = genFo("a\nc\nb\nc\n"), third = genFo("a\nb\nc\nd\n");

        var d1 = HunkExp.Diff.diffFiles(<any>first, <any>second);
        var d2 = HunkExp.Diff.diffFiles(<any>first, <any>third);

        var res = HunkExp.Diff.merge(d1, d2);

        assert.ok(res instanceof HunkExp.Diff);



        // var Diff1 = HunkExp.Diff.diffFiles(firstFileObject, secondFileObject);
        // var Diff2 = HunkExp.Diff.diffFiles(firstFileObject, secondFileObject);
        // // var words: Buffer[] = [];
        // // words[0] = new Buffer("Artyom");
        // // words[1] = new Buffer("World");
        // // words[2] = new Buffer("commit");
        // // words[3] = new Buffer("push");
        // var conflicts: HunkExp.MergeConflict[] = [];
        // conflicts.push(new HunkExp.MergeConflict(Diff1.hunks[0], Diff2.hunks[0]));
        // conflicts.push(new HunkExp.MergeConflict(Diff1.hunks[1], Diff2.hunks[1]));
        // assert.equal(typeof(HunkExp.Diff.merge(Diff1, Diff2)), typeof(conflicts));
        // assert.deepEqual(HunkExp.Diff.merge(Diff1, Diff2)[0], Diff1.hunks[0]);
    });
});
