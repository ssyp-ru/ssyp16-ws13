/*
*   Tests for common.ts
*/
import * as Common from '../common';
import * as assert from 'assert';
import * as Logger from '../log';
import * as fse from 'fs-extra';
import * as path from 'path';

var test_repo: Common.Repo;
var init_commit: Common.Commit;
var second_commit: Common.Commit;
var ref: Common.Ref;
var branch: Common.Branch;
let log = new Logger.Logger();

describe("Common", function () {
    it('creates working directory', () => {
        log.silence();
        fse.ensureDirSync('mocha-tests');
        process.chdir('mocha-tests');
    });
    describe("repo functions", function () {
        it('instantiates repository', () => {
            test_repo = new Common.Repo(process.cwd(), true);
            assert.ok(!!test_repo, 'repo is null');
        })
        it("tests staging of file", function () {
            fse.outputFileSync('test.txt', 'test');
            test_repo.stage("test.txt");
            assert.equal(test_repo.staged[0], "test.txt",
                "failed staging");
        });
        it("tests staging of second file", function () {
            fse.outputFileSync('test2.txt', 'test2');
            test_repo.stage("test2.txt");
            assert.equal(test_repo.staged[1], "test2.txt",
                "failed staging of second file");
        });
        describe("second file unstaged", () => {
            it("tests unstaging of second file", function () {
                test_repo.unstage("test2.txt");
                assert.notEqual(test_repo.staged[1], "test2.txt",
                    "failed unstaging of second file");
            });
        });
    });
    describe("commit functions", function () {
        describe("init commit", () => {
            it("tests creation of new commit", function () {
                init_commit = test_repo.createCommit(null, "test message init",
                    "test author init", "test_init@test.com");
                assert.notEqual(init_commit, null, "init_commit was not created");
            });
            it('checks HEAD ref pointer', () => {
                assert.equal(test_repo.head.head, init_commit.id, 'wrong HEAD commit id');
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
        describe("second commit", () => {
            it('creates second commit', () => {
                second_commit = test_repo.createCommit(init_commit, "test message",
                    "test author", "test@test.com");
                assert.notEqual(second_commit, null, "second_commit was not created");
            });
            it('checks HEAD ref pointer', () => {
                assert.equal(test_repo.head.head, second_commit.id, 'wrong HEAD commit id');
            });
            it("check parent", function () {
                assert.equal(second_commit.parent, init_commit);
            });
            it("check parent's hash", function () {
                assert.equal(second_commit.parentId, init_commit.id);
            });
            it("check that commit's UNIX time less than current UNIX time", function () {
                var UNIX = new Date();
                assert.ok((UNIX.getTime() > second_commit.time), "wrong UNIX timestamp");
            });
            it("checks path of file returned by \"contents\" function", function () {
                assert.equal(init_commit.contents[0].path, "test.txt", "wrong path");
            });
            it("checks path of file returned by \"file\" function", function () {
                assert.equal(init_commit.file('test.txt').path, "test.txt", "wrong path");
            });
        });
    });
    describe("branch functions", () => {
        it('creates new branch', () => {
            branch = test_repo.createBranch("dev");
        });
        it('moves head to second_commit', () => {
            branch.move(second_commit.id);
            assert.equal(branch.head, second_commit.id, "wrong branch head");
        });
        var triggered = false;
        it('registers callback', () => {
            branch.on((event: string, args: string[]) => {
                triggered = true;
                assert.equal(event, 'move', 'wrong event name');
                assert.equal(args[0], second_commit.id, 'wrong old commit id');
                assert.equal(args[1], init_commit.id, 'wrong new commit id');
            });
        });
        it('triggers move event', () => {
            branch.move(init_commit.id);
            assert.ok(triggered, 'callback not triggered');
        });
    });
    describe("ref functions", () => {
        it('creates ref', () => {
            ref = test_repo.createRef("Test_ref");
        });
        it('moves ref', () => {
            ref.move(second_commit.id);
        });
        it("compares second_commit ID and ref.head", () => {
            assert.equal(ref.head, second_commit.id, "wrong head");
        });
    });
    after(() => {
        process.chdir('..');
        fse.deleteSync('mocha-tests');
    });
});