import * as logSymbols from 'log-symbols';
import * as colors from 'colors/safe';

let name = colors.dim('JERK');
export class Logger {
    private static _quiet = false;

    silence() {
        Logger._quiet = true;
    }

    quiet(v: boolean) {
        Logger._quiet = v;
    }

    error(...args: any[]) {
        this.log(...[name, logSymbols.error].concat(args));
    }

    warn(...args: any[]) {
        this.log(...[name, logSymbols.warning].concat(args));
    }

    success(...args: any[]) {
        if (Logger._quiet) return;
        this.log(...[name, logSymbols.success].concat(args));
    }

    info(...args: any[]) {
        if (Logger._quiet) return;
        this.log(...[name, logSymbols.info].concat(args));
    }

    header(header: string) {
        this.log(name, header);
    }

    log(...args: any[]) {
        console.log(args.join(' '));
    }
}