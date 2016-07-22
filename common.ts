/**
 * Common code for client and server
 */
import * as fs from 'fs';
import * as path from 'path';
var parents = require('parents');
var colors = require('colors/safe');
var logSymbols = require('log-symbols');
var createHash = require('sha.js');
abstract class Serializable {
    abstract data(): string[];
    toString(): string {
        return JSON.stringify(this.data());
    }
}
/**
 * Commit class representation
 */
export class Commit extends Serializable {
    private _id: string;
    private _message: string;
    private _authorName: string;
    private _authorEMail: string;
    private _parentId: string;
    private _time: number;
    private _contents: StringMap<string>;
    private _mergeOf: string;
    private _changed: string[];
    private _repo: Repo;
    constructor(id: string, repo: Repo, parentId: string = null,
        message: string = null, authorName: string = null, authorEMail: string = null,
        time: number = new Date().getTime(), contents: StringMap<string> = new StringMap<string>(),
        mergeOf: string = null, changed: string[] = []) {
        super();
        this._id = id;
        this._repo = repo;
        this._message = message;
        this._authorName = authorName;
        this._authorEMail = authorEMail;
        this._parentId = parentId;
        this._time = time;
        this._contents = contents;
        this._mergeOf = mergeOf;
        this._changed = changed;
    }
    get id(): string { return this._id; }
    get message(): string { return this._message; }
    get authorName(): string { return this._authorName; }
    get authorEMail(): string { return this._authorEMail; }
    get parentId(): string { return this._parentId; }
    get parent(): Commit { return this._repo.commit(this._parentId); }
    /**
     * UNIX timestamp of the time the commit was created
     */
    get time(): number { return this._time; }
    /**
     * Returns file tree. Format is like:
     * [ { path: "/test.txt", hash: "1241aea1bd502fa41" }, 
     *   { path: "/sub/test2.txt", hash: "ada6d7c434effa807" } ]
     */
    get contents(): { path: string; hash: string }[] {
        var res: { path: string; hash: string }[] = [];
        this._contents.iter().forEach(v => {
            var path = v.key;
            var hash = v.value;
            res.push({ path: path, hash: hash });
        });
        return res;
    }
    /**
     * Returns hash of the object represented by given path
     */
    file(path: string): string { return this._contents.get(path); }
    /** 
     * Branch merged, or null if none merged by this commit
     */
    get mergeOf(): Branch {
        if (!this._mergeOf) return null;
        return this._repo.ref<Branch>(this._mergeOf);
    }
    set mergeOf(branch: Branch) { this._mergeOf = branch.name; }
    /**
     * Changed file paths in this commit. For optimization of many internal things.
     */
    get changed(): string[] { return this._changed; }
    set changed(paths: string[]) { this._changed = paths; }
    data(): string[] {
        return ["Commit", this._id, this._message, this._authorName, this._authorEMail,
            this._parentId, this._time.toString(), JSON.stringify(this._contents),
            this._mergeOf, JSON.stringify(this._changed)];
    }
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
export class Ref extends Serializable {
    protected _head: string;
    protected _name: string;
    protected _ts: number;
    private _callbacks: Function[];
    constructor(head: string, name: string, ts: number = new Date().getTime()) {
        super();
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
function iterateStringKeyObject<T>(obj: Object): { key: string, value: T }[] {
    var res = [];
    for (var it in obj) {
        if (obj.hasOwnProperty(it)) {
            res.push({ key: it, value: obj[it] });
        }
    }
    return res;
}
function iterateSerializable(obj: Object): { key: string, value: string[] }[] {
    return iterateStringKeyObject<string[]>(obj);
}
class StringMap<T> {
    data: Object;
    constructor(data: Object = {}) {
        this.data = data;
    }
    put(key: string, val: T): T {
        var old = this.data[key];
        this.data[key] = val;
        return old;
    }
    copyFrom(o: StringMap<T>) {
        o.iter().forEach(v => {
            this.data[v.key] = v.value;
        });
    }
    get(key: string): T {
        return this.data[key];
    }
    iter(): { key: string, value: T }[] {
        return iterateStringKeyObject<T>(this.data);
    }
    toString(): string {
        return JSON.stringify(this.data);
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
    private _commits: StringMap<Commit>;
    private _index: string[];
    private _staged: string[];
    private _fs: FileSystem.IFileSystem;
    /**
     * Constructor that allows Repo creation if needed
     * @param rootPath Path to the repo itself
     * @param init allow creation of new repo or not
     * @param quiet silence warnings and notices
     */
    constructor(rootPath: string, init: boolean = false, quiet: boolean = false) {
        this._root = rootPath;
        this._refs = new StringMap<Ref>();
        this._commits = new StringMap<Commit>();
        this._index = [];
        this._staged = [];
        this._fs = FileSystem.fs();
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
            refs: {},
            commits: {},
            index: this._index,
            staged: this._staged
        };
        this._refs.iter().forEach(v => {
            config.refs[v.key] = v.value.data();
        });
        this._commits.iter().forEach(v => {
            config.commits[v.key] = v.value.data();
        });
        var json = JSON.stringify(config);
        console.log(json);
        fs.writeFileSync(path.join(jerkPath, 'config'), json, { mode: 0o655 });
    }
    private _loadConfig() {
        var jerkPath = path.join(this._root, '.jerk');
        var json: string = fs.readFileSync(path.join(jerkPath, 'config'), 'utf-8');
        var config: {
            defaultBranchName: string,
            currentBranchName: string,
            refs: Object,
            commits: Object,
            index: string[],
            staged: string[]
        } = JSON.parse(json);
        this._defaultBranchName = config.defaultBranchName;
        this._currentBranchName = config.currentBranchName;
        this._refs = new StringMap<Ref>();
        this._commits = new StringMap<Commit>();
        iterateSerializable(config.refs).forEach(v => {
            var key: string = v.key;
            var data: string[] = v.value;
            var type = data[0];
            if (type === "Ref") {
                this._refs.put(key, new Ref(data[2], data[0], parseInt(data[3])));
            } else if (type === "Branch") {
                this._refs.put(key, new Branch(data[2], data[0], parseInt(data[3])));
            } else if (type == "Tag") {
                this._refs.put(key, new Tag(data[2], data[0], parseInt(data[3])));
            }
        });
        iterateSerializable(config.commits).forEach(v => {
            var key: string = v.key;
            var data: string[] = v.value;
            var type = data[0];
            if (type !== "Commit") throw "Unexpected object type while expecting Commit";
            //["Commit", this._id, this._message, this._authorName, this._authorEMail,
            //this._parentId, this._time.toString(), JSON.stringify(this._contents),
            //this._mergeOf, JSON.stringify(this._changed)]
            var contents = new StringMap<string>(JSON.parse(data[7]));
            var commit = new Commit(data[1], this,
                data[5], data[2], data[3], data[4], parseInt(data[6]), contents,
                data[8], JSON.parse(data[9]));
            this._commits.put(key, commit);
        });
        this._index = config.index;
        this._staged = config.staged;
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
    commit(id: string): Commit { return this._commits.get(id); }
    /**
     * Get all commits in this repo.
     */
    commits(): Commit[] { return [].concat(this._commits); }
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
    get staged(): string[] { return [].concat(this._staged); }
    set staged(paths: string[]) { this._staged = paths; }
    stage(path: string) { this._staged.push(path); }
    unstage(path: string) {
        var i = this._staged.indexOf(path);
        if (i >= 0) this._staged.splice(i, 1, ...[]);
    }
    /**
     * File paths to track changes of
     */
    get index(): string[] { return [].concat(this._index); }
    set index(paths: string[]) { this._index = paths; }
    addToIndex(path: string) { this._index.push(path); }
    rmFromIndex(path: string) {
        var i = this._index.indexOf(path);
        if (i >= 0) this._index.splice(i, 1, ...[]);
    }
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
        authorName: string = null, authorEMail: string = null, mergeOf: string = null): Commit {
        var ts: number = new Date().getTime();
        var hash: string = createHash('sha256').update(message || ts, 'utf-8').digest('hex');
        var contents = new StringMap<string>();
        if (!!previous) {
            contents.copyFrom(previous['_contents']);
        }
        this._staged.forEach(v => {
            var buf = fs.readFileSync(v);
            var fo: FileSystem.FileObject;
            var foFound = this._fs.resolveObjectByContents(buf);
            if (!foFound) {
                fo = this._fs.create(buf);
            } else if (foFound.isSymlink()) {
                console.error(logSymbols.warning, 'hash collision between file and symlink detected!');
                throw "Hash collision";
            } else {
                fo = foFound.asFile();
            }
            contents.put(v, fo.hash());
        });
        var commit = new Commit(hash, this, !!previous ? previous.id : null,
            message, authorName, authorEMail, ts, contents, mergeOf, this.staged);
        this._commits.put(hash, commit);
        this._staged = [];
        return commit;
    }
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