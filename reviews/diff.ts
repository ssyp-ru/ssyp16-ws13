/* 

LCS
Longest common string

A       B
æ.Г.ß   œ.Г.ę

A = a1.c1.a2.c2.a3.c3....an
B = b1.c1.b2.c2.b3.c3....bn

diff (A -> B): 
    - a_i
    + b_j
    = с_i
*/

class Hunk { 
    line: number;
    value: string;
    type: HunkOperation;
}

enum HunkOperation { Add, Remove };

class Diff {
    apply(buff: Buffer) {
        if (this._hunks.length == 0) return buff;
        
        // apply this.hunks to buff and return result

        return null;
    }

    private _hunks: Hunk[];
    
    get hunks() : Hunk[] { return [].concat(this._hunks); }

    constructor(hunks: Hunk[]) {
        this._hunks = hunks.sort((a, b) => a.line - b.line); 
    }
}

export class MergeConflict { 
    constructor(public left: Hunk, public right: Hunk) {}
}

export function merge(left: Diff, right: Diff) : Diff | MergeConflict[] {
    var lhunks = left.hunks, rhunks = right.hunks;
    
    var i = 0, j = 0;

    var hunks: Hunk[] = [];
    var conflicts: MergeConflict[] = [];
    while (lhunks[i] && rhunks[j]) {
        if (lhunks[i].line < rhunks[j].line) {
            hunks.push(lhunks[i++]);
        } else if (lhunks[i].line > rhunks[j].line) {
            hunks.push(rhunks[j++]);
        } else {
            conflicts.push(new MergeConflict(lhunks[i++], rhunks[j++]));
        }
    }
    if (conflicts.length > 0) return conflicts;
    while (lhunks[i]) hunks.push(lhunks[i++]);
    while (rhunks[j]) hunks.push(rhunks[j++]);

    return new Diff(hunks);
}

/*
diff 

A, B => D_ab = diff(A->B)
A, C => D_ac = diff(A->C)

D1, D2 -> D_12

(A, D_12) -> A_merged
*/