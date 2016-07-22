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
        create(blob?: Buffer): FileObject;
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
    export interface IFileSystemObject {
        /**
         * Get name of this IFileSystemObject, like "test.jpg" or "dirname".
         */
        name(): string;
        /**
         * Returns object content hash.
         */
        hash(): string;
        /**
         * Get parent node of the FS tree.
         * Returns null if it is already root repo directory.
         */
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        // parent(): IFileSystemObject;
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        /**
         * Returns full path to the current IFileSystemObject.
         * Guaranteed to be absolute from the root repo path.
         */
        fullPath(): string;
        /**
         * Returns true if this IFileSystemObject represents file.
         * Useful in case you just want to check type without actually casting IFileSystemObject to its type.
         */
        isFile(): boolean;
        /**
         * Returns true if this IFileSystemObject represents symlink.
         * Useful in case you just want to check type without actually casting IFileSystemObject to its type.
         */
        isSymlink(): boolean;
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
        asFile(): FileObject;
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
        asSymlink(): SymlinkObject;

    }
    export interface FileObject extends
        IFileSystemObject {
        /**
         * Get byte Buffer file contents.
         */
        buffer(): Buffer;
        /**
         * Returns size of this file.
         */
        size(): number;
    }
    export interface SymlinkObject extends IFileSystemObject {
        /**
         * Returns path of the node this symlink is pointing to.
         * It is not guaranteed that it will be absolute path from the root repo path.
         * To resolve path use IFileSystem#resolveObjectRelativeTo.
         */
        symlinkPath(): string;
    }
    /**
     * Returns current file system implementation.
     * It is possible that multiple instances of IFileSystem can exist at the same time.
     * But it is not recommended for obvious implementation reasons.
     */
    export function fs(): IFileSystem { throw "Not Implemented"; }
}