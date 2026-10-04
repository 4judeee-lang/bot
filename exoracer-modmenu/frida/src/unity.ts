import "frida-il2cpp-bridge";

// Unity helpers: classes, structs, typed arrays, and turning image files into sprites.
// Everything here must run on Unity's main thread.

export function uclass(assembly: string, name: string): Il2Cpp.Class | null {
    return Il2Cpp.domain.tryAssembly(assembly)?.image.tryClass(name) ?? null;
}

function need(assembly: string, name: string): Il2Cpp.Class {
    const k = uclass(assembly, name);
    if (!k) throw new Error(`${name} isn't in this build of the game`);
    return k;
}

const core = (name: string) => need("UnityEngine.CoreModule", name);

/** The System.Type object for a class, for GetComponent(Type)-style calls. */
export function typeOf(klass: Il2Cpp.Class): Il2Cpp.Object {
    return klass.type.object;
}

function struct(klass: Il2Cpp.Class, fields: Record<string, number>): Il2Cpp.ValueType {
    const v = klass.alloc().unbox();
    for (const [name, value] of Object.entries(fields)) v.field(name).value = value;
    return v;
}

/** "#rrggbb" or "#rrggbbaa" → UnityEngine.Color. */
export function color(hex: string, alpha = 1): Il2Cpp.ValueType {
    const h = hex.replace("#", "");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return struct(core("UnityEngine.Color"), { r: n(0), g: n(2), b: n(4), a: h.length >= 8 ? n(6) : alpha });
}

export function hsv(h: number, s = 1, v = 1): string {
    const f = (n: number) => {
        const k = (n + h * 6) % 6;
        return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return "#" + [f(5), f(3), f(1)].map(x => x.toString(16).padStart(2, "0")).join("");
}

const pins: Il2Cpp.GCHandle[] = [];
/** Keeps a Unity object alive for the whole session (sprites, textures, clips we reuse). */
export function keep<T extends Il2Cpp.Object>(obj: T): T {
    pins.push(obj.ref(true));
    return obj;
}

export function byteArray(bytes: ArrayBuffer): Il2Cpp.Array<number> {
    const arr = Il2Cpp.array<number>(Il2Cpp.corlib.class("System.Byte"), bytes.byteLength);
    arr.handle.add(Il2Cpp.Array.headerSize).writeByteArray(bytes);
    return arr;
}

export function floatArray(samples: Float32Array): Il2Cpp.Array<number> {
    const arr = Il2Cpp.array<number>(Il2Cpp.corlib.class("System.Single"), samples.length);
    arr.handle.add(Il2Cpp.Array.headerSize).writeByteArray(samples.buffer.slice(samples.byteOffset, samples.byteOffset + samples.byteLength) as ArrayBuffer);
    return arr;
}

export function vector3(x: number, y: number, z: number): Il2Cpp.ValueType {
    return struct(core("UnityEngine.Vector3"), { x, y, z });
}

export function readVector3(v: Il2Cpp.ValueType): { x: number; y: number; z: number } {
    return { x: v.field<number>("x").value, y: v.field<number>("y").value, z: v.field<number>("z").value };
}

export const PIXELS_PER_UNIT = 100;

function spriteFromTexture(tex: Il2Cpp.Object, w: number, h: number): Il2Cpp.Object {
    const rect = struct(core("UnityEngine.Rect"), { m_XMin: 0, m_YMin: 0, m_Width: w, m_Height: h });
    const pivot = struct(core("UnityEngine.Vector2"), { x: 0.5, y: 0.5 });
    const sprite = core("UnityEngine.Sprite")
        .method<Il2Cpp.Object>("Create", 4)
        .overload("UnityEngine.Texture2D", "UnityEngine.Rect", "UnityEngine.Vector2", "System.Single")
        .invoke(tex, rect, pivot, PIXELS_PER_UNIT);
    keep(tex);
    return keep(sprite);
}

/** Width and height from a PNG or JPEG header, without decoding it. */
export function imageSize(bytes: ArrayBuffer): { width: number; height: number } | null {
    const b = new Uint8Array(bytes);
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
        const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
        return { width: u32(16), height: u32(20) };
    }
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
        let p = 2;
        while (p + 9 < b.length) {
            if (b[p] !== 0xff) {
                p++;
                continue;
            }
            const marker = b[p + 1];
            const len = (b[p + 2] << 8) | b[p + 3];
            // SOF0..SOF15, except DHT (C4), JPG (C8) and DAC (CC)
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return { height: (b[p + 5] << 8) | b[p + 6], width: (b[p + 7] << 8) | b[p + 8] };
            }
            p += 2 + len;
        }
    }
    return null;
}

export const MAX_SOURCE_SIDE = 8192;

/**
 * Main thread. Shrinks a texture to at most `maxSide` on its longest side on the GPU (the original
 * is destroyed). The result can't be read back by the CPU, so it costs no extra memory.
 */
export function fitTexture(tex: Il2Cpp.Object, maxSide: number): { tex: Il2Cpp.Object; width: number; height: number } {
    const w = tex.method<number>("get_width").invoke();
    const h = tex.method<number>("get_height").invoke();
    if (Math.max(w, h) <= maxSide) return { tex, width: w, height: h };
    const k = maxSide / Math.max(w, h);
    const nw = Math.max(1, Math.round(w * k));
    const nh = Math.max(1, Math.round(h * k));
    const rtClass = core("UnityEngine.RenderTexture");
    const rt = rtClass.method<Il2Cpp.Object>("GetTemporary", 2).overload("System.Int32", "System.Int32").invoke(nw, nh);
    const previous = rtClass.method<Il2Cpp.Object>("get_active").invoke();
    try {
        core("UnityEngine.Graphics").method("Blit", 2).overload("UnityEngine.Texture", "UnityEngine.RenderTexture").invoke(tex, rt);
        rtClass.method("set_active").invoke(rt);
        const out = core("UnityEngine.Texture2D").alloc();
        out.method(".ctor", 2).invoke(nw, nh);
        const rect = struct(core("UnityEngine.Rect"), { m_XMin: 0, m_YMin: 0, m_Width: nw, m_Height: nh });
        out.method("ReadPixels", 3).overload("UnityEngine.Rect", "System.Int32", "System.Int32").invoke(rect, 0, 0);
        out.method("Apply", 2).invoke(true, true);
        return { tex: out, width: nw, height: nh };
    } finally {
        rtClass.method("set_active").invoke(previous);
        rtClass.method("ReleaseTemporary").invoke(rt);
        core("UnityEngine.Object").method("Destroy", 1).invoke(tex);
    }
}

/** Main thread. PNG/JPG bytes as a Sprite no bigger than `maxSide`, with its pixel size. */
export function spriteFromImageBytes(bytes: ArrayBuffer, name: string, maxSide: number): { sprite: Il2Cpp.Object; width: number; height: number } {
    const size = imageSize(bytes);
    if (!size) throw new Error(`${name} isn't a PNG or JPG file (it may just be named like one)`);
    if (size.width > MAX_SOURCE_SIDE || size.height > MAX_SOURCE_SIDE) throw new Error(`${name} is too big (${size.width}×${size.height}); make it ${MAX_SOURCE_SIDE} pixels or smaller`);
    const imageConversion = uclass("UnityEngine.ImageConversionModule", "UnityEngine.ImageConversion");
    if (!imageConversion) throw new Error("this build of the game can't decode PNG/JPG files; use a GIF instead (a one-frame GIF works for still pictures)");
    const tex = core("UnityEngine.Texture2D").alloc();
    tex.method(".ctor", 2).invoke(2, 2);
    const load3 = imageConversion.tryMethod<boolean>("LoadImage", 3);
    // markNonReadable: the pixels live on the GPU only, halving the memory a picture costs.
    const ok = load3 ? load3.invoke(tex, byteArray(bytes), true) : imageConversion.method<boolean>("LoadImage", 2).invoke(tex, byteArray(bytes));
    if (!ok) throw new Error(`couldn't read ${name} as an image (use PNG or JPG)`);
    const fit = fitTexture(tex, maxSide);
    return { sprite: spriteFromTexture(fit.tex, fit.width, fit.height), width: fit.width, height: fit.height };
}

/** A PNG/JPG file as a Sprite, with its pixel size. */
export function spriteFromImageFile(path: string, maxSide = 2560): { sprite: Il2Cpp.Object; width: number; height: number } {
    return spriteFromImageBytes(File.readAllBytes(path), path.split("/").pop() ?? path, maxSide);
}

/** RGBA pixels (top row first) as a Sprite. */
export function spriteFromRgba(rgba: Uint8Array, width: number, height: number): Il2Cpp.Object {
    const tex = core("UnityEngine.Texture2D").alloc();
    tex.method(".ctor", 2).invoke(width, height);
    // Color32 is 4 bytes (r, g, b, a), so a Color32[] is laid out exactly like RGBA bytes.
    // Unity's rows go bottom-up, so flip while copying.
    const pixels = Il2Cpp.array<Il2Cpp.ValueType>(core("UnityEngine.Color32"), width * height);
    const base = pixels.handle.add(Il2Cpp.Array.headerSize);
    const row = width * 4;
    for (let y = 0; y < height; y++) {
        const src = rgba.subarray(y * row, (y + 1) * row);
        base.add((height - 1 - y) * row).writeByteArray(src.buffer.slice(src.byteOffset, src.byteOffset + row) as ArrayBuffer);
    }
    tex.method("SetPixels32", 1).invoke(pixels);
    tex.method("Apply", 2).invoke(true, true); // upload, then drop the CPU copy
    return spriteFromTexture(tex, width, height);
}

/** All components of a type under a GameObject (including inactive ones). */
export function componentsIn(gameObject: Il2Cpp.Object, klass: Il2Cpp.Class): Il2Cpp.Object[] {
    const arr = gameObject.method<Il2Cpp.Array<Il2Cpp.Object>>("GetComponentsInChildren", 2).overload("System.Type", "System.Boolean").invoke(typeOf(klass), true);
    return [...arr];
}

export function isAlive(obj: Il2Cpp.Object | null | undefined): boolean {
    if (!obj || obj.isNull()) return false;
    try {
        // A destroyed UnityEngine.Object has a null native pointer behind it.
        return !obj.field<NativePointer>("m_CachedPtr").value.isNull();
    } catch {
        return false;
    }
}
