import * as Common from '../common';
import * as Client from '../client';
import * as assert from 'assert';
import * as Logger from '../log';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
let createHash = require('sha.js');

var repo: Common.Repo;
let log = new Logger.Logger();
let authorName = "STALKER_2010";
let authorEMail = "boyarshinand@gmail.com";

describe("Client", function () {
    it('creates working directory', () => {
        log.silence();
        fse.ensureDirSync('mocha-tests');
        process.chdir('mocha-tests');
    });
    describe("repo initialization", function () {
        it('creates repo', () => {
            repo = Client.init(process.cwd());
            assert.equal(repo.commits.length, 0);
            assert.equal(repo.refs().length, 2);
            assert.equal(repo.defaultBranchName, 'master');
            assert.equal(repo.currentBranchName, 'master');
            assert.equal(repo.defaultBranch.name, 'master');
            assert.equal(repo.currentBranch.name, 'master');
            assert.equal(repo.defaultBranch.head, null);
            assert.equal(repo.currentBranch.head, null);
            assert.notEqual(repo.fs, null);
            assert.equal(repo.staged.length, 0);
            assert.equal(repo.name, 'mocha-tests');
            assert.equal(repo.merging, null);
            assert.notEqual(repo.head, null);
            assert.equal(repo.head.name, 'HEAD');
            assert.equal(repo.head.head, null);
            assert.equal(repo.head.repo, repo);
        });
        var aHash: string;
        var aTime: number;
        var bHash: string;
        var bTime: number;
        it('adds some files to repo', () => {
            fse.outputFileSync('a.txt', 'a test file\nnew line in a.txt\n\n');
            fse.outputFileSync('b.txt', '\nb test file\nnew line in b.txt\n\nYep');
            aHash = createHash('sha256').update(fs.readFileSync('a.txt')).digest('hex');
            aTime = fs.statSync('a.txt').mtime.getTime();
            bHash = createHash('sha256').update(fs.readFileSync('b.txt')).digest('hex');
            bTime = fs.statSync('b.txt').mtime.getTime();
            let res = Client.status(repo);
            assert.deepEqual(res.added.sort(), ['a.txt', 'b.txt']);
            assert.deepEqual(res.addedStaged, []);
            assert.deepEqual(res.modified, []);
            assert.deepEqual(res.modifiedStaged, []);
            assert.deepEqual(res.removed, []);
            assert.deepEqual(res.removedStaged, []);
            assert.deepEqual(res.allAdded.sort(), ['a.txt', 'b.txt']);
            assert.deepEqual(res.allModified, []);
            assert.deepEqual(res.allRemoved, []);
            assert.deepEqual(res.allNewChanges.sort(), ['a.txt', 'b.txt']);
            assert.deepEqual(res.allStagedChanges, []);
            assert.deepEqual(res.allChanges.sort(), ['a.txt', 'b.txt']);
        });
        it('stages A file', () => {
            repo.stage('a.txt');
            let res = Client.status(repo);
            assert.deepEqual(res.added, ['b.txt']);
            assert.deepEqual(res.addedStaged, ['a.txt']);
            assert.deepEqual(res.modified, []);
            assert.deepEqual(res.modifiedStaged, []);
            assert.deepEqual(res.removed, []);
            assert.deepEqual(res.removedStaged, []);
            assert.deepEqual(res.allAdded.sort(), ['a.txt', 'b.txt']);
            assert.deepEqual(res.allModified, []);
            assert.deepEqual(res.allRemoved, []);
            assert.deepEqual(res.allNewChanges, ['b.txt']);
            assert.deepEqual(res.allStagedChanges, ['a.txt']);
            assert.deepEqual(res.allChanges.sort(), ['a.txt', 'b.txt']);
        });
        it('make initial commit', () => {
            let message = 'Initial commit';
            let c = repo.createCommit(null, message, authorName, authorEMail);
            let time = new Date().getTime();
            let cc = repo.head.commit;
            assert.deepEqual(c, cc);
            var hash: string = createHash('sha256').update(message, 'utf8').digest('hex');
            assert.equal(c.id, hash);
            assert.equal(c.message, message);
            assert.equal(c.authorName, authorName);
            assert.equal(c.authorEMail, authorEMail);
            assert.deepEqual(c.changed, ['a.txt']);
            assert.deepEqual(c.contents, [new Common.TreeFile('a.txt', aTime, aHash)]);
            assert.equal(c.mergeOf, null);
            assert.equal(c.parentId, null);
            assert.equal(c.parent, null);
            assert.ok(c.time <= time, 'time mismatch');
            assert.equal(repo.head.head, hash);
            assert.deepEqual(repo.head.commit, c);
        });
        it('stages B file', () => {
            repo.stage('b.txt');
            let res = Client.status(repo);
            assert.deepEqual(res.added, []);
            assert.deepEqual(res.addedStaged, ['b.txt']);
            assert.deepEqual(res.modified, []);
            assert.deepEqual(res.modifiedStaged, []);
            assert.deepEqual(res.removed, []);
            assert.deepEqual(res.removedStaged, []);
            assert.deepEqual(res.allAdded.sort(), ['b.txt']);
            assert.deepEqual(res.allModified, []);
            assert.deepEqual(res.allRemoved, []);
            assert.deepEqual(res.allNewChanges, []);
            assert.deepEqual(res.allStagedChanges, ['b.txt']);
            assert.deepEqual(res.allChanges.sort(), ['b.txt']);
        });
        it('make second commit', () => {
            let message = 'Second commit';
            let init = repo.head.commit;
            let c = repo.createCommit(repo.head.commit, message, authorName, authorEMail);
            let time = new Date().getTime();
            let cc = repo.head.commit;
            assert.deepEqual(c, cc);
            var hash: string = createHash('sha256').update(message, 'utf8').digest('hex');
            assert.equal(c.id, hash);
            assert.equal(c.message, message);
            assert.equal(c.authorName, authorName);
            assert.equal(c.authorEMail, authorEMail);
            assert.deepEqual(c.changed, ['b.txt']);
            assert.deepEqual(c.contents, [new Common.TreeFile('a.txt', aTime, aHash),
                new Common.TreeFile('b.txt', bTime, bHash)]);
            assert.equal(c.mergeOf, null);
            assert.equal(c.parentId, init.id);
            assert.deepEqual(c.parent, init);
            assert.ok(c.time <= time, 'time mismatch');
            assert.equal(repo.head.head, hash);
            assert.deepEqual(repo.head.commit, c);
        });
    });
    describe('fun with checkout', () => {
        var initCommit: Common.Commit;
        it('resolveWhat (HEAD~1)', () => {
            let resolved = Client.resolveWhat(repo, 'HEAD~1');
            initCommit = resolved.commit;
            assert.deepEqual(initCommit.id, repo.head.commit.parentId);
        });
        it('checkouts to detached HEAD', () => {
            Client.checkout(repo, initCommit);
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(!fs.existsSync('b.txt'));
            assert.ok(!fs.existsSync('c.txt'));
            assert.ok(!repo.currentBranchName);
        });
        it('creates branch dev', () => {
            let branch = repo.createBranch('dev', repo.head.head);
            assert.equal(branch.name, 'dev');
            assert.equal(branch.head, initCommit.id);
        });
        it('checkouts to dev', () => {
            Client.checkout(repo, initCommit, repo.ref<Common.Branch>('dev'));
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(!fs.existsSync('b.txt'));
            assert.ok(!fs.existsSync('c.txt'));
            assert.equal(repo.currentBranchName, 'dev');
        });
        it('adds and stages C file', () => {
            fse.outputFileSync('c.txt', 'c test file');
            repo.stage('c.txt');
            let res = Client.status(repo);
            assert.deepEqual(res.added, []);
            assert.deepEqual(res.addedStaged, ['c.txt']);
            assert.deepEqual(res.modified, []);
            assert.deepEqual(res.modifiedStaged, []);
            assert.deepEqual(res.removed, []);
            assert.deepEqual(res.removedStaged, []);
            assert.deepEqual(res.allAdded, ['c.txt']);
            assert.deepEqual(res.allModified, []);
            assert.deepEqual(res.allRemoved, []);
            assert.deepEqual(res.allNewChanges, []);
            assert.deepEqual(res.allStagedChanges, ['c.txt']);
            assert.deepEqual(res.allChanges, ['c.txt']);
        });
        it('make third commit', () => {
            let message = 'Third commit';
            let init = repo.head.commit;
            let c = repo.createCommit(repo.head.commit, message, authorName, authorEMail);
            let time = new Date().getTime();
            let cc = repo.head.commit;
            assert.deepEqual(c, cc);
            var hash: string = createHash('sha256').update(message, 'utf8').digest('hex');
            assert.equal(c.id, hash);
            assert.equal(c.message, message);
            assert.equal(c.authorName, authorName);
            assert.equal(c.authorEMail, authorEMail);
            assert.deepEqual(c.changed, ['c.txt']);
            assert.equal(c.mergeOf, null);
            assert.equal(c.parentId, init.id);
            assert.deepEqual(c.parent, init);
            assert.ok(c.time <= time, 'time mismatch');
            assert.equal(repo.head.head, hash);
            assert.deepEqual(repo.head.commit, c);
        });
    });
    describe('back to the roots', () => {
        var masterCommit: Common.Commit;
        it('resolveWhat (master)', () => {
            let resolved = Client.resolveWhat(repo, 'master');
            masterCommit = resolved.commit;
            assert.deepEqual(masterCommit.parentId, repo.head.commit.parentId);
        });
        it('checkouts to master', () => {
            Client.checkout(repo, masterCommit, repo.ref<Common.Branch>('master'));
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(fs.existsSync('b.txt'));
            assert.ok(!fs.existsSync('c.txt'));
            assert.equal(repo.currentBranchName, 'master');
        });
        it('creates branch', () => {
            let branch = repo.createBranch('wip', repo.head.head);
            assert.equal(branch.name, 'wip');
            assert.equal(branch.head, masterCommit.id);
        });
        it('checkouts to wip', () => {
            Client.checkout(repo, masterCommit, repo.ref<Common.Branch>('wip'));
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(fs.existsSync('b.txt'));
            assert.ok(!fs.existsSync('c.txt'));
            assert.equal(repo.currentBranchName, 'wip');
        });
        it('adds and stages D file', () => {
            fse.outputFileSync('d.txt', 'd test file\nreal test file');
            repo.stage('d.txt');
            let res = Client.status(repo);
            assert.deepEqual(res.added, []);
            assert.deepEqual(res.addedStaged, ['d.txt']);
            assert.deepEqual(res.modified, []);
            assert.deepEqual(res.modifiedStaged, []);
            assert.deepEqual(res.removed, []);
            assert.deepEqual(res.removedStaged, []);
            assert.deepEqual(res.allAdded, ['d.txt']);
            assert.deepEqual(res.allModified, []);
            assert.deepEqual(res.allRemoved, []);
            assert.deepEqual(res.allNewChanges, []);
            assert.deepEqual(res.allStagedChanges, ['d.txt']);
            assert.deepEqual(res.allChanges, ['d.txt']);
        });
        // May the fourth be with you...
        it('make fourth commit', () => {
            let message = 'Fourth commit';
            let c = repo.createCommit(masterCommit, message, authorName, authorEMail);
            let time = new Date().getTime();
            let cc = repo.head.commit;
            assert.deepEqual(c, cc);
            var hash: string = createHash('sha256').update(message, 'utf8').digest('hex');
            assert.equal(c.id, hash);
            assert.equal(c.message, message);
            assert.equal(c.authorName, authorName);
            assert.equal(c.authorEMail, authorEMail);
            assert.deepEqual(c.changed, ['d.txt']);
            assert.equal(c.mergeOf, null);
            assert.equal(c.parentId, masterCommit.id);
            assert.deepEqual(c.parent, masterCommit);
            assert.ok(c.time <= time, 'time mismatch');
            assert.equal(repo.head.head, hash);
            assert.deepEqual(repo.head.commit, c);
        });
    });
    describe('tests merge', () => {
        it('checkouts to master', () => {
            Client.checkout(repo, repo.head.commit.parent, repo.ref<Common.Branch>('master'));
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(fs.existsSync('b.txt'));
            assert.ok(!fs.existsSync('c.txt'));
            assert.ok(!fs.existsSync('d.txt'));
            assert.equal(repo.currentBranchName, 'master');
        });
        it('merges wip into master', () => {
            let message = '[MERGE] wip => master';
            let commit = Client.merge(repo, repo.ref<Common.Branch>('wip').commit,
                message, authorName, authorEMail);
            assert.notEqual(commit, null);
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(fs.existsSync('b.txt'));
            assert.ok(!fs.existsSync('c.txt'));
            assert.ok(fs.existsSync('d.txt'));
            assert.equal(commit.message, message);
            // TODO: Fix bug in merge
        });
        /*
        it('merges dev into master', () => {
            let message = '[MERGE] dev => master';
            let commit = Client.merge(repo, repo.ref<Common.Branch>('dev').commit,
                message, authorName, authorEMail);
            assert.notEqual(commit, null);
            assert.ok(fs.existsSync('a.txt'));
            assert.ok(fs.existsSync('b.txt'));
            assert.ok(fs.existsSync('c.txt'));
            assert.ok(fs.existsSync('d.txt'));
            assert.equal(commit.message, message);
        });
        it('checks log', () => {
            var current = repo.head.commit;
            assert.equal(current.message, '[MERGE] dev => master');
            assert.equal(current.mergeOf.branch.name, 'dev');
            current = current.parent;
            assert.equal(current.message, '[MERGE] wip => master');
            assert.equal(current.mergeOf.branch.name, 'wip');
            current = current.parent;
            assert.equal(current.message, 'Second commit');
            assert.equal(current.mergeOf, null);
            current = current.parent;
            assert.equal(current.message, 'Initial commit');
            assert.equal(current.mergeOf, null);
            current = current.parent;
            assert.equal(current, null);
        });
        */
    });
    after(() => {
        process.chdir('..');
        fse.deleteSync('mocha-tests');
    });
});