import fs = require('./fs');
/**
 * Because we manage Hunks here.
 * From Oxford English Dictionary:
 *    hunk - a large piece of something, especially food, cut or broken off a larger piece
 * In SVN and JERK it is just a piece of file modified.
 * Patch consists of multiple hunks.
 * Commit consists of multiple patches.
 */
module Hulk {
    /**
     * Single Hunk representation
     */
    export class Hunk {
        /**
         * @param past past applying this hunk
         * @param future after applying this hunk
         * @param offset bytes offset from the beginning of file
         */
        private _past: Buffer;
        private _future: Buffer;
        private _offset: number;
        constructor(past: Buffer, future: Buffer, offset: number = 0) { 
            this._past = past;
            this._future = future;
            this._offset = 0;
         }
        /**
         * Expected Buffer to see past applying this hunk.
         */
        get past(): Buffer { return this._past }
        /**
        * Expected Buffer to see after applying this hunk.
        */
        get future(): Buffer { return this._future }
        /**
         * Byte offset from the beginning of file
         */
        get offset(): number { return this._offset}
        /**
         * Apply this hunk to the current Buffer.
         */
        apply(present: Buffer) { throw "Not Implemented"; }
        /**
         * Write patch file to string.
         */
        dumpString(): string { throw "Not Implemented"; }
    }
    /**
     * Diff for a single file. Consists of one or more Hunks.
     */
    export class Diff {
        /**
         * Compare two files, find Hunks with differences and create this Diff based on found differences.
         * @param past file in the past
         * @param present file now
         */
        private past: fs.FileObject;
        private present: fs.FileObject;
        private _hunks: Hunk[];
        constructor(past: fs.FileObject, present: fs.FileObject) { 
            this.past = past;
            this.present = present;
            ///////////////////////////////////// _hunks = somesing
            throw "Not Implemented";
        }
        /**
         * List all hunks inside this Diff
         */
        get hunks(): Hunk[] { return this._hunks; }
        /**
         * Append hunk to this Diff
         */
        appendHunk(hunk: Hunk) { this._hunks.push(hunk) }
        /**
         * Merge two diffs into single one.
         */
        static merge(first: Diff, second: Diff): Diff | MergeConflict[] { throw "Not Implemented"; }
    }

    /**
     * Describes all the pain the developer has received from merging diffs.
     */
    export class MergeConflict {
        /**
         * @param base the basement hunk used for merging;
         * @param conflicted the conflicted hunk;
         */
        private _base: Hunk;
        private _conflicted: Hunk;
        constructor(base: Hunk, conflicted: Hunk) { 
            this._base = base;
            this._conflicted = conflicted;
         }
        /**
         * The basement hunk used for merging.
         */
        get base(): Hunk { return this._base }
        /**
         * The conflicted hunk.
         */
        get conflicted(): Hunk { return this._conflicted }
    }
}
export = Hulk;