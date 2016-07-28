export class LcsProvider {
    private memoize = new Map<string, CommonElement[]>();

    lcs(firstLen?: number, secondLen?: number): CommonElement[] {
        if (firstLen === undefined) { firstLen = this.first.length; }
        if (secondLen === undefined) { secondLen = this.second.length; }
        var key = `__${firstLen}__${secondLen}__`;
        if (!!this.memoize.has(key)) {
            return this.memoize.get(key);
        } else {
            var result = this._lcs(firstLen, secondLen);
            this.memoize.set(key, result);
            return result;
        }
    }
    private _lcs(firstLen: number, secondLen: number): CommonElement[] {
        if (!firstLen || !secondLen) {
            return [];
        }
        var lastFirstSymbol = this.first[firstLen - 1];
        var lastSecondSymbol = this.second[secondLen - 1];
        if (lastFirstSymbol == lastSecondSymbol) {
            return (this.lcs(firstLen - 1, secondLen - 1).concat([
                { value: lastFirstSymbol, firstIndex: firstLen - 1, secondIndex: secondLen - 1 }
            ]));

        } else {
            var _lcs1 = this.lcs(firstLen - 1, secondLen);
            var _lcs2 = this.lcs(firstLen, secondLen - 1);
            return _lcs1.length < _lcs2.length ? _lcs2 : _lcs1;
        }
    }

    constructor (public first: string[], public second: string[]) {}
}

export enum HunkOperation { Add, Remove };

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
    apply(buff: Buffer) {
        if (this._hunks.length == 0) return buff;
        var strToReturn = "";
        var bufInStr = buff.toString("utf8");
        var posInString = 0;
        var posOfLine = -1;
        var curLine = 0;
        var j;
        var i;
        for (i = 0; i < this._hunks.length; i++) {
            while (curLine < this._hunks[i].line) {
                posOfLine++;
                if (bufInStr[posOfLine + 1] == "\n") {
                    curLine++;
                    posOfLine += 2;
                }
            }
            for (j = posInString; j < posOfLine; j++) {
                strToReturn += bufInStr[j];
            }
            if (this._hunks[i].type = HunkOperation.Add) {
                strToReturn += this._hunks[i].value + "\n";
            } else {
                posInString += this._hunks[i].value.length + 2;
                curLine++;
            }
        }
        for (i = posInString; i < bufInStr.length; i++) {
            strToReturn += bufInStr[i];
        }
        return new Buffer(strToReturn, "utf8");
    }

    private _hunks: Hunk[];

    get hunks(): Hunk[] { return [].concat(this._hunks) }

    constructor(hunks: Hunk[]) { this._hunks = hunks.sort((a, b) => a.line - b.line); }

    static diff(leftBuffer: Buffer, rightBuffer: Buffer): Diff {
        var leftBufferStr = leftBuffer.toString().split("\n");
        var rightBufferStr = rightBuffer.toString().split("\n");

        var hunks: Hunk[] = [];
        var lcsProvider = new LcsProvider(leftBufferStr, rightBufferStr);
        var commonElements = lcsProvider.lcs();
        commonElements.push({ value: "", firstIndex: leftBufferStr.length, secondIndex: rightBufferStr.length });
        var i = 0;
        var fp = 0,
            sp = 0;
        while (i < commonElements.length) {
             while (fp < commonElements[i].firstIndex) { hunks.push(new Hunk(fp, leftBufferStr[fp++], HunkOperation.Remove)); }
             while (sp < commonElements[i].secondIndex) { hunks.push(new Hunk(fp, rightBufferStr[sp++], HunkOperation.Add)); }
             i++;
             fp += 1;
             sp += 1;
        }
        if (hunks.length == 0) { return null; }
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
