// A minimal PNG encoder (RGBA, 8-bit, stored deflate blocks). Thumbnails are small, so skipping
// compression keeps this tiny and fast; the menu caches them anyway.

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** `rgba` is top row first, width*height*4 bytes. */
export function encodePng(rgba: Uint8Array, width: number, height: number): ArrayBuffer {
    const rowLen = width * 4 + 1; // filter byte + pixels
    const raw = new Uint8Array(rowLen * height);
    for (let y = 0; y < height; y++) {
        raw[y * rowLen] = 0; // filter: none
        raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * rowLen + 1);
    }

    // zlib stream of stored (uncompressed) deflate blocks, max 65535 bytes each.
    const blocks = Math.max(1, Math.ceil(raw.length / 65535));
    const zlib = new Uint8Array(2 + raw.length + blocks * 5 + 4);
    zlib[0] = 0x78;
    zlib[1] = 0x01;
    let o = 2;
    for (let i = 0; i < blocks; i++) {
        const start = i * 65535;
        const len = Math.min(65535, raw.length - start);
        zlib[o++] = i === blocks - 1 ? 1 : 0;
        zlib[o++] = len & 0xff;
        zlib[o++] = len >>> 8;
        zlib[o++] = ~len & 0xff;
        zlib[o++] = (~len >>> 8) & 0xff;
        zlib.set(raw.subarray(start, start + len), o);
        o += len;
    }
    let a = 1;
    let b = 0;
    for (let i = 0; i < raw.length; i++) {
        a = (a + raw[i]) % 65521;
        b = (b + a) % 65521;
    }
    const adler = ((b << 16) | a) >>> 0;
    zlib[o++] = adler >>> 24;
    zlib[o++] = (adler >>> 16) & 0xff;
    zlib[o++] = (adler >>> 8) & 0xff;
    zlib[o++] = adler & 0xff;

    const chunks: [string, Uint8Array][] = [
        ["IHDR", (() => {
            const h = new Uint8Array(13);
            const v = new DataView(h.buffer);
            v.setUint32(0, width);
            v.setUint32(4, height);
            h[8] = 8; // bit depth
            h[9] = 6; // RGBA
            return h;
        })()],
        ["IDAT", zlib],
        ["IEND", new Uint8Array(0)],
    ];
    const total = 8 + chunks.reduce((n, [, d]) => n + 12 + d.length, 0);
    const out = new Uint8Array(total);
    out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const view = new DataView(out.buffer);
    let p = 8;
    for (const [type, data] of chunks) {
        view.setUint32(p, data.length);
        for (let i = 0; i < 4; i++) out[p + 4 + i] = type.charCodeAt(i);
        out.set(data, p + 8);
        view.setUint32(p + 8 + data.length, crc32(out, p + 4, p + 8 + data.length));
        p += 12 + data.length;
    }
    return out.buffer;
}

/** Box-filter downscale so the longest side is at most `max` (keeps aspect). */
export function shrink(rgba: Uint8Array, w: number, h: number, max: number): { rgba: Uint8Array; width: number; height: number } {
    const k = Math.max(w, h) / max;
    if (k <= 1) return { rgba, width: w, height: h };
    const nw = Math.max(1, Math.round(w / k));
    const nh = Math.max(1, Math.round(h / k));
    const out = new Uint8Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
        const y0 = Math.floor((y * h) / nh);
        const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / nh));
        for (let x = 0; x < nw; x++) {
            const x0 = Math.floor((x * w) / nw);
            const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / nw));
            let r = 0, g = 0, b = 0, a = 0, n = 0; // prettier-ignore
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * w + xx) * 4;
                    const al = rgba[i + 3];
                    r += rgba[i] * al;
                    g += rgba[i + 1] * al;
                    b += rgba[i + 2] * al;
                    a += al;
                    n++;
                }
            }
            const o = (y * nw + x) * 4;
            if (a > 0) {
                out[o] = Math.round(r / a);
                out[o + 1] = Math.round(g / a);
                out[o + 2] = Math.round(b / a);
            }
            out[o + 3] = Math.round(a / n);
        }
    }
    return { rgba: out, width: nw, height: nh };
}
