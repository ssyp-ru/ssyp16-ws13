/**
 * Common code for client and server
 */
import * as nfs from 'fs';
import * as fse from 'fs-extra';
import {FSFunctions} from './fsFunctions';
import fs = require('./fs');
import * as path from 'path';
import * as logSymbols from 'log-symbols';
import * as Logger from './log';
import * as colors from 'colors/safe';
let parents = require('parents');
let createHash = require('sha.js');

let fsf = new FSFunctions();
let log = new Logger.Logger();

export abstract class Serializable {
    abstract data(): string[];
    toString(): string {
        return JSON.stringify(this.data());
    }
}

export class TreeFile {
    constructor(public path: string, public time?: number, public hash?: string) {
    }
}

export class MergeOf extends Serializable {
    constructor(private _commit: string, private _repo: Repo, private _branch?: string) {
        super();
    }
    data(): string[] {
        return ['MergeOf', this._commit, this._branch];
    }
    get branch(): Branch {
        return this._repo.ref<Branch>(this._branch);
    }
    get commit(): Commit {
        return this._repo.commit(this._commit);
    }
    get repo(): Repo {
        return this._repo;
    }
}

/**
 * Commit class representation
 */
export class Commit extends Serializable {
    /**
     * @param time UNIX timestamp of the time the commit was created
     */
    constructor(public id: string,
        private repo: Repo,
        public parentId: string = null,
        public message: string = null,
        public authorName: string = null,
        public authorEMail: string = null,
        public time: number = new Date().getTime(),
        private _contents: StringMap<TreeFile> = new StringMap<TreeFile>(),
        private _mergeOf: MergeOf = null, public changed: string[] = []) {
        super();
    }

    /**
     * Parent commit, if any
     */
    get parent(): Commit {
        if (!this.parentId) return null;
        return this.repo.commit(this.parentId);
    }

    /**
     * Returns file tree as an array of all *TreeFile*s.
     */
    get contents(): TreeFile[] {
        var res: TreeFile[] = [];
        this._contents.iter().forEach(v => {
            var path = v.key;
            var file = v.value;
            res.push(file);
        });
        return res;
    }

    /**
     * Returns TreeFile of the object represented by given path
     */
    file(path: string): TreeFile { return this._contents.get(path); }

    /** 
     * MergeOf, or null if nothing merged by this commit
     */
    get mergeOf(): MergeOf {
        return this._mergeOf;
    }

    set mergeOf(mergeOf: MergeOf) { this._mergeOf = mergeOf; }

    /**
     * @see Serializable
     */
    data(): string[] {
        return ["Commit", this.id, this.message, this.authorName, this.authorEMail,
            this.parentId, this.time.toString(), JSON.stringify(this._contents),
            JSON.stringify(this._mergeOf), JSON.stringify(this.changed)];
    }
}

let forbiddenRefSubstrings = ['..', '^', ':', ';', '/', '\\'];

/**
 * Visit docs/ref.md for detailed Ref system docs
 */
export class Ref extends Serializable {
    private _callbacks: Function[];

    /**
     * @param head HEAD Commit ID (last commit in this ref)
     * @param time UNIX timestamp of the time the ref was created
     */
    constructor(public head: string, public name: string, private _repo: Repo, public time: number = new Date().getTime()) {
        super();
        this._callbacks = [];
    }

    get commit(): Commit {
        return !!this.head ? this.repo.commit(this.head) : null;
    }

    /**
     * Move HEAD of this ref to different commit. Triggers *move* event.
     */
    move(id: string) {
        var old = this.head;
        this.head = id;
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

    static validRefName(name: string): boolean {
        for (var i = 0; i < forbiddenRefSubstrings.length; i++) {
            let sub = forbiddenRefSubstrings[i];
            if (name.includes(sub)) return false;
        }
        if (name.endsWith('.lock')) return false;
        return true;
    }

    /**
     * @see Serializable
     */
    data(): string[] {
        return ["Ref", this.name, this.head, this.time.toString()];
    }

    get repo(): Repo {
        return this._repo;
    }
}

/**
 * Branch class representation
 */
export class Branch extends Ref {
    /**
     * @see Serializable
     */
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

    /**
     * @see Serializable
     */
    data(): string[] {
        var val: string[] = super.data();
        val[0] = "Tag";
        return val;
    }
}

export function iterateStringKeyObject<T>(obj: Object): { key: string, value: T }[] {
    var res = [];
    for (var it in obj) {
        if (obj.hasOwnProperty(it)) {
            res.push({ key: it, value: obj[it] });
        }
    }
    return res;
}

export class StringMap<T> {
    data: Object;
    constructor(data: Object = {}) {
        this.data = data;
    }

    clear() {
        this.data = {};
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

    del(key: string) {
        delete this.data[key];
    }

    iter(): { key: string, value: T }[] {
        return iterateStringKeyObject<T>(this.data);
    }

    iterKeys(): string[] {
        var res: string[] = [];
        for (var it in this.data) {
            if (this.data.hasOwnProperty(it)) {
                res.push(it);
            }
        }
        return res;
    }

    iterValues(): T[] {
        var res: T[] = [];
        for (var it in this.data) {
            if (this.data.hasOwnProperty(it)) {
                res.push(this.data[it]);
            }
        }
        return res;
    }

    toString(): string {
        return JSON.stringify(this.data);
    }
}

function onHEADMoved(event: string, args: string[]) {
    let $this: Ref = this;
    $this.repo.writeCommitData($this, 'HEAD');
}

/**
 * Repository class representation
 */
export class Repo {
    protected _defaultBranchName: string;
    protected _currentBranchName: string;
    protected _refs: StringMap<Ref>;
    protected _commits: StringMap<Commit>;
    protected _staged: string[];
    protected _fs: fs.IFileSystem;
    protected _merging: MergeOf;

    /**
     * Constructor that allows Repo creation if needed
     * @param rootPath Path to the repo itself
     * @param init allow creation of new repo or not
     * @param quiet silence warnings and notices
     */
    constructor(public root: string, init: boolean = false) {
        this._defaultBranchName = 'master';
        this._currentBranchName = 'master';
        this._refs = new StringMap<Ref>();
        this._commits = new StringMap<Commit>();
        this._staged = [];
        this._merging = null;

        if (!this.local) return;

        this._fs = fs.fs();

        if (!nfs.existsSync(path.join(this.jerkPath, 'config'))) {
            if (!init) {
                fse.deleteSync(this.jerkPath);

                throw (colors.dim('JERK') + ' ' + logSymbols.error + " is not a repository!");
            }

            fse.ensureDirSync(this.jerkPath);

            this.createRef('HEAD');
            this.createBranch('master', null);
            this.saveConfig();

            log.success("repository created successfully!");
        }

        this._loadConfig();
    }

    saveConfig() {
        var config = {
            defaultBranchName: this._defaultBranchName,
            currentBranchName: this._currentBranchName,
            refs: {},
            commits: {},
            staged: this._staged,
            merging: !!this._merging ? this._merging.data() : null
        };

        this._refs.iter().forEach(v => {
            config.refs[v.key] = v.value.data();
        });

        this._commits.iter().forEach(v => {
            config.commits[v.key] = v.value.data();
        });

        var json = JSON.stringify(config);
        fse.outputFileSync(path.join(this.jerkPath, 'config'), json);
        this.writeCommitData(this.head, 'HEAD');
    }

    protected _loadConfig() {
        var json: string = nfs.readFileSync(path.join(this.jerkPath, 'config'), 'utf8');

        var config: {
            defaultBranchName: string,
            currentBranchName: string,
            refs: Object,
            commits: Object,
            staged: string[],
            merging: string[]
        } = JSON.parse(json);

        this._defaultBranchName = config.defaultBranchName;
        this._currentBranchName = config.currentBranchName;

        this._refs = loadRefsFromObject(config.refs, this);
        this._commits = loadCommitsFromObject(config.commits, this);

        this._staged = config.staged;
        this._merging = null;
        if (!!config.merging) {
            this._merging = new MergeOf(config.merging[1], this, config.merging[2]);
        }
    }

    get jerkPath(): string { return path.join(this.root, '.jerk'); }

    /**
     * Default for this repo branch name. Checks branch name for existance.
     * @param name (optional) - if present, it sets default branch name to given value, returning old value.
     */
    get defaultBranchName(): string { return this._defaultBranchName; }

    set defaultBranchName(name: string) {
        if (!name) {
            this._defaultBranchName = null;
            this.saveConfig();
            return;
        }

        var branch = this.ref<Branch>(name);
        if (!branch) throw "Branch not found";

        this._defaultBranchName = name;
        this.saveConfig();
    }

    /**
     * Get default for this repo branch.
     */
    get defaultBranch(): Branch {
        var name = this._defaultBranchName;
        if (!name) return null;

        return this.ref<Branch>(name);
    }

    /**
     * Get or set current branch name. Checks branch name for existance.
     * @param name (optional) - if present, it sets current branch name to given value, returning old value.
     */
    get currentBranchName(): string { return this._currentBranchName; }

    set currentBranchName(name: string) {
        if (!name) {
            this._currentBranchName = null;
            this.saveConfig();
            return;
        }

        var branch = this.ref<Branch>(name);
        if (!branch) throw "Branch not found";

        this._currentBranchName = name;
        this.saveConfig();
    }

    /**
     * Get current branch.
     */
    get currentBranch(): Branch {
        var name = this._currentBranchName;
        if (!name) return null;

        return this.ref<Branch>(name);
    }

    /**
     * Get commit by its ID
     */
    commit(id: string): Commit {
        if (!id) return null;

        var short = id.length < 60;
        if (short) {
            var applicable = this._commits.iter().filter(v => v.key.startsWith(id));

            if (applicable.length == 0) return null;
            if (applicable.length == 1) return applicable[0].value;
            throw "Multiple commits found, use full commit notation"
        }

        return this._commits.get(id);
    }

    /**
     * Get all commits in this repo.
     */
    get commits(): Commit[] { return this._commits.iterValues(); }

    get commitsDB(): StringMap<Commit> { return this._commits; }

    /**
     * Find Ref by its name
     */
    ref<T extends Ref>(name: string): T {
        return this._refs.get(name) as T;
    }

    /**
     * List all refs of this repository
     */
    refs<T extends Ref>(): T[] { return this._refs.iterValues() as T[]; }

    addRef<T extends Ref>(v: T) { this._refs.put(v.name, v); }

    /**
     * Staged file paths to commit
     */
    get staged(): string[] { return [].concat(this._staged); }

    set staged(paths: string[]) {
        this._staged = paths;
        this.saveConfig();
    }

    stage(path: string) {
        if (this._staged.indexOf(path) >= 0) return;

        this._staged.push(path);
        this.saveConfig();
    }

    unstage(path: string) {
        var i = this._staged.indexOf(path);
        if (i < 0) return;

        this._staged.splice(i, 1, ...[]);
        this.saveConfig();
    }

    /**
     * Get repository name based on repo path
     */
    get name() { return this.root.split(path.sep).pop(); }

    /**
     * Move all staged files to commit and create new commit instance.
     * @param previous the commit to base on or null if it is first commit in bare branch or repo
     * @param amend amend previous commit instead of creating absolutely different one
     * @param oldCommitData previous commit to base on
     */
    createCommit(previous: Commit, message: string,
        authorName: string = null, authorEMail: string = null,
        amend: boolean = false, oldCommitData: string[] = null): Commit {
        var ts: number = new Date().getTime();
        var hash: string = createHash('sha256').update(message || ts, 'utf8').digest('hex');
        var contents = new StringMap<TreeFile>();
        if (!!previous) {
            contents.copyFrom(previous['_contents']);
        } else if (amend) {
            log.error('amending without parent commit');
            return null;
        }

        this._staged.forEach(v => {
            let stats = fsf.lstat(v);
            if (!stats) {
                return contents.del(v);
            }

            let buf = nfs.readFileSync(v);

            var fo: fs.FileObject;
            var foFound = this._fs.resolveObjectByContents(buf);
            if (!foFound) {
                fo = this._fs.create(buf);
            } else if (foFound.isSymlink()) {
                log.error('hash collision between file and symlink detected!');
                throw "Hash collision";
            } else {
                fo = foFound.asFile();
            }

            contents.put(v, new TreeFile(v, stats.mtime.getTime(), fo.hash()));
        });

        if (amend) {
            if (!oldCommitData) {
                oldCommitData = previous.data();
            }

            previous = previous.parent;
            if (!!this._currentBranchName)
                this.currentBranch.move(previous.id);
        }

        if (!!oldCommitData) {
            authorName = oldCommitData[3];
            authorEMail = oldCommitData[4];
            ts = parseInt(oldCommitData[6]);

            iterateStringKeyObject(JSON.parse(oldCommitData[7])['data']).forEach(v => {
                var path: string = v.value['path'];
                if (this._staged.indexOf(path) < 0) {
                    contents.put(path, new TreeFile(path, v.value['time'], v.value['hash']));
                }
            });

            let oldStaged: string[] = JSON.parse(oldCommitData[9]);
            oldStaged.forEach(v => this.stage(v));
        }

        if (!!this.merging) {
            this.setMerging(null, null);
        }

        var commit = new Commit(hash, this, !!previous ? previous.id : null,
            message, authorName, authorEMail, ts, contents, this._merging, this.staged);
        this._commits.put(hash, commit);
        this._staged = [];

        if (!!this._currentBranchName)
            this.currentBranch.move(hash);

        this.head.move(hash);

        this.saveConfig();
        return commit;
    }

    /**
     * Create new Ref from string
     */
    createRef(refName: string, temp: boolean = false): Ref {
        if (!Ref.validRefName(refName)) throw "Invalid ref name";
        if (!!this._refs.get(refName)) throw "Ref with this name already exists!";

        var complex: boolean = refName.includes('~');

        var head: string = null;
        if (refName !== 'HEAD') {
            head = this.head.head;
            if (complex) {
                let parts = refName.split('~');
                var base: Commit = this.commit(parts[0])
                    || (this.ref(parts[0]) || { commit: null }).commit;
                if (!base) throw "Relative Ref base commit not found";
                var fallback = !!parts[1].length ? parseInt(parts[1]) : 1;
                if (isNaN(fallback)) throw "Relative offset is not a number";
                if (fallback < 0) throw "Relative offset must be positive";
                for (; fallback > 0; fallback--) {
                    base = base.parent;
                    if (!base) throw "Fallen back too far, no commit found";
                }
                head = base.id;
            }
        }

        let ref = new Ref(head, refName, this);

        if (!temp) {
            this._refs.put(refName, ref);
            if (refName === 'HEAD') {
                ref.on(onHEADMoved);
            }
            this.saveConfig();
        }
        return ref;
    }

    /**
     * Create new Branch from string
     */
    createBranch(branchName: string, commit?: string): Branch {
        if (!Ref.validRefName(branchName)) throw "Invalid ref name";
        if (branchName.includes('~')) {
            throw "Invalid branch name";
        }
        if (!!this._refs.get(branchName)) throw "Ref with this name already exists!";

        if (commit === undefined) {
            let head = this.head;
            if (!!head) commit = this.head.head;
        }

        var branch = new Branch(commit, branchName, this);
        this._refs.put(branchName, branch);
        this.saveConfig();
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
        if (!!this._refs.get(tagName)) throw "Ref with this name already exists!";

        if (!this.head) {
            throw "Tag requires HEAD to be present";
        }

        var tag = new Tag(this.head.head, tagName, this);
        this._refs.put(tagName, tag);
        this.saveConfig();
        return tag;
    }

    get local(): boolean {
        return true;
    }

    /**
     * Get cached FileSystem implementation
     */
    get fs(): fs.IFileSystem {
        return this._fs;
    }

    get head(): Ref {
        return this.ref<Ref>('HEAD');
    }

    writeCommitData(ref: Ref, name: string) {
        if (!ref) return;

        var json = JSON.stringify(ref.data());
        fse.outputFileSync(path.join(this.jerkPath, name), json);
    }

    get merging(): MergeOf {
        return this._merging;
    }
    setMerging(commit: string, branch: string) {
        if (!commit) {
            this._merging = null;
        } else {
            this._merging = new MergeOf(commit, this, branch);
        }
        this.saveConfig();
    }
}

export function cwdRepo(): Repo {
    let cwd = process.cwd();

    function tryRepoDir(dir: string): Repo {
        var stats: nfs.Stats;
        try {
            stats = nfs.statSync(path.join(dir, '.jerk'));
        } catch (e) {
            return null;
        }
        if (!!stats) {
            return new Repo(dir);
        }
        return null;
    }

    var res: Repo;
    var up = parents(cwd);
    for (var i = 0; i < up.length; i++) {
        res = tryRepoDir(up[i]);
        if (!!res) {
            return res;
        }
    };
    return null;
}

export function loadRefsFromObject(o: Object, repo: Repo): StringMap<Ref> {
    let res = new StringMap<Ref>();
    iterateStringKeyObject<string[]>(o).forEach(v => {
        var key: string = v.key;
        var data: string[] = v.value;
        var type = data[0];
        if (type === "Ref") {
            let ref = new Ref(data[2], data[1], repo, parseInt(data[3]));
            res.put(key, ref);
            if (key === 'HEAD') {
                ref.on(onHEADMoved);
            }
        } else if (type === "Branch") {
            res.put(key, new Branch(data[2], data[1], repo, parseInt(data[3])));
        } else if (type === "Tag") {
            res.put(key, new Tag(data[2], data[1], repo, parseInt(data[3])));
        }
    });
    return res;
}

export function loadCommitsFromObject(o: Object, repo: Repo): StringMap<Commit> {
    let res = new StringMap<Commit>();
    iterateStringKeyObject<string[]>(o).forEach(v => {
        var key: string = v.key;
        var data: string[] = v.value;
        var type = data[0];
        if (type !== "Commit") throw "Unexpected object type while expecting Commit";

        //["Commit", this._id, this._message, this._authorName, this._authorEMail,
        //this._parentId, this._time.toString(), JSON.stringify(this._contents),
        //this._mergeOf, JSON.stringify(this._changed)]

        var contents = new StringMap<TreeFile>();
        iterateStringKeyObject(JSON.parse(data[7])['data']).forEach(v => {
            var path: string = v.value['path'];
            contents.put(path, new TreeFile(path, v.value['time'], v.value['hash']));
        });

        let mergeOfObj: string[] = JSON.parse(data[8]);
        var mergeOf: MergeOf = null;
        if (!!mergeOfObj) {
            mergeOf = new MergeOf(mergeOfObj[1], repo, mergeOfObj[2]);
        }

        var commit = new Commit(data[1], repo,
            data[5], data[2], data[3], data[4], parseInt(data[6]), contents,
            mergeOf, JSON.parse(data[9]));

        res.put(key, commit);
    });
    return res;
}