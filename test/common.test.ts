/*
*   Tests for common.ts
*/
import * as Common from '../common';
import * as assert from 'assert';
var test_repo: Common.Repo;
var init_commit: Common.Commit;
var second_commit: Common.Commit;
var ref: Common.Ref;
describe("Common", function () {
    describe("repo functions", function () {
        before(() => {
            test_repo = new Common.Repo("~/ws13/test/test-repo", true);
            test_repo.stage("~/ws13/test/test_repo/test.test");
            test_repo.stage("~/ws13/test/test_repo/test2.test");
        });
        it("tests staging of file", function () {
            assert.equal(test_repo.staged[0], "~/ws13/test/test_repo/test.test",
                "failed staging");
        });
        it("tests staging of second file", function () {
            assert.equal(test_repo.staged[1], "~/ws13/test/test_repo/test2.test",
                "failed staging of second file");
        });
        describe("second file unstaged", () => {
            before(() => {
                test_repo.unstage("~/ws13/test/test_repo/test2.test");
            });
            it("tests unstaging of second file", function () {
                assert.ok((test_repo.staged[1] != "~/ws13/test/test_repo/test2.test"),
                    "failed unstaging of second file");
            });
        });
    });
    describe("commit functions", function () {
        describe("after staging", () => {
            before(() => {
                init_commit = test_repo.createCommit(null, "test message init",
                    "test author init", "test_init@test.com");
            });
            it("tests creation of new commit", function () {
                assert.ok(init_commit != null, "init_commit has not created");
            });
            it("check commit's message", function () {
                assert.equal(init_commit.message, "test message init",
                    "wrong commit message");
            });
            it("check author's name and e-mail", function () {
                assert.equal(init_commit.authorName + init_commit.authorEMail,
                    "test author inittest_init@test.com");
            });
        });
        describe("after second commit", () => {
            before(() => {
                second_commit = test_repo.createCommit(init_commit, "test message",
                    "test author", "test@test.com");
            });
            it("check parent", function () {
                assert.equal(second_commit.parent, init_commit);
            });
            it("check parent's hash", function () {
                assert.equal(second_commit.parentHash, init_commit.id);
            });
            it("check that commit's UNIX time less than current UNIX time", function () {
                var UNIX = new Date();
                assert.ok((UNIX.getTime() > second_commit.time), "wrong UNIX timestamp");
            });
            it("checks path of file returned by \"contents\" function", function () {
                assert.equal(init_commit.contents()[0].path, "~/ws13/test/test_repo/test.test",
                    "wrong path");
            });
            it("checks path of file returned by \"file\" function", function () {
                assert.equal(init_commit.contents()[0].path, "~/ws13/test/test_repo/test.test",
                    "wrong path");
            });
        });
    });
    describe("ref functions", () => {
        before(() => {
            test_repo.createRef("Test_ref");
            ref.move(second_commit.id);
        });
        it("compares second_commit ID and branch ref.head", () => {
            assert.equal(ref.head, second_commit.id, "wrong head");
        });
    });
});