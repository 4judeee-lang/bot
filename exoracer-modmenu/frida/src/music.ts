import "frida-il2cpp-bridge";
import { extension, listFiles } from "./fsutil.js";
import { floatArray, isAlive, keep, typeOf, uclass } from "./unity.js";
import { decodeWav } from "./wav.js";

// Your own music in the game: WAV files from ExoMenu/music (convert-music.command turns MP3/M4A
// into WAV). One AudioSource of ours that survives scene changes; a 1-second check for the end of a
// track; optionally mutes the game's looping music while yours plays.

type Log = (message: string) => void;

export interface MusicSettings {
    volume: number; // 0..1
    repeat: "all" | "one" | "off";
    shuffle: boolean;
    muteGameMusic: boolean;
    autoplay: boolean;
}

export const MUSIC_DEFAULTS: MusicSettings = { volume: 0.6, repeat: "all", shuffle: false, muteGameMusic: true, autoplay: false };

let dir = "";
let log: Log = () => {};
let settings: MusicSettings = { ...MUSIC_DEFAULTS };

let source: Il2Cpp.Object | null = null;
let current: string | null = null;
let playing = false;
let lastError: string | null = null;
const clips = new Map<string, { clip: Il2Cpp.Object; seconds: number }>();
const mutedByUs = new Set<string>();
let watchTimer: ReturnType<typeof setInterval> | null = null;
let muteTimer: ReturnType<typeof setInterval> | null = null;

const audio = (name: string) => uclass("UnityEngine.AudioModule", name);

export function tracks(): string[] {
    return listFiles(dir).filter(n => extension(n) === "wav");
}

export function unconverted(): string[] {
    return listFiles(dir).filter(n => ["mp3", "m4a", "aac", "aiff", "aif", "flac", "caf"].includes(extension(n)));
}

function ensureSource(): Il2Cpp.Object {
    if (isAlive(source)) return source!;
    const goClass = uclass("UnityEngine.CoreModule", "UnityEngine.GameObject")!;
    const go = goClass.alloc();
    go.method(".ctor", 1).invoke(Il2Cpp.string("ExoMenu Music"));
    uclass("UnityEngine.CoreModule", "UnityEngine.Object")!.method("DontDestroyOnLoad").invoke(go);
    const sourceClass = audio("UnityEngine.AudioSource");
    if (!sourceClass) throw new Error("this build of the game has no audio module");
    source = keep(go.method<Il2Cpp.Object>("AddComponent", 1).overload("System.Type").invoke(typeOf(sourceClass)));
    keep(go);
    return source!;
}

/** Decoding happens on the agent thread; only the Unity calls go to the main thread. */
async function clipFor(name: string): Promise<{ clip: Il2Cpp.Object; seconds: number }> {
    const cached = clips.get(name);
    if (cached) return cached;
    const wav = decodeWav(File.readAllBytes(`${dir}/${name}`));
    if (wav.seconds > 15 * 60) throw new Error(`${name} is longer than 15 minutes`);
    const made = await Il2Cpp.perform(() => {
        const clip = audio("UnityEngine.AudioClip")!
            .method<Il2Cpp.Object>("Create", 5)
            .overload("System.String", "System.Int32", "System.Int32", "System.Int32", "System.Boolean")
            .invoke(Il2Cpp.string(name), wav.samples.length / wav.channels, wav.channels, wav.sampleRate, false);
        clip.method("SetData", 2).invoke(floatArray(wav.samples), 0);
        return { clip: keep(clip), seconds: wav.seconds };
    }, "main");
    // Keep a few clips around for quick skipping back. Older ones are destroyed so their audio
    // memory is released (a 5-minute stereo track is ~100 MB as floats).
    clips.set(name, made);
    while (clips.size > 3) {
        const [oldName, old] = clips.entries().next().value!;
        clips.delete(oldName);
        if (oldName === current) continue;
        Il2Cpp.perform(() => uclass("UnityEngine.CoreModule", "UnityEngine.Object")!.method("Destroy", 1).invoke(old.clip), "main").catch(() => {});
    }
    return made;
}

export async function play(name?: string): Promise<void> {
    const list = tracks();
    const pick = name ?? current ?? list[0];
    if (!pick || !list.includes(pick)) throw new Error(list.length ? `${pick} isn't in the music folder` : "Put WAV files in the music folder first.");
    lastError = null;
    const { clip } = await clipFor(pick);
    await Il2Cpp.perform(() => {
        const s = ensureSource();
        s.method("set_clip").invoke(clip);
        s.method("set_loop").invoke(settings.repeat === "one");
        s.method("set_volume").invoke(settings.volume);
        s.method("Play", 0).invoke();
    }, "main");
    current = pick;
    playing = true;
    log(`Music: playing ${pick}`);
    startTimers();
}

export async function pause(): Promise<void> {
    playing = false;
    stopTimers();
    await Il2Cpp.perform(() => {
        if (isAlive(source)) source!.method("Pause").invoke();
        unmuteGame();
    }, "main");
}

export async function toggle(): Promise<void> {
    if (playing) return pause();
    return play();
}

export async function skip(step: number): Promise<void> {
    const list = tracks();
    if (list.length === 0) throw new Error("Put WAV files in the music folder first.");
    let i = current ? list.indexOf(current) : -1;
    if (settings.shuffle && list.length > 1) {
        let j = i;
        while (j === i) j = Math.floor(Math.random() * list.length);
        i = j;
    } else {
        i = (i + step + list.length) % list.length;
    }
    await play(list[i]);
}

function startTimers(): void {
    stopTimers();
    watchTimer = setInterval(() => {
        Il2Cpp.perform(() => isAlive(source) && source!.method<boolean>("get_isPlaying").invoke(), "main")
            .then(isPlaying => {
                if (!playing || isPlaying || settings.repeat === "one") return;
                if (settings.repeat === "off" && current === tracks().slice(-1)[0] && !settings.shuffle) {
                    playing = false;
                    stopTimers();
                    Il2Cpp.perform(() => unmuteGame(), "main").catch(() => {});
                    return;
                }
                skip(1).catch(e => (lastError = String(e)));
            })
            .catch(() => {});
    }, 1000);
    if (settings.muteGameMusic) {
        const mute = () => Il2Cpp.perform(() => muteGame(), "main").catch(() => {});
        mute();
        muteTimer = setInterval(mute, 4000); // levels start their own music; catch it
    }
}

function stopTimers(): void {
    if (watchTimer) clearInterval(watchTimer);
    if (muteTimer) clearInterval(muteTimer);
    watchTimer = muteTimer = null;
}

/** Mutes the game's looping AudioSources (its music), never ours. Main thread. */
function muteGame(): void {
    const sourceClass = audio("UnityEngine.AudioSource");
    if (!sourceClass) return;
    const objectClass = uclass("UnityEngine.CoreModule", "UnityEngine.Object")!;
    const find = objectClass.tryMethod<Il2Cpp.Array<Il2Cpp.Object>>("FindObjectsOfType", 1);
    if (!find) return;
    for (const s of find.overload("System.Type").invoke(typeOf(sourceClass))) {
        if (source && s.handle.equals(source.handle)) continue;
        if (!s.method<boolean>("get_loop").invoke() || s.method<boolean>("get_mute").invoke()) continue;
        s.method("set_mute").invoke(true);
        mutedByUs.add(s.handle.toString());
    }
}

function unmuteGame(): void {
    const sourceClass = audio("UnityEngine.AudioSource");
    const find = uclass("UnityEngine.CoreModule", "UnityEngine.Object")?.tryMethod<Il2Cpp.Array<Il2Cpp.Object>>("FindObjectsOfType", 1);
    if (!sourceClass || !find) return;
    for (const s of find.overload("System.Type").invoke(typeOf(sourceClass))) {
        if (mutedByUs.has(s.handle.toString())) s.method("set_mute").invoke(false);
    }
    mutedByUs.clear();
}

export async function updateMusic(next: MusicSettings): Promise<void> {
    const prev = settings;
    settings = { ...MUSIC_DEFAULTS, ...next };
    await Il2Cpp.perform(() => {
        if (!isAlive(source)) return;
        source!.method("set_volume").invoke(settings.volume);
        source!.method("set_loop").invoke(settings.repeat === "one");
        if (prev.muteGameMusic && !settings.muteGameMusic) unmuteGame();
    }, "main");
    if (playing && prev.muteGameMusic !== settings.muteGameMusic) startTimers();
}

export function startMusic(folder: string, initial: MusicSettings, logger: Log): void {
    dir = folder;
    log = logger;
    settings = { ...MUSIC_DEFAULTS, ...initial };
    if (settings.autoplay && tracks().length) play().catch(e => log(`Music autoplay failed: ${e}`));
}

export function musicStatus() {
    return { playing, current, tracks: tracks(), unconverted: unconverted(), error: lastError };
}
