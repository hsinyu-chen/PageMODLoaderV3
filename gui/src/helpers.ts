export function readFile(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        var fr = new FileReader();
        fr.onload = () => {
            resolve(fr.result as string)
        };
        fr.onerror = reject;
        fr.readAsText(file);
    });
}
async function getFileHandleRec(entry: FileSystemFileHandle | FileSystemDirectoryHandle, path: string[]): Promise<FileSystemFileHandle> {
    const name = path.shift();
    if (!name || entry.kind !== 'directory') {
        throw `file not exists`
    }
    if (path.length) {
        const subDir = await entry.getDirectoryHandle(name, { create: false })
        return await getFileHandleRec(subDir, path);
    }
    return await entry.getFileHandle(name, { create: false });
}
export async function getFileHandleDeep(entry: FileSystemDirectoryHandle, path: string): Promise<FileSystemFileHandle> {
    return await getFileHandleRec(entry, path.split('/'))
}