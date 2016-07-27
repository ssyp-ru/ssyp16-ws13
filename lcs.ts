var m = new Map<string, CommonElement[]>();


interface CommonElement {
    value: string;
    firstIndex: number;
    secondIndex: number;
}

class Diff {
    private lcs(first: string, second: string, firstLen?: number, secondLen?: number) : CommonElement[] {
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

    private _lcs(first: string, second: string, firstLen: number, secondLen: number) : CommonElement[] {
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