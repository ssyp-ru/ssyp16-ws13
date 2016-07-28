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

    constructor(public first: string[], public second: string[]) { }
}

export enum HunkOperation { Add, Remove };

interface CommonElement {
    value: string;
    firstIndex: number;
    secondIndex: number;
}

export class Hunk {
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

        var bufftext = buff.toString('utf8');
        var lines = bufftext.split('\n');
        var newlines: string[] = [];
        for (var i = 0, j = 0, currHunk = this._hunks[j]; i < lines.length; i++) {
            if (i < currHunk.line) newlines.push(lines[i]);
            else {
                switch (currHunk.type) {
                    case HunkOperation.Add:
                        newlines.push(currHunk.value);
                        newlines.push(lines[i]);
                        break;
                    case HunkOperation.Remove:
                        break;
                }
                currHunk = this._hunks[++j];
            }
        }
        return new Buffer(newlines.join('\n'));
        
        /*var strToReturn = "";
        var bufInStr = buff.toString("utf8");
        var posInString = 0;
        var posOfLine = -1;
        var curLine = 0;
        for (var i = 0; i < this._hunks.length; i++) {
            while (curLine < this._hunks[i].line) {
                posOfLine++;
                if (bufInStr[posOfLine + 1] == "\n") {
                    curLine++;
                    posOfLine += 2;
                }
            }
            for (var j = posInString; j < posOfLine; j++) {
                strToReturn += bufInStr[j];
            }
            if (this._hunks[i].type == HunkOperation.Add) {
                strToReturn += this._hunks[i].value + "\n";
            } else {
                posInString += this._hunks[i].value.length + 2;
                curLine++;
            }
        }
        for (i = posInString; i < bufInStr.length; i++) {
            strToReturn += bufInStr[i];
        }
        return new Buffer(strToReturn, "utf8");*/
    }

    private _hunks: Hunk[];

    get hunks(): Hunk[] { return [].concat(this._hunks) }

    conflicted: boolean = false;

    constructor(hunks: Hunk[], conflicted?: boolean) { 
        this._hunks = hunks.sort((a, b) => a.line - b.line);
        if (conflicted) this.conflicted = true; 
    }

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


export function merge(left: Diff, right: Diff): Diff {
    var lhunks = left.hunks, rhunks = right.hunks;
    var i = 0, j = 0;
    var hunks: Hunk[] = [];
    var conflicted = false;
    if (!lhunks) {
        return new Diff(rhunks);
    }
    while (lhunks[i] && rhunks[j]) {
        let eq = lhunks[i].value == rhunks[j].value && lhunks[i].line == rhunks[j].line;
        if ((lhunks[i].line < rhunks[j].line) || eq) {
            hunks.push(lhunks[i]);
            if (eq) j++;
            i++;
        } else if (lhunks[i].line > rhunks[j].line) {
            hunks.push(rhunks[j++]);
        } else {
            var line = lhunks[i].line;
            hunks.push(new Hunk(line, '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<', HunkOperation.Add));
            hunks.push(lhunks[i++]);
            hunks.push(new Hunk(line, '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>', HunkOperation.Add));
            hunks.push(rhunks[j++]);
            hunks.push(new Hunk(line, '====================================', HunkOperation.Add));
            conflicted = true;
        }
    }
    while (lhunks[i]) hunks.push(lhunks[i++]);
    while (rhunks[j]) hunks.push(rhunks[j++]);
    return new Diff(hunks, conflicted);
}
