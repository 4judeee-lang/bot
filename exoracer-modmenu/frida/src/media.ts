import "frida-il2cpp-bridge";
import { extension, listDirs, listFiles } from "./fsutil.js";
import { decodeGif } from "./gif.js";
import { shrink } from "./png.js";
import { spriteFromImageBytes, spriteFromRgba } from "./unity.js";

// Turns what you drop in a folder into sprites: a PNG/JPG, an animated GIF, or a sub-folder of
// frames (played in name order). Everything is cached, so switching back costs nothing.

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"];

export interface Media {
    name: string;
    frames: Il2Cpp.Object[];
    delaysMs: number[];
    width: number;
    height: number;
    note?: string;
}

export interface MediaEntry {
    name: string;
    kind: "image" | "gif" | "frames";
}

/** What's in a media folder: images, GIFs, and sub-folders of frames. */
export function listMedia(dir: string): MediaEntry[] {
    const out: MediaEntry[] = [];
    for (const name of listFiles(dir)) {
        const ext = extension(name);
        if (IMAGE_EXTENSIONS.includes(ext)) out.push({ name, kind: "image" });
        else if (ext === "gif") out.push({ name, kind: "gif" });
    }
    for (const name of listDirs(dir)) out.push({ name, kind: "frames" });
    return out;
}

/** Files in a media folder ExoMenu can't use (PDF, HEIC, WebP…), so the menu can say why. */
export function unusableMedia(dir: string): string[] {
    return listFiles(dir).filter(n => {
        const ext = extension(n);
        return !IMAGE_EXTENSIONS.includes(ext) && ext !== "gif";
    });
}

// Loading never happens on the game's main thread all at once: files are read and GIFs decoded on
// the agent thread, pictures are shrunk to a sensible size, and textures are created a few per frame.
// Animations stay under a memory budget. A marker file is written while a picture is being turned
// into textures, so if the game ever dies doing it, the next launch can skip that picture.

const ANIMATION_BUDGET = 128 * 1024 * 1024; // GPU bytes per animation
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_ANIMATION_SIDE = 1280;
const cache = new Map<string, Media>();
const loading = new Map<string, Promise<Media>>();
let markerPath = "";

export function setCrashMarker(path: string): void {
    markerPath = path;
}

/** What was loading when the game last closed unexpectedly, if anything (and clears it). */
export function takeCrashMarker(): string | null {
    if (!markerPath) return null;
    try {
        const name = File.readAllText(markerPath).trim();
        clearMarker();
        return name || null;
    } catch {
        return null;
    }
}

function setMarker(name: string): void {
    try {
        const f = new File(markerPath, "w");
        f.write(name);
        f.close();
    } catch {}
}

function clearMarker(): void {
    try {
        const f = new File(markerPath, "w"); // empty = nothing loading
        f.close();
    } catch {}
}

function key(dir: string, entry: MediaEntry, fps: number, maxSide: number): string {
    return `${dir}/${entry.name}@${entry.kind === "frames" ? fps : ""}@${maxSide}`;
}

/** Already loaded, or null. Safe anywhere. */
export function cachedMedia(dir: string, entry: MediaEntry, fps: number, maxSide: number): Media | null {
    return cache.get(key(dir, entry, fps, maxSide)) ?? null;
}

/** Loads a picture, GIF or frame folder as sprites without stalling the game. Call from the agent thread. */
export function prepareMedia(dir: string, entry: MediaEntry, fps: number, maxSide: number): Promise<Media> {
    const k = key(dir, entry, fps, maxSide);
    const done = cache.get(k);
    if (done) return Promise.resolve(done);
    let p = loading.get(k);
    if (!p) {
        p = build(dir, entry, fps, maxSide)
            .then(m => {
                cache.set(k, m);
                return m;
            })
            .finally(() => {
                loading.delete(k);
                clearMarker();
            });
        loading.set(k, p);
    }
    return p;
}

function readFile(path: string, name: string): ArrayBuffer {
    const bytes = File.readAllBytes(path);
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${name} is too big (${Math.round(bytes.byteLength / 1048576)} MB); keep files under 80 MB`);
    return bytes;
}

const onMain = <T>(fn: () => T) => Il2Cpp.perform(fn, "main");

async function build(dir: string, entry: MediaEntry, fps: number, maxSide: number): Promise<Media> {
    const path = `${dir}/${entry.name}`;
    const animSide = Math.min(maxSide, MAX_ANIMATION_SIDE);

    if (entry.kind === "image") {
        const bytes = readFile(path, entry.name);
        setMarker(entry.name);
        const s = await onMain(() => spriteFromImageBytes(bytes, entry.name, maxSide));
        return { name: entry.name, frames: [s.sprite], delaysMs: [0], width: s.width, height: s.height };
    }

    if (entry.kind === "gif") {
        const bytes = readFile(path, entry.name);
        const head = new Uint8Array(bytes, 0, Math.min(10, bytes.byteLength));
        if (head.length < 10) throw new Error(`${entry.name} isn't a GIF`);
        const w = head[6] | (head[7] << 8);
        const h = head[8] | (head[9] << 8);
        if (!w || !h || w > 8192 || h > 8192) throw new Error(`${entry.name} has an unusable size (${w}×${h})`);
        const k = Math.min(1, animSide / Math.max(w, h));
        const perFrame = Math.max(1, Math.round(w * k)) * Math.max(1, Math.round(h * k)) * 4;
        const maxFrames = Math.max(1, Math.min(240, Math.floor(ANIMATION_BUDGET / perFrame)));
        const shrunk: { rgba: Uint8Array | null; width: number; height: number; delayMs: number }[] = [];
        decodeGif(bytes, maxFrames, (canvas, delayMs) => {
            const s = shrink(canvas, w, h, animSide);
            shrunk.push({ rgba: s.rgba === canvas ? canvas.slice() : s.rgba, width: s.width, height: s.height, delayMs });
        });
        setMarker(entry.name);
        const frames: Il2Cpp.Object[] = [];
        for (let i = 0; i < shrunk.length; i += 4) {
            const batch = shrunk.slice(i, i + 4);
            frames.push(...(await onMain(() => batch.map(f => spriteFromRgba(f.rgba!, f.width, f.height)))));
            for (const f of batch) f.rgba = null; // let the JS copy go
        }
        return {
            name: entry.name,
            frames,
            delaysMs: shrunk.map(f => Math.max(20, f.delayMs)),
            width: shrunk[0].width,
            height: shrunk[0].height,
            note: shrunk.length === maxFrames && maxFrames < 240 ? `${entry.name} is a long GIF: only the first ${maxFrames} frames are used` : undefined,
        };
    }

    const files = listFiles(path).filter(n => IMAGE_EXTENSIONS.includes(extension(n)));
    if (files.length === 0) throw new Error(`the folder "${entry.name}" has no PNG/JPG frames`);
    const frames: Il2Cpp.Object[] = [];
    let width = 0;
    let height = 0;
    let limit = Math.min(240, files.length);
    for (let i = 0; i < limit; i++) {
        const bytes = readFile(`${path}/${files[i]}`, files[i]);
        setMarker(entry.name);
        const s = await onMain(() => spriteFromImageBytes(bytes, files[i], animSide));
        frames.push(s.sprite);
        if (i === 0) {
            width = s.width;
            height = s.height;
            limit = Math.min(limit, Math.max(1, Math.floor(ANIMATION_BUDGET / (width * height * 4))));
        }
    }
    return {
        name: entry.name,
        frames,
        delaysMs: frames.map(() => Math.round(1000 / Math.max(1, Math.min(60, fps)))),
        width,
        height,
        note: limit < Math.min(240, files.length) ? `"${entry.name}" is big: only the first ${limit} frames are used` : undefined,
    };
}

/**
 * Plays a Media on whatever `targets()` returns (SpriteRenderers or UI Images; anything with a
 * `sprite` property). One timer for the animation, nothing per frame when it's a still image.
 */
export class MediaPlayer {
    private media: Media | null = null;
    private index = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly targets: () => Il2Cpp.Object[],
        private readonly log: (m: string) => void,
    ) {}

    get current(): Media | null {
        return this.media;
    }

    /** Must run on the main thread. */
    start(media: Media): void {
        this.stop();
        this.media = media;
        this.index = 0;
        this.show();
        if (media.frames.length > 1) this.schedule();
    }

    stop(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.media = null;
    }

    /** The frame that should be showing now (for re-applying after the game resets a target). */
    frame(): Il2Cpp.Object | null {
        return this.media ? this.media.frames[this.index] : null;
    }

    /** Must run on the main thread. */
    show(): void {
        const frame = this.frame();
        if (!frame) return;
        for (const t of this.targets()) {
            try {
                t.method("set_sprite").invoke(frame);
            } catch {}
        }
    }

    private schedule(): void {
        const media = this.media;
        if (!media) return;
        this.timer = setTimeout(() => {
            if (this.media !== media) return;
            this.index = (this.index + 1) % media.frames.length;
            Il2Cpp.perform(() => this.show(), "main")
                .catch(e => this.log(`Animation frame failed: ${e}`))
                .finally(() => {
                    if (this.media === media) this.schedule(); // a newer start() runs its own loop
                });
        }, media.delaysMs[this.index] || 100);
    }
}
