declare module 'configstore' {
    class Options {
        globalConfigPath: string;
    }
    class Configstore {
        constructor(id: string, defaults?: any, opts?: Options);
        all: any;
        size: number;
        get(key: string): any;
        set(key: string, val: any);
        del(key: string);
        clear();
    }
    export = Configstore;
}