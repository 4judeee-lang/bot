import "frida-il2cpp-bridge";
import { ensureDir } from "./fsutil.js";
import { gameClass, probeViews } from "./game.js";
import { encodePng, shrink } from "./png.js";
import { isAlive, keep, typeOf, uclass } from "./unity.js";

// Real pictures of skins, gliders, hooks, trails and profile icons for the menu.
//
// The game's own picker views (SkinView, GliderSkinView, HookSkinView, TrailView, PlayerIconView)
// each have Initialize(id), which puts that cosmetic's sprite into a UI Image. We keep one hidden,
// never-drawn "probe" of each, ask it for an id, then copy the sprite's pixels off the GPU (sprites
// live in atlases that can't be read directly), shrink and PNG-encode them. Thumbnails are made only
// when the menu asks for one, and cached in memory and on disk.

type Log = (message: string) => void;

export type ThumbKind = "skin" | "gliderSkin" | "hookSkin" | "trail" | "icon";

const VIEW_CLASS: Record<ThumbKind, string> = {
    skin: "NyanStudio.SkinView",
    gliderSkin: "NyanStudio.GliderSkinView",
    hookSkin: "NyanStudio.HookSkinView",
    trail: "NyanStudio.TrailView",
    icon: "NyanStudio.PlayerIconView",
};

const SIZE = 128;
let cacheDir = "";
let log: Log = () => {};
const memory = new Map<string, ArrayBuffer | null>(); // null = this id has no picture
const probes = new Map<ThumbKind, { view: Il2Cpp.Object; image: Il2Cpp.Object }>();

export function startThumbs(dir: string, logger: Log): void {
    cacheDir = dir;
    log = logger;
    ensureDir(dir);
}

const core = (n: string) => uclass("UnityEngine.CoreModule", n)!;

function probe(kind: ThumbKind): { view: Il2Cpp.Object; image: Il2Cpp.Object } | null {
    const existing = probes.get(kind);
    if (existing && isAlive(existing.view) && isAlive(existing.image)) return existing;
    const viewClass = gameClass(VIEW_CLASS[kind]);
    const imageClass = uclass("UnityEngine.UI", "UnityEngine.UI.Image");
    if (!viewClass || !imageClass) return null;
    const go = core("UnityEngine.GameObject").alloc();
    go.method(".ctor", 1).invoke(Il2Cpp.string(`ExoMenu Thumb Probe ${kind}`));
    // Active (so the game can load the picture with a coroutine) but never drawn: no Canvas.
    core("UnityEngine.Object").method("DontDestroyOnLoad").invoke(go);
    const addComponent = go.method<Il2Cpp.Object>("AddComponent", 1).overload("System.Type");
    const image = addComponent.invoke(typeOf(imageClass));
    const view = addComponent.invoke(typeOf(viewClass));
    view.field("image").value = image;
    keep(go);
    keep(image);
    keep(view);
    probeViews.add(view.handle.toString());
    const p = { view, image };
    probes.set(kind, p);
    return p;
}

/** Main thread: the sprite the game's picker would show for `id`, or null. */
function spriteFor(kind: ThumbKind, id: string): Il2Cpp.Object | null {
    const p = probe(kind);
    if (!p) return null;
    p.image.method("set_sprite").invoke(NULL);
    p.view.method("Initialize", 1).overload("System.String").invoke(Il2Cpp.string(id));
    const sprite = p.image.method<Il2Cpp.Object>("get_sprite").invoke();
    return sprite && !sprite.isNull() ? sprite : null;
}

function rect(x: number, y: number, w: number, h: number): Il2Cpp.ValueType {
    const v = core("UnityEngine.Rect").alloc().unbox();
    v.field("m_XMin").value = x;
    v.field("m_YMin").value = y;
    v.field("m_Width").value = w;
    v.field("m_Height").value = h;
    return v;
}

function vec2(x: number, y: number): Il2Cpp.ValueType {
    const v = core("UnityEngine.Vector2").alloc().unbox();
    v.field("x").value = x;
    v.field("y").value = y;
    return v;
}

/** Main thread: the sprite's pixels (top row first), drawn to fit SIZE×SIZE. */
function readSprite(sprite: Il2Cpp.Object): { rgba: Uint8Array; width: number; height: number } {
    const tex = sprite.method<Il2Cpp.Object>("get_texture").invoke();
    const texW = tex.method<number>("get_width").invoke();
    const texH = tex.method<number>("get_height").invoke();
    let r: Il2Cpp.ValueType;
    try {
        r = sprite.method<Il2Cpp.ValueType>("get_textureRect").invoke();
    } catch {
        r = sprite.method<Il2Cpp.ValueType>("get_rect").invoke(); // tightly packed sprites
    }
    const rx = r.field<number>("m_XMin").value;
    const ry = r.field<number>("m_YMin").value;
    const rw = r.field<number>("m_Width").value;
    const rh = r.field<number>("m_Height").value;
    const k = Math.min(1, SIZE / Math.max(rw, rh));
    const w = Math.max(1, Math.round(rw * k));
    const h = Math.max(1, Math.round(rh * k));

    // Blit just the sprite's part of the atlas into a small render texture, then read it back.
    const rtClass = core("UnityEngine.RenderTexture");
    const rt = rtClass.method<Il2Cpp.Object>("GetTemporary", 2).overload("System.Int32", "System.Int32").invoke(w, h);
    const previous = rtClass.method<Il2Cpp.Object>("get_active").invoke();
    try {
        core("UnityEngine.Graphics")
            .method("Blit", 4)
            .overload("UnityEngine.Texture", "UnityEngine.RenderTexture", "UnityEngine.Vector2", "UnityEngine.Vector2")
            .invoke(tex, rt, vec2(rw / texW, rh / texH), vec2(rx / texW, ry / texH));
        rtClass.method("set_active").invoke(rt);
        const readable = core("UnityEngine.Texture2D").alloc();
        readable.method(".ctor", 2).invoke(w, h);
        readable.method("ReadPixels", 3).overload("UnityEngine.Rect", "System.Int32", "System.Int32").invoke(rect(0, 0, w, h), 0, 0);
        readable.method("Apply", 0).invoke();
        const pixels = readable.method<Il2Cpp.Array<Il2Cpp.ValueType>>("GetPixels32", 0).invoke();
        const bottomUp = new Uint8Array(pixels.handle.add(Il2Cpp.Array.headerSize).readByteArray(w * h * 4)!);
        core("UnityEngine.Object").method("Destroy", 1).invoke(readable);
        const rgba = new Uint8Array(w * h * 4);
        for (let y = 0; y < h; y++) rgba.set(bottomUp.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
        return { rgba, width: w, height: h };
    } finally {
        rtClass.method("set_active").invoke(previous);
        rtClass.method("ReleaseTemporary").invoke(rt);
    }
}

function diskPath(kind: ThumbKind, id: string): string {
    return `${cacheDir}/${kind}-${id.replace(/[^A-Za-z0-9_.-]/g, "_")}.png`;
}

// Thumbnail requests are queued and made in small batches on the main thread (a few milliseconds
// per frame at most), so opening a picker with hundreds of items never stutters the game.
interface Job {
    kind: ThumbKind;
    id: string;
    done: (pixels: { rgba: Uint8Array; width: number; height: number } | null) => void;
}
const queue: Job[] = [];
let pumping = false;
const broken = new Map<ThumbKind, number>(); // consecutive errors per kind
const BATCH_MS = 6;

function pump(): void {
    if (pumping || queue.length === 0) return;
    pumping = true;
    Il2Cpp.perform(() => {
        const start = Date.now();
        while (queue.length && Date.now() - start < BATCH_MS) {
            const job = queue.shift()!;
            if ((broken.get(job.kind) ?? 0) >= 5) {
                job.done(null);
                continue;
            }
            try {
                const sprite = spriteFor(job.kind, job.id);
                job.done(sprite ? readSprite(sprite) : null);
                broken.set(job.kind, 0);
            } catch (e) {
                const n = (broken.get(job.kind) ?? 0) + 1;
                broken.set(job.kind, n);
                if (n === 5) log(`Thumbnails: giving up on ${job.kind} pictures: ${e}`);
                job.done(null);
            }
        }
    }, "main")
        .catch(e => {
            log(`Thumbnails: ${e}`);
            for (const job of queue.splice(0)) job.done(null);
        })
        .finally(() => {
            pumping = false;
            if (queue.length) setTimeout(pump, 16);
        });
}

/** A PNG thumbnail for a cosmetic, or null if the game has no picture for it. */
export async function thumbnail(kind: ThumbKind, id: string): Promise<ArrayBuffer | null> {
    if (!(kind in VIEW_CLASS)) return null;
    const key = `${kind}/${id}`;
    if (memory.has(key)) return memory.get(key)!;
    const path = diskPath(kind, id);
    try {
        const cached = File.readAllBytes(path);
        memory.set(key, cached);
        return cached;
    } catch {}

    const pixels = await new Promise<{ rgba: Uint8Array; width: number; height: number } | null>(done => {
        queue.push({ kind, id, done });
        pump();
    });
    if (!pixels) return null; // some pictures load asynchronously; don't remember a miss
    const small = shrink(pixels.rgba, pixels.width, pixels.height, SIZE);
    const png = encodePng(small.rgba, small.width, small.height);
    memory.set(key, png);
    try {
        const f = new File(path, "wb");
        f.write(png);
        f.close();
    } catch (e) {
        log(`Thumbnails: couldn't cache ${key}: ${e}`);
    }
    return png;
}
