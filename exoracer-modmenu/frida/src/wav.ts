// WAV decoding for the music player: PCM 8/16/24/32-bit and 32-bit float, any channel count.
// Output is interleaved float samples in [-1, 1], which is what Unity's AudioClip.SetData wants.

export interface Wav {
    sampleRate: number;
    channels: number;
    samples: Float32Array; // interleaved
    seconds: number;
}

export function decodeWav(buffer: ArrayBuffer): Wav {
    const v = new DataView(buffer);
    const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");

    let format = 0;
    let channels = 0;
    let sampleRate = 0;
    let bits = 0;
    let dataOffset = -1;
    let dataLength = 0;
    for (let o = 12; o + 8 <= v.byteLength; ) {
        const id = tag(o);
        const size = v.getUint32(o + 4, true);
        const body = o + 8;
        if (id === "fmt ") {
            format = v.getUint16(body, true);
            channels = v.getUint16(body + 2, true);
            sampleRate = v.getUint32(body + 4, true);
            bits = v.getUint16(body + 14, true);
            if (format === 0xfffe && size >= 26) format = v.getUint16(body + 24, true); // WAVE_FORMAT_EXTENSIBLE
        } else if (id === "data") {
            dataOffset = body;
            dataLength = Math.min(size, v.byteLength - body);
            break;
        }
        o = body + size + (size & 1);
    }
    if (dataOffset < 0 || !channels || !sampleRate) throw new Error("the WAV file has no audio data");
    if (format !== 1 && format !== 3) throw new Error("unsupported WAV encoding (use 16-bit PCM)");

    const bytes = bits / 8;
    const count = Math.floor(dataLength / bytes);
    const samples = new Float32Array(count);
    let o = dataOffset;
    if (format === 3 && bits === 32) {
        for (let i = 0; i < count; i++, o += 4) samples[i] = v.getFloat32(o, true);
    } else if (bits === 16) {
        for (let i = 0; i < count; i++, o += 2) samples[i] = v.getInt16(o, true) / 32768;
    } else if (bits === 24) {
        for (let i = 0; i < count; i++, o += 3) {
            const x = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getInt8(o + 2) << 16);
            samples[i] = x / 8388608;
        }
    } else if (bits === 32) {
        for (let i = 0; i < count; i++, o += 4) samples[i] = v.getInt32(o, true) / 2147483648;
    } else if (bits === 8) {
        for (let i = 0; i < count; i++, o += 1) samples[i] = (v.getUint8(o) - 128) / 128;
    } else {
        throw new Error(`unsupported WAV bit depth ${bits}`);
    }
    return { sampleRate, channels, samples, seconds: count / channels / sampleRate };
}
