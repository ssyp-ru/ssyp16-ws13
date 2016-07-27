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
        it("changes one string to another", () => {
            assert.fail();
        });
        it("adds strings when they are provided in new file", () => {
            assert.fail();
        });
    });
});
