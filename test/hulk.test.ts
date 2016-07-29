import * as assert from 'assert'
import * as Hulk from '../hulk'

describe("Hulk", () => {
    describe("#diff", () => {
        it("returns null on equal buffers", () => {
            var buffer = new Buffer("a\nb\nc\nd\n");
            var diff = Hulk.Diff.diff(buffer, buffer);
            assert.equal(diff, null);
        });
        it("correctly removes strings when they are not needed", () => {
            var first = "a\nb\nc\nd\n", second = "a\nb\nc\n";
            var firstBuffer = new Buffer(first), secondBuffer = new Buffer(second);
            var diff = Hulk.Diff.diff(firstBuffer, secondBuffer);
            assert.ok(diff);
            assert.equal(diff.hunks[0].type, Hulk.HunkOperation.Remove);
            assert.equal(diff.hunks[0].line, 3);
        });
        it("returns null on 2 empty files", () => {
            var first = "", second = "";
            var diff = Hulk.Diff.diff(new Buffer(first), new Buffer(second));
            assert.ok(!diff);
        });
        // it("changes one string to another", () => { });
        // it("adds strings when they are provided in new file", () => { });
    });

    describe("merge", () => {
        it("return diff", () => {
            var left = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'some other code', Hulk.HunkOperation.Add)]);
            var right = new Hulk.Diff([
                new Hulk.Hunk(2, 'something', Hulk.HunkOperation.Add),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var corect = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(2, 'something', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'some other code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var result = Hulk.merge(right, left);
            assert.deepEqual(corect, result);
        });

        it("return conflict", () => {
            var left = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(2, 'some other code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'something', Hulk.HunkOperation.Remove),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var right = new Hulk.Diff([
                new Hulk.Hunk(2, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'some other code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(6, 'something', Hulk.HunkOperation.Remove),
                new Hulk.Hunk(5, 'some redcocode', Hulk.HunkOperation.Add)]);
            var result = Hulk.merge(right, left);
            assert.deepEqual(result.conflicted, true);
        });

        it("merge 2 empty diffs", () => {
            var left = new Hulk.Diff([]);
            var right = new Hulk.Diff([]);
            var corect = new Hulk.Diff([]);
            var result = Hulk.merge(right, left);
            assert.deepEqual(corect, result);
        });

        it("merge empty diff and some other", () => {
            var left = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(2, 'some other code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'something', Hulk.HunkOperation.Remove),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var right = new Hulk.Diff([]);
            var corect = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(2, 'some other code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'something', Hulk.HunkOperation.Remove),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var result = Hulk.merge(right, left);
            assert.deepEqual(corect, result);
        });

        it("merge 2 across diffs", () => {
            var left = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var right = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(2, 'some other code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(3, 'something', Hulk.HunkOperation.Remove),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var result = Hulk.merge(right, left);
            assert.deepEqual(right, result);
        });

        it("merge 2 equals diffs", () => {
            var left = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var right = new Hulk.Diff([
                new Hulk.Hunk(1, 'some code', Hulk.HunkOperation.Add),
                new Hulk.Hunk(4, 'some redcocode', Hulk.HunkOperation.Add)]);
            var result = Hulk.merge(right, left);
            assert.deepEqual(right, result);
        });
    });

    describe("Class Diff", () => {
        it("get hunks", () => {
            // Короткая версия -- лучший вариант.
            var h = Hulk.Diff.diff(new Buffer("a\nb\nc\n"), new Buffer("a\ne\nb\nc\n"));
            var d = [
                new Hulk.Hunk(1, 'e', Hulk.HunkOperation.Add)
            ];
            assert.deepEqual(d, h.hunks);
        });
    });
    it(".diffFiles", () => {
        var bf1 = new Buffer("Hello, Artyom! Jerk commit!");
        var bf2 = new Buffer("Hello, World! Jerk push!");
        var hunks: Hulk.Hunk[] = [
            new Hulk.Hunk(0, 'Hello, Artyom! Jerk commit!', Hulk.HunkOperation.Remove),
            new Hulk.Hunk(0, 'Hello, World! Jerk push!', Hulk.HunkOperation.Add)
        ];
        var diff = new Hulk.Diff(hunks);
        assert.deepEqual(
            Hulk.Diff.diff(bf1, bf2).hunks[0],
            diff.hunks[0]);
    });
    it(".merge", () => {
        /*
            first = a,b,c
            second = a,c,b,c
            third = a,b,c,d

            f -> s: a, +c, b, c
            f -> t: a, b, c, +d
        */
        let first = new Buffer("a\nb\nc\n"),
            second = new Buffer("a\nc\nb\nc\n"),
            third = new Buffer("a\nb\nc\nd\n");
        var d1 = Hulk.Diff.diff(first, second);
        var d2 = Hulk.Diff.diff(first, third);
        var res = Hulk.merge(d1, d2);
        assert.ok(!res.conflicted, 'conflict found');
    });
});