/// <reference path="log-symbols.d.ts" />
/// <reference path="colors.d.ts" />
import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';

let name = colors.dim('JERK');
var _quiet = false;

export function silence() {
    _quiet = true;
}

export function quiet(v: boolean) {
    _quiet = v;
}

export function error(...args: any[]) {
    log(...[name, logSymbols.error].concat(args));
}

export function warn(...args: any[]) {
    log(...[name, logSymbols.warning].concat(args));
}

export function success(...args: any[]) {
    if (_quiet) return;
    log(...[name, logSymbols.success].concat(args));
}

export function info(...args: any[]) {
    if (_quiet) return;
    log(...[name, logSymbols.info].concat(args));
}

export function header(header: string) {
    log(name, header);
}

export function log(...args: any[]) {
    console.log(args.join(' '));
}