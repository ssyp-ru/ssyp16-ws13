declare module "glob" {
    export function sync(path: string, options?: {
        dot?: boolean;
        nodir?: boolean;
        ignore?: string
    }): string[];
}
