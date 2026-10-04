import "frida-il2cpp-bridge";
import { extension, listDirs, listFiles } from "./fsutil.js";
import { decodeGif } from "./gif.js";
import { spriteFromImageFile, spriteFromRgba } from "./unity.js";

// Turns what you drop in a folder into sprites: a PNG/JPG, an animated GIF, or a sub-folder of
// frames (played in name order). Everything is cached, so switching back costs nothing.

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"];
const MEMORY_BUDGET = 256 * 1024 * 1024; // decoded pixels per animation

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

const cache = new Map<string, Media>();

/** Must run on Unity's main thread. `fps` is used for frame folders (GIFs carry their own timing). */
export function loadMedia(dir: string, entry: MediaEntry, fps: number): Media {
    const key = `${dir}/${entry.name}@${entry.kind === "frames" ? fps : ""}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const path = `${dir}/${entry.name}`;
    let media: Media;
    if (entry.kind === "image") {
        const s = spriteFromImageFile(path);
        media = { name: entry.name, frames: [s.sprite], delaysMs: [0], width: s.width, height: s.height };
    } else if (entry.kind === "gif") {
        const peek = decodeGif(File.readAllBytes(path), 1);
        const perFrame = peek.width * peek.height * 4;
        const maxFrames = Math.max(1, Math.min(240, Math.floor(MEMORY_BUDGET / perFrame)));
        const gif = decodeGif(File.readAllBytes(path), maxFrames);
        media = {
            name: entry.name,
            frames: gif.frames.map(f => spriteFromRgba(f.rgba, gif.width, gif.height)),
            delaysMs: gif.frames.map(f => Math.max(20, f.delayMs)),
            width: gif.width,
            height: gif.height,
            note: gif.frames.length === maxFrames && maxFrames < 240 ? `large GIF: only the first ${maxFrames} frames are used` : undefined,
        };
    } else {
        const files = listFiles(path).filter(n => IMAGE_EXTENSIONS.includes(extension(n)));
        if (files.length === 0) throw new Error(`the folder "${entry.name}" has no PNG/JPG frames`);
        const loaded = files.slice(0, 240).map(n => spriteFromImageFile(`${path}/${n}`));
        media = {
            name: entry.name,
            frames: loaded.map(s => s.sprite),
            delaysMs: loaded.map(() => Math.round(1000 / Math.max(1, Math.min(60, fps)))),
            width: loaded[0].width,
            height: loaded[0].height,
        };
    }
    cache.set(key, media);
    return media;
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
