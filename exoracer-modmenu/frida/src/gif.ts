// A small GIF decoder: every frame composited onto the full canvas as RGBA, top row first.
// Handles global/local palettes, transparency, interlacing and the common disposal methods.

export interface GifFrame {
    rgba: Uint8Array;
    delayMs: number;
}

export interface Gif {
    width: number;
    height: number;
    frames: GifFrame[];
}

function lzw(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
    const out = new Uint8Array(pixelCount);
    const clear = 1 << minCodeSize;
    const end = clear + 1;
    const prefix = new Int32Array(4096);
    const suffix = new Uint8Array(4096);
    const firstChar = new Uint8Array(4096);
    const stack = new Uint8Array(4097);
    let codeSize = minCodeSize + 1;
    let next = end + 1;
    let old = -1;
    let bits = 0;
    let datum = 0;
    let op = 0;
    for (let i = 0; i < clear; i++) {
        prefix[i] = -1;
        suffix[i] = i;
        firstChar[i] = i;
    }
    for (let pos = 0; pos < data.length && op < pixelCount; ) {
        while (bits < codeSize && pos < data.length) {
            datum |= data[pos++] << bits;
            bits += 8;
        }
        if (bits < codeSize) break;
        const code = datum & ((1 << codeSize) - 1);
        datum >>>= codeSize;
        bits -= codeSize;

        if (code === clear) {
            codeSize = minCodeSize + 1;
            next = end + 1;
            old = -1;
            continue;
        }
        if (code === end) break;

        let sp = 0;
        let c = code;
        if (old === -1) {
            out[op++] = suffix[code];
            old = code;
            continue;
        }
        if (code >= next) {
            // KwKwK case: the code isn't in the table yet.
            stack[sp++] = firstChar[old];
            c = old;
        }
        while (c > clear) {
            stack[sp++] = suffix[c];
            c = prefix[c];
        }
        stack[sp++] = suffix[c];
        if (next < 4096) {
            // New entry = previous string + first char of this one, so it starts like the previous one.
            prefix[next] = old;
            suffix[next] = suffix[c];
            firstChar[next] = firstChar[old];
            next++;
            if (next === 1 << codeSize && codeSize < 12) codeSize++;
        }
        while (sp > 0 && op < pixelCount) out[op++] = stack[--sp];
        old = code;
    }
    return out;
}

function deinterlace(indices: Uint8Array, w: number, h: number): Uint8Array {
    const out = new Uint8Array(indices.length);
    let src = 0;
    for (const [start, step] of [
        [0, 8],
        [4, 8],
        [2, 4],
        [1, 2],
    ]) {
        for (let y = start; y < h; y += step) {
            out.set(indices.subarray(src, src + w), y * w);
            src += w;
        }
    }
    return out;
}

export function decodeGif(buffer: ArrayBuffer, maxFrames = 240): Gif {
    const b = new Uint8Array(buffer);
    const sig = String.fromCharCode(...b.subarray(0, 6));
    if (sig !== "GIF87a" && sig !== "GIF89a") throw new Error("not a GIF file");
    const u16 = (i: number) => b[i] | (b[i + 1] << 8);
    const width = u16(6);
    const height = u16(8);
    const flags = b[10];
    let p = 13;
    let globalPalette: Uint8Array | null = null;
    if (flags & 0x80) {
        const size = 3 * (1 << ((flags & 7) + 1));
        globalPalette = b.subarray(p, p + size);
        p += size;
    }

    const canvas = new Uint8Array(width * height * 4);
    const frames: GifFrame[] = [];
    let delayMs = 100;
    let transparent = -1;
    let disposal = 0;

    const readSubBlocks = (): Uint8Array => {
        const parts: Uint8Array[] = [];
        let total = 0;
        while (p < b.length) {
            const len = b[p++];
            if (len === 0) break;
            parts.push(b.subarray(p, p + len));
            total += len;
            p += len;
        }
        const out = new Uint8Array(total);
        let o = 0;
        for (const part of parts) {
            out.set(part, o);
            o += part.length;
        }
        return out;
    };

    while (p < b.length && frames.length < maxFrames) {
        const block = b[p++];
        if (block === 0x3b) break; // trailer
        if (block === 0x21) {
            const label = b[p++];
            if (label === 0xf9) {
                const len = b[p];
                const packed = b[p + 1];
                disposal = (packed >> 2) & 7;
                delayMs = u16(p + 2) * 10 || 100;
                transparent = packed & 1 ? b[p + 4] : -1;
                p += len + 1;
                readSubBlocks();
            } else {
                readSubBlocks();
            }
            continue;
        }
        if (block !== 0x2c) throw new Error(`unexpected GIF block 0x${block.toString(16)}`);

        const fx = u16(p);
        const fy = u16(p + 2);
        const fw = u16(p + 4);
        const fh = u16(p + 6);
        const fflags = b[p + 8];
        p += 9;
        let palette = globalPalette;
        if (fflags & 0x80) {
            const size = 3 * (1 << ((fflags & 7) + 1));
            palette = b.subarray(p, p + size);
            p += size;
        }
        const minCodeSize = b[p++];
        let indices = lzw(readSubBlocks(), minCodeSize, fw * fh);
        if (fflags & 0x40) indices = deinterlace(indices, fw, fh);

        const before = disposal === 3 ? canvas.slice() : null;
        if (palette) {
            for (let y = 0; y < fh; y++) {
                const cy = fy + y;
                if (cy >= height) break;
                for (let x = 0; x < fw; x++) {
                    const cx = fx + x;
                    if (cx >= width) break;
                    const idx = indices[y * fw + x];
                    if (idx === transparent) continue;
                    const o = (cy * width + cx) * 4;
                    canvas[o] = palette[idx * 3];
                    canvas[o + 1] = palette[idx * 3 + 1];
                    canvas[o + 2] = palette[idx * 3 + 2];
                    canvas[o + 3] = 255;
                }
            }
        }
        frames.push({ rgba: canvas.slice(), delayMs });

        if (disposal === 2) {
            for (let y = fy; y < Math.min(height, fy + fh); y++) canvas.fill(0, (y * width + fx) * 4, (y * width + Math.min(width, fx + fw)) * 4);
        } else if (disposal === 3 && before) {
            canvas.set(before);
        }
        transparent = -1;
        disposal = 0;
        delayMs = 100;
    }
    if (frames.length === 0) throw new Error("the GIF has no frames");
    return { width, height, frames };
}
