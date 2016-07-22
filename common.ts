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
 * - it has ASCII control character, "^", ":" or SP, anywhere, or
 * - it has a "/".
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
    protected _head: string;
    protected _name: string;
    protected _ts: number;
    private _callbacks: Function[];
    constructor(head: string, name: string, ts: number = new Date().getTime()) {
        this._head = head;
        this._name = name;
        this._ts = ts;
        this._callbacks = [];
    }
    /**
     * HEAD Commit ID (last commit in this ref)
     */
    get head(): string { return this._head; }
    /**
     * Ref name
     */
    get name(): string { return this._name; }
    /**
     * Move HEAD of this ref to different commit. Triggers *move* event.
     */
    move(id: string) {
        var old = this._head;
        this._head = id;
        this.trigger('move', [old, id]);
    }
    /**
     * Trigger an event on this reference.
     */
    trigger(event: string, ...data: any[]) {
        this._callbacks.forEach(cb => {
            cb.apply(this, [event].concat(data));
        });
    }
    /**
     * Register callback on any change
     * move - HEAD moved
     * remove - Ref is now under the destroy process
     */
    on(callback: Function) { this._callbacks.push(callback); }
    /**
     * UNIX timestamp of the time the ref was created
     */
    get time(): number { return this._ts; }
    static validRefName(name: string): boolean {
        if (name.includes('..')) return false;
        if (name.includes('^')) return false;
        if (name.includes(':')) return false;
        if (name.includes(';')) return false;
        if (name.includes('/')) return false;
        if (name.includes('\\')) return false;
        if (name.endsWith('.lock')) return false;
        return true;
    }
    data(): string[] {
        return ["Ref", this._name, this._head, this._ts.toString()];
    }
}

/**
 * Branch class representation
 */
export class Branch extends Ref {
    data(): string[] {
        var val: string[] = super.data();
        val[0] = "Branch";
        return val;
    }
}

/**
 * Tag class representation
 */
export class Tag extends Ref {
    move(id: string) {
        throw "Tags are not moveable!"
    }
    data(): string[] {
        var val: string[] = super.data();
        val[0] = "Tag";
        return val;
    }
}
class StringMap<T> {
    data: Object;
    constructor() {
        this.data = {};
    }
    put(key: string, val: T): T {
        var old = this.data[key];
        this.data[key] = val;
        return old;
    }
    get(key: string): T {
        return this.data[key];
    }
    iter(): { key: string, value: T }[] {
        var res = [];
        for (var it in this.data) {
            if (this.data.hasOwnProperty(it)) {
                res.push({ key: it, value: this.data[it] });
            }
        }
        return res;
    }
}
/**
 * Repository class representation
 */
export class Repo {
    private _root: string;
    private _defaultBranchName: string;
    private _currentBranchName: string;
    private _refs: StringMap<Ref>;
    /**
     * Constructor that allows Repo creation if needed
     * @param rootPath Path to the repo itself
     * @param init allow creation of new repo or not
     * @param quiet silence warnings and notices
     */
    constructor(rootPath: string, init: boolean = false, quiet: boolean = false) {
        this._root = rootPath;
        this._refs = new StringMap<Ref>();
        var jerkPath = path.join(rootPath, '.jerk');
        var stat: fs.Stats;
        try {
            stat = fs.statSync(jerkPath);
        } catch (e) { }
        if (!stat || !stat.isDirectory()) {
            if (!init) {
                throw (colors.dim('JERK') + ' ' + logSymbols.error + " is not a repository!");
            }
            fs.mkdirSync(jerkPath, 0o755);
            this.createBranch('master', null);
            this._defaultBranchName = 'master';
            this._currentBranchName = 'master';
            this._saveConfig();
            if (!quiet) console.log(colors.dim('JERK'), logSymbols.success, "repository created successfully!");
            return;
        }
        this._loadConfig();
    }
    private _saveConfig() {
        var jerkPath = path.join(this._root, '.jerk');
        var config = {
            defaultBranchName: this._defaultBranchName,
            currentBranchName: this._currentBranchName,
            refs: [],
            refData: {}
        };
        this._refs.iter().forEach(v => {
            config.refs.push(v.key);
            config.refData[v.key] = v.value.data();
        });
        var json = JSON.stringify(config);
        console.log(json);
        fs.writeFileSync(path.join(jerkPath, 'config'), json, { mode: 0o655 });
    }
    private _loadConfig() {
        var jerkPath = path.join(this._root, '.jerk');
        var json: string = fs.readFileSync(path.join(jerkPath, 'config'), 'utf-8');
        var config: { defaultBranchName: string, currentBranchName: string, refs: string[], refData: Object } = JSON.parse(json);
        this._defaultBranchName = config.defaultBranchName;
        this._currentBranchName = config.currentBranchName;
        this._refs = new StringMap<Ref>();
        config.refs.forEach(v => {
            var data: string[] = config.refData[v];
            var type = data[0];
            if (type === "Ref") {
                this._refs.put(v, new Ref(data[2], data[0], parseInt(data[3])));
            } else if (type === "Branch") {
                this._refs.put(v, new Branch(data[2], data[0], parseInt(data[3])));
            } else if (type == "Tag") {
                this._refs.put(v, new Tag(data[2], data[0], parseInt(data[3])));
            }
        })
        console.log(this);
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
    createRef(ref: string): Ref {
        if (!Ref.validRefName(ref)) throw "Invalid ref name";
        var complex: boolean = ref.includes('~');
        throw "Not Implemented";
    }
    /**
     * Create new Branch from string
     */
    createBranch(branchName: string, commit?: string): Branch {
        if (!Ref.validRefName(branchName)) throw "Invalid ref name";
        if (branchName.includes('~')) {
            throw "Invalid branch name";
        }
        if (commit === undefined) {
            commit = this.currentBranch.head;
        }
        var branch = new Branch(commit, branchName);
        this._refs.put(branchName, branch);
        return branch;
    }
    /**
     * Create new Tag from string
     */
    createTag(tagName: string): Tag {
        if (!Ref.validRefName(tagName)) throw "Invalid ref name";
        if (tagName.includes('~')) {
            throw "Invalid tag name";
        }
        var tag = new Tag(this.currentBranch.head, tagName);
        this._refs.put(tagName, tag);
        return tag;
    }
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