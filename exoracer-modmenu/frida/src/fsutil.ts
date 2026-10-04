// Small file-system helpers Frida doesn't provide: listing a folder and creating one, via libc.

const libc = Process.platform === "darwin" ? null : Process.findModuleByName("libc.so.6");

function libcFn(name: string, ret: NativeFunctionReturnType, args: NativeFunctionArgumentType[]): NativeFunction<any, any> | null {
    const address = libc ? libc.findExportByName(name) : Module.findGlobalExportByName(name);
    return address ? new NativeFunction(address, ret, args) : null;
}

const opendir = libcFn("opendir", "pointer", ["pointer"]);
const readdir = libcFn("readdir", "pointer", ["pointer"]);
const closedir = libcFn("closedir", "int", ["pointer"]);
const mkdir = libcFn("mkdir", "int", ["pointer", "uint16"]);

// struct dirent: d_name sits at 21 on macOS (64-bit inodes) and 19 on Linux; d_type just before it.
const NAME_OFFSET = Process.platform === "darwin" ? 21 : 19;
const TYPE_OFFSET = Process.platform === "darwin" ? 20 : 18;
const DT_DIR = 4;

// macOS gives each name's length (d_namlen, just before d_type); Linux names are just NUL-terminated.
const NAMLEN_OFFSET = Process.platform === "darwin" ? 18 : -1;

/** Names that aren't valid UTF-8, seen while listing (shown in the menu so they can be renamed). */
export const unreadableNames: string[] = [];

/** A directory entry's name, or null if it can't be decoded (it's skipped instead of failing the listing). */
function entryName(entry: NativePointer): string | null {
    const at = entry.add(NAME_OFFSET);
    const length = NAMLEN_OFFSET >= 0 ? entry.add(NAMLEN_OFFSET).readU16() : -1;
    try {
        return length >= 0 ? at.readUtf8String(length) : at.readUtf8String();
    } catch {
        const bytes = new Uint8Array(at.readByteArray(length >= 0 ? Math.min(length, 255) : 255)!);
        const end = length >= 0 ? bytes.length : bytes.indexOf(0) < 0 ? bytes.length : bytes.indexOf(0);
        const hex = Array.from(bytes.subarray(0, end), b => b.toString(16).padStart(2, "0")).join(" ");
        if (!unreadableNames.includes(hex) && unreadableNames.length < 20) unreadableNames.push(hex);
        return null;
    }
}

function list(dir: string, wantDirs: boolean): string[] {
    if (!opendir || !readdir || !closedir) return [];
    const handle = opendir(Memory.allocUtf8String(dir)) as NativePointer;
    if (handle.isNull()) return [];
    const names: string[] = [];
    try {
        for (;;) {
            const entry = readdir(handle) as NativePointer;
            if (entry.isNull()) break;
            const name = entryName(entry);
            if (!name || name.startsWith(".")) continue;
            if ((entry.add(TYPE_OFFSET).readU8() === DT_DIR) !== wantDirs) continue;
            names.push(name);
        }
    } finally {
        closedir(handle);
    }
    return names.sort(naturalCompare);
}

/** "frame2" before "frame10" (Frida's JS engine ignores localeCompare's numeric option). */
export function naturalCompare(a: string, b: string): number {
    const re = /(\d+)|(\D+)/g;
    const pa = a.toLowerCase().match(re) ?? [];
    const pb = b.toLowerCase().match(re) ?? [];
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
        const x = pa[i];
        const y = pb[i];
        if (x === y) continue;
        const nx = /^\d/.test(x);
        const ny = /^\d/.test(y);
        if (nx && ny) return Number(x) - Number(y) || x.length - y.length;
        return x < y ? -1 : 1;
    }
    return pa.length - pb.length;
}

/** Visible files in a folder (not sub-folders), in natural order (frame2 before frame10). */
export function listFiles(dir: string): string[] {
    return list(dir, false);
}

/** Visible sub-folders of a folder, in natural order. */
export function listDirs(dir: string): string[] {
    return list(dir, true);
}

export function ensureDir(dir: string): void {
    mkdir?.(Memory.allocUtf8String(dir), 0o755); // EEXIST is fine
}

export function extension(name: string): string {
    const i = name.lastIndexOf(".");
    return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}
