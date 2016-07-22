declare module "commander" {
    interface ActionCallback {
        (...args: any[]);
    }
    interface FormatCallback {
        (text: string): string;
    }
    class Command {
        commands: Command[];
        options: Option[];
        command(name: string, desc?: string, opts?: { isDefault?: boolean, noHelp?: boolean }): Command;
        arguments(desc: string): Command;
        parseExpectedArgs(args: string[]): Command;
        action(fn: ActionCallback): Command;
        option(flags: string, description?: string, fn?: Function | any, defaultValue?: any): Command;
        allowUnknownOption(arg?: boolean): Command;
        parse(argv: string[]): Command;
        parseOptions(argv: string[]): { args: string[], unknown: string[] };
        opts(): Object;
        version(): string;
        version(str: string, flags?: string): Command;
        description(): string;
        description(str: string): Command;
        alias(): string;
        alias(alias: string): Command;
        usage(): string;
        usage(str: string): Command;
        name(): string;
        outputHelp(cb?: FormatCallback);
        help(cb: FormatCallback);
    }
    class Option {
        flags: string;
        required: boolean;
        optional: boolean;
        bool: boolean;
        short: string;
        long: string;
        description: string;
        name(): string;
        is(arg: string): boolean;
    }
    export = new Command();
}