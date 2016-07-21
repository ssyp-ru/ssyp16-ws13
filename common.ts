/**
 * Common code for client and server
 */
import * as fs from 'fs';
import * as path from 'path';
var parents = require('parents');
var colors = require('colors/safe');
var logSymbols = require('log-symbols');
/**
 * Commit class representation
 */
export class Commit {
    get id(): string { throw "Not Implemented"; }
    get message(): string { throw "Not Implemented"; }
    get authorName(): string { throw "Not Implemented"; }
    get authorEMail(): string { throw "Not Implemented"; }
    get parentHash(): string { throw "Not Implemented"; }
    get parent(): Commit { throw "Not Implemented"; }
    /**
     * UNIX timestamp of the time the commit was created
     */
    get time(): number { throw "Not Implemented"; }
    /**
     * Returns file tree. Format is like:
     * [ { path: "/test.txt", hash: "1241aea1bd502fa41" }, 
     *   { path: "/sub/test2.txt", hash: "ada6d7c434effa807" } ]
     */
    contents(): { path: string; hash: string }[] { throw "Not Implemented"; }
    /**
     * Returns hash of the object represented by given path
     */
    file(path: string): string { throw "Not Implemented"; }
    /** 
     * Branch merged, or null if none merged by this commit
     */
    get mergeOf(): Branch { throw "Not Implemented"; }
    set mergeOf(branch: Branch) { throw "Not Implemented"; }
    /**
     * Changed file paths in this commit. For optimization of many internal things.
     */
    get changed(): string[] { throw "Not Implemented"; }
    set changed(paths: string[]) { throw "Not Implemented"; }
}

/**
 * Ref class representation
 * Ref names are rejected if:
 * 
 * - it has double dots "..", or
 * - it has ASCII control character, "~", "^", ":" or SP, anywhere, or
 * - it ends with a "/".
 * - it ends with ".lock"
 * - it contains a "\" (backslash)
 * 
 * Ref examples:
 * - master <= branch named "master"
 * - feature-238 <= branch named "feature-238"
 * - HEAD <= last commit on the current branch
 * - HEAD~3 <= commit 3 commits ago on the current branch
 * - dev~1 <= commit 1 commits ago on "dev" branch
 * - v1.0 <= tag named "v1.0"
 * 
 * Note, that branch and tag systems are very similar (both are refs and stored together),
 * so if one tag is named "v1.0", no branch or other tags can be named alike.
 */
export class Ref {
    /**
     * HEAD Commit ID (last commit in this ref)
     */
    get head(): string { throw "Not Implemented"; }
    /**
     * Branch name
     */
    get name(): string { throw "Not Implemented"; }
    /**
     * Move HEAD of this ref to different commit. Triggers *move* event.
     */
    move(id: string) { throw "Not Implemented"; }
    /**
     * Trigger an event on this reference.
     */
    trigger(event: string, data: Object) { throw "Not Implemented"; }
    /**
     * Register callback on any change
     * move - HEAD moved
     * remove - Ref is now under the destroy process
     */
    on(callback: Function) { throw "Not Implemented"; }
    /**
     * UNIX timestamp of the time the ref was created
     */
    get time(): number { throw "Not Implemented"; }
}
/**
 * Branch class representation
 */
export class Branch extends Ref {
    /**
     * Root commit ID (first commit in this branch, when it was created).
     * When branch is created it points to the first commit **AFTER** branch split that lead to branch creation.
     */
    root(): string { throw "Not Implemented"; }
}

/**
 * Tag class representation
 */
export class Tag extends Ref {

}

/**
 * Repository class representation
 */
export class Repo {
    private _root: string;
    private valid: boolean = false;
    private _defaultBranchName: string;
    private _currentBranchName: string;
    private _refs: Map<string, Ref>;
    /**
     * Constructor that allows Repo creation if needed
     * @param path Path to the repo itself
     * @param init allow creation of new repo or not
     * @param quiet silence warnings and notices
     */
    constructor(rootPath: string, init: boolean = false, quiet: boolean = false) {
        this._root = rootPath;
        var jerkPath = path.join(rootPath, '.jerk');
        var stat: fs.Stats;
        try {
            stat = fs.statSync(jerkPath);
        } catch (e) { }
        this.valid = true;
        if (!stat || !stat.isDirectory()) {
            this.valid = false;
            if (!init) {
                console.error(colors.dim('JERK'), logSymbols.error, "is not a repository!");
                return;
            }
            fs.mkdirSync(jerkPath, 0o755);
            var fd = fs.openSync(path.join(jerkPath, 'config'), 'w', 0o755);
            fs.writeSync(fd, "config");
            fs.closeSync(fd);
            if (!quiet) console.log(colors.dim('JERK'), logSymbols.success, "repository created successfully!");
        }
    }
    /**
     * Default for this repo branch name. Checks branch name for existance.
     * @param name (optional) - if present, it sets default branch name to given value, returning old value.
     */
    get defaultBranchName(): string { return this._defaultBranchName; }
    set defaultBranchName(name: string) {
        var branch = this.ref<Branch>(name);
        if (!branch) throw "Branch not found";
        this._defaultBranchName = name;
    }
    /**
     * Get default for this repo branch.
     */
    get defaultBranch(): Branch { return this.ref<Branch>(this._defaultBranchName); }
    /**
     * Get or set current branch name. Checks branch name for existance.
     * @param name (optional) - if present, it sets current branch name to given value, returning old value.
     */
    get currentBranchName(): string { return this._currentBranchName; }
    set currentBranchName(name: string) {
        var branch = this.ref<Branch>(name);
        if (!branch) throw "Branch not found";
        this._currentBranchName = name;
    }
    /**
     * Get current branch.
     */
    get currentBranch(): Branch { return this.ref<Branch>(this._defaultBranchName); }
    /**
     * Get commit by its ID
     */
    commit(id: string): Commit { throw "Not Implemented"; }
    /**
     * Get all commits in this repo.
     */
    commits(): Commit[] { throw "Not Implemented"; }
    /**
     * Find Ref by its name
     */
    ref<T extends Ref>(name: string): T {
        return this._refs.get(name) as T;
    }
    /**
     * List all refs of this repository
     */
    refs<T extends Ref>(): T[] { return [].concat(this._refs); }
    /**
     * Staged file paths to commit
     */
    get staged(): string[] { throw "Not Implemented"; }
    set staged(paths: string[]) { throw "Not Implemented"; }
    stage(path: string) { throw "Not Implemented"; }
    unstage(path: string) { throw "Not Implemented"; }
    /**
     * File paths to track changes of
     */
    get index(): string[] { throw "Not Implemented"; }
    set index(paths: string[]) { throw "Not Implemented"; }
    addToIndex(path: string) { throw "Not Implemented"; }
    rmFromIndex(path: string) { throw "Not Implemented"; }
    /**
     * Get absolute path of the root of this repo.
     */
    get root() { return this._root; }
    /**
     * Get repository name based on repo path
     */
    get name() { return this._root.split(path.sep).pop(); }
    /**
     * Move all staged files to commit and create new commit instance.
     * @param previous the commit to base on or null if it is first commit in bare branch or repo
     */
    createCommit(previous: Commit, message: string = null,
        authorName: string = null, authorEMail: string = null): Commit { throw "Not Implemented"; }
    /**
     * Create new Ref from string
     */
    createRef(ref: string): Ref { throw "Not Implemented"; }
    /**
     * Create new Branch from string
     */
    createBranch(branchName: string): Branch { throw "Not Implemented"; }
    /**
     * Create new Tag from string
     */
    createTag(tagName: string): Tag { throw "Not Implemented"; }
    /**
     * Fetch remote repo metadata and create remote repo implementation class matching it
     * @param url remote URL
     */
    createRemoteRepo(url: string): Repo { throw "Not Implemented"; }
}
export function cwdRepo(): Repo {
    let cwd = process.cwd();
    var res: Repo;
    function tryRepoDir(dir: string) {
        var stats: fs.Stats;
        try {
            stats = fs.statSync(path.join(dir, '.jerk'));
        } catch (e) {
            return;
        }
        if (!!stats) {
            res = new Repo(dir);
        }
    }
    var par: string[] = parents(cwd);
    for (var i = 0; i < par.length; i++) {
        tryRepoDir(par[i]);
        if (!!res) {
            return res;
        }
    };
    return null;
}