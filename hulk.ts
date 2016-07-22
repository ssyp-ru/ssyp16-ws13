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
         * @param past before applying this hunk
         * @param future after applying this hunk
         * @param offset bytes offset from the beginning of file
         */
        constructor(past: Buffer, future: Buffer, offset: number = 0) { throw "Not Implemented"; }
        /**
         * Expected Buffer to see before applying this hunk.
         */
        get past(): Buffer { throw "Not Implemented"; }
        /**
        * Expected Buffer to see after applying this hunk.
        */
        get future(): Buffer { throw "Not Implemented"; }
        /**
         * Byte offset from the beginning of file
         */
        get offset(): number { throw "Not Implemented"; }
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
        constructor(past: fs.FileObject, present: fs.FileObject) { throw "Not Implemented"; }
        /**
         * List all hunks inside this Diff
         */
        get hunks(): Hunk[] { throw "Not Implemented"; }
        /**
         * Append hunk to this Diff
         */
        appendHunk(hunk: Hunk) { throw "Not Implemented"; }
        /**
         * Merge two diffs into single one.
         */
        static merge(first: Diff, second: Diff): Diff | MergeConflict { throw "Not Implemented"; }
    }

    /**
     * Describes all the pain the developer has received from merging diffs.
     */
    export class MergeConflict {
        /**
         * @param base the basement hunk used for merging;
         * @param conflicted the conflicted hunk;
         */
        constructor(base: Hunk, conflicted: Hunk) { throw "Not Implemented"; }
        /**
         * The basement hunk used for merging.
         */
        get base(): Hunk { throw "Not Implemented"; }
        /**
         * The conflicted hunk.
         */
        get conflicted(): Hunk { throw "Not Implemented"; }
    }
}
export = Hulk;