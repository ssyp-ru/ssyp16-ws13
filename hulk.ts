class LcsProvider {
  m = new Map<string, CommonElement[]>();
  
  lcs(first: string[], second: string[], firstLen?: number, secondLen?: number) : CommonElement[] {
        if(firstLen === undefined) { firstLen = first.length; }
        if(secondLen === undefined) { secondLen = second.length; }
        var key = `__${firstLen}__${secondLen}__${first}__${second}`;
        if(!!m.has(key)) {
            return m.get(key);
        } else {
            var result = this._lcs(first, second, firstLen, secondLen);
            m.set(key, result);
            return result;
        }
    }
    private _lcs(first: string[], second: string[], firstLen: number, secondLen: number) : CommonElement[] {
        if(!firstLen  || !secondLen) {
            return [];
        }
        var lastFirstSymbol = first[firstLen - 1];
        var lastSecondSymbol = second[secondLen - 1];
        if(lastFirstSymbol == lastSecondSymbol) {
            return (this.lcs(first, second, firstLen - 1, secondLen - 1).concat([{ value: lastFirstSymbol, firstIndex: firstLen - 1, secondIndex: secondLen - 1 }]));
        } else {        
            var _lcs1 = this.lcs(first, second, firstLen - 1, secondLen);
            var _lcs2 = this.lcs(second, first, secondLen - 1, firstLen);
            if (Math.max(_lcs1.length, _lcs2.length) == _lcs2.length) {
                return _lcs2;
            }
            return _lcs1;
        }
    }
}

enum HunkOperation { Add, Remove };

interface CommonElement {
    value: string;
    firstIndex: number;
    secondIndex: number;
}

class Hunk {
    line: number;
    value: string;
    type: HunkOperation;
    constructor(line, value, type) {
        this.line = line;
        this.type = type;
        this.value = value;
    }
}



export class Diff {
    apply(buff: Buffer) { throw "Not implemented" }
    
    private _hunks: Hunk[];
    
    get hunks(): Hunk[] { return [].concat(this._hunks)}

    constructor(hunks: Hunk[]) {
        this._hunks = hunks.sort((a, b) => a.line - b.line);
    }

    static Diff (leftBuffer: Buffer, rightBuffer: Buffer): Hunk[]
    {
        var  leftBufferStr = leftBuffer.toString().split("\n");
        var rightBufferStr = leftBuffer.toString().split("\n");
        var hunks: Hunk[];
        var lcs = new LcsProvider;
        var commonElements = lcs.lcs(leftBufferStr, rightBufferStr); 
        var el: CommonElement = {value: "", firstIndex: leftBufferStr.length, secondIndex: rightBufferStr.length}
        
        return new Diff(hunks);
    }
}

export class MergeConflict {
    constructor(public left: Hunk, public right: Hunk) { }
}

export function merge(left: Diff, right: Diff): Diff | MergeConflict[] {
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
    i = 0;
    j = 0;
    while (lhunks[i]) hunks.push(lhunks[i++]);
    while (rhunks[j]) hunks.push(rhunks[j++]);

    return new Diff(hunks);
}
