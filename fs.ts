import * as nfs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';
var createHash = require('sha.js');

module FileSystem {
    /**
     * Represents file system.
     * .jerk/ <= ROOT
     * |-1241aea1bd502fa41 <= FileObject
     * |-ada6d7c434effa807 <= FileObject
     * |-10fea7ba39da86f32.symlink <= SymlinkObject
     */
    export interface IFileSystem {
        /**
         * Resolve IFileSystemObject by its hash.
         * returns null if IFileSystemObject is not found.
         */
        resolveObjectByHash(hash: string): IFileSystemObject;
        /**
         * Resolve IFileSystemObject by contents.
         * Returns null if IFileSystemObject is not found.
         */
        resolveObjectByContents(contents: Buffer): IFileSystemObject;
        /**
         * List all entries in the File System. 
         * They are not related to any commits.
         */
        entries(): IFileSystemObject[];
        /**
         * Create new file object. Returns null if operation fails for some reason.
         */
        create(blob: Buffer): FileObject;
        /**
         * Create symlink. Returns null if operation fails for some reason.
         */
        symlink(path: string): SymlinkObject;
        /**
         * Try to remove IFileSystemObject. Returns true on success.
         */
        remove(id: string): boolean;
    }
    /**
     * Represents a single object in file tree.
     * It is possible that a file/symlink represented by this object does not exist.
     */
    export abstract class IFileSystemObject {
        constructor(private _hash: string, protected fs: FSImplementation) {
        }
        /**
         * Returns object content hash.
         */
        hash(): string {
            return this._hash;
        }
        /**
         * Returns full path to the current IFileSystemObject.
         * Guaranteed to be absolute from the root repo path.
         */
        abstract fullPath(): string;
        /**
         * Returns true if this IFileSystemObject represents file.
         * Useful in case you just want to check type without actually casting IFileSystemObject to its type.
         */
        abstract isFile(): boolean;
        /**
         * Returns true if this IFileSystemObject represents symlink.
         * Useful in case you just want to check type without actually casting IFileSystemObject to its type.
         */
        abstract isSymlink(): boolean;
        /**
         * Returns this IFileSystemObject if this IFileSystemObject represents file, null otherwise.
         * Typical usecase:
         ```
         var fso: IFileSystemObject = ...;
         var file: FileObject;
         if (!!(file = fso.asFile())) {
         console.log(file.contentHash());
         }
         ```
         */
        abstract asFile(): FileObject;
        /**
         * Returns this IFileSystemObject if this IFileSystemObject represents symlink, null otherwise.
         * Typical usecase:
         ```
         var fso: IFileSystemObject = ...;
         var sym: SymlinkObject;
         if (!!(sym = fso.asSymlink())) {
         console.log(sym.symlinkPath());
         }
         ```     
         */
        abstract asSymlink(): SymlinkObject;
    }
    export abstract class FileObject extends IFileSystemObject {
        /**
         * Get byte Buffer file contents.
         */
        abstract buffer(): Buffer;
        /**
         * Returns size of this file.
         */
        abstract size(): number;
    }
    export abstract class SymlinkObject extends IFileSystemObject {
        /**
         * Returns path of the node this symlink is pointing to.
         * It is not guaranteed that it will be absolute path from the root repo path.
         * To resolve path use IFileSystem#resolveObjectRelativeTo.
         */
        abstract symlinkPath(): string;
    }

    class FObject extends FileObject {
        constructor(_hash: string, fs: FSImplementation) {
            super(_hash, fs);
        }
        buffer(): Buffer {
            return nfs.readFileSync(this.fullPath());
        }
        size(): number {
            return this.buffer().length;
        }
        fullPath(): string {
            return path.join(this.fs.root, this.hash());
        }
        isFile(): boolean {
            return true;
        }
        isSymlink(): boolean {
            return false;
        }
        asFile(): FileObject {
            return this;
        }
        asSymlink(): SymlinkObject {
            return null;
        }
    }

    class SObject extends SymlinkObject {
        constructor(_hash: string, fs: FSImplementation) {
            super(_hash, fs);
        }
        symlinkPath(): string {
            return nfs.readFileSync(this.fullPath(), 'utf8');
        }
        fullPath(): string {
            return path.join(this.fs.root, this.hash() + '.symlink');
        }
        isFile(): boolean {
            return false;
        }
        isSymlink(): boolean {
            return true;
        }
        asFile(): FileObject {
            return null;
        }
        asSymlink(): SymlinkObject {
            return this;
        }
    }
    class FSImplementation implements IFileSystem {
        constructor(public server: boolean = false) {
            fse.ensureDirSync(path.join(this.root));
        }
        get root(): string { return path.join(this.server ? '.' : '.jerk', 'objects'); }
        resolveObjectByHash(hash: string): IFileSystemObject {
            return this.resolveHash(hash);
        }
        resolveObjectByContents(contents: Buffer): IFileSystemObject {
            return this.resolveHash(createHash('sha256').update(contents).digest('hex'));
        }
        entries(): IFileSystemObject[] {
            return nfs.readdirSync(this.root).filter(v => v.length > 60).map(v => this.resolveHash(v));
        }
        create(blob: Buffer): FileObject {
            var hash = createHash('sha256').update(blob).digest('hex');
            nfs.writeFileSync(path.join(this.root, hash), blob, { mode: 0o644 });
            return new FObject(hash, this);
        }
        symlink(target: string): SymlinkObject {
            var hash = createHash('sha256').update(target, 'utf8').digest('hex');
            nfs.writeFileSync(path.join(this.root, hash + ".symlink"), target, { encoding: 'utf8', mode: 0o644 });
            return new SObject(hash, this);
        }
        remove(id: string): boolean {
            var o = this.resolveHash(id);
            try {
                nfs.unlinkSync(o.fullPath());
                return true;
            } catch (e) {
                return false;
            }
        }
        private resolveHash(hash: string): IFileSystemObject {
            try {
                var stat = nfs.statSync(path.join(this.root, hash))
                return new FObject(hash, this);
            } catch (e) {
                try {
                    var lstat = nfs.lstatSync(path.join(this.root, hash + '.symlink'));
                    return new SObject(hash, this);
                } catch (e1) {
                    return null;
                }
            }

        }
    }
    /**
     * Returns current file system implementation.
     * It is possible that multiple instances of IFileSystem can exist at the same time.
     * But it is not recommended for obvious implementation reasons.
     */
    export function fs(server: boolean = false): IFileSystem { return new FSImplementation(server); }
}
export = FileSystem;