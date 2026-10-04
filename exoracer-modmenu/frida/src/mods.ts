import "frida-il2cpp-bridge";
import { dataController, equipped, gameClass } from "./game.js";
import { extension, listFiles } from "./fsutil.js";
import { sharedWith } from "./scanner.js";
import { color, isAlive, uclass } from "./unity.js";

// The mod loader. Every .js file in ExoMenu/mods is a mod. It gets an `api` object and can register
// features (a switch in the Mods tab, optional settings and a keybind). Mods run inside the game
// with the same power as ExoMenu itself, so only install mods you trust.

type Log = (message: string) => void;

export type ModSettingSpec =
    | { id: string; label: string; type: "toggle"; default: boolean }
    | { id: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number }
    | { id: string; label: string; type: "text"; default: string }
    | { id: string; label: string; type: "color"; default: string };

export interface ModFeatureSpec {
    id: string;
    name: string;
    description?: string;
    settings?: ModSettingSpec[];
    onEnable?: (values: Record<string, unknown>) => void;
    onDisable?: () => void;
    onSettingChange?: (id: string, value: unknown, values: Record<string, unknown>) => void;
}

interface Feature extends ModFeatureSpec {
    key: string; // "<file>:<id>"
    mod: string;
    enabled: boolean;
    values: Record<string, unknown>;
}

interface ModInfo {
    file: string;
    name: string;
    version: string;
    author: string;
    description: string;
    error: string | null;
    features: string[];
}

export interface SavedModState {
    disabledMods: string[];
    features: Record<string, { enabled: boolean; values: Record<string, unknown> }>;
}

/** What ExoMenu itself lets mods do. */
export interface ModHost {
    /** Change looks for this session (name colour, background…) without saving them. */
    looks(patch: Record<string, unknown>): Promise<void>;
    /** Run a keybind action, e.g. "music.next" or "own.toggle". */
    run(action: string): Promise<void>;
}

let host: ModHost = { looks: async () => {}, run: async () => {} };
let dir = "";
let log: Log = () => {};
let saved: SavedModState = { disabledMods: [], features: {} };
let save: (s: SavedModState) => void = () => {};
const mods = new Map<string, ModInfo>();
const features = new Map<string, Feature>();
const timers = new Map<string, Set<ReturnType<typeof setInterval>>>();
const levelListeners: { mod: string; cb: () => void }[] = [];

function track(mod: string, t: ReturnType<typeof setInterval>) {
    if (!timers.has(mod)) timers.set(mod, new Set());
    timers.get(mod)!.add(t);
    return t;
}

function makeApi(file: string, info: ModInfo) {
    const modLog = (...parts: unknown[]) => log(`[${info.name}] ${parts.map(String).join(" ")}`);
    return {
        version: "1",
        log: modLog,
        /** Name, version, author, description shown in the Mods tab. */
        info(meta: Partial<Pick<ModInfo, "name" | "version" | "author" | "description">>) {
            Object.assign(info, meta);
        },
        registerFeature(spec: ModFeatureSpec) {
            if (!spec?.id || !spec.name) throw new Error("registerFeature needs an id and a name");
            const key = `${file}:${spec.id}`;
            const values: Record<string, unknown> = {};
            for (const s of spec.settings ?? []) values[s.id] = s.default;
            const stored = saved.features[key];
            const feature: Feature = { ...spec, key, mod: file, enabled: false, values: { ...values, ...(stored?.values ?? {}) } };
            features.set(key, feature);
            info.features.push(key);
            if (stored?.enabled) setFeature(key, true).catch(e => modLog(`couldn't turn on ${spec.name}: ${e}`));
        },
        /** Run code on Unity's main thread (needed for anything touching game objects). */
        main<T>(fn: () => T): Promise<T> {
            return Il2Cpp.perform(fn, "main");
        },
        every(ms: number, fn: () => void) {
            return track(file, setInterval(() => {
                try {
                    fn();
                } catch (e) {
                    modLog(`timer error: ${e}`);
                }
            }, Math.max(50, ms)));
        },
        after(ms: number, fn: () => void) {
            return track(file, setTimeout(fn, ms));
        },
        clear(t: ReturnType<typeof setInterval>) {
            clearInterval(t);
            timers.get(file)?.delete(t);
        },
        onLevelStart(cb: () => void) {
            levelListeners.push({ mod: file, cb });
        },
        game: {
            dataController,
            equipped,
            gameClass,
            /** Your current skin, trail, etc. ("get_Skin", "get_Trail", …). */
            wearing: () => ({ skin: equipped("get_Skin"), glider: equipped("get_GliderSkin"), hook: equipped("get_HookSkin"), trail: equipped("get_Trail") }),
        },
        unity: { uclass, color, isAlive },
        looks: (patch: Record<string, unknown>) => host.looks(patch).catch(e => modLog(`looks: ${e}`)),
        run: (action: string) => host.run(action).catch(e => modLog(`run ${action}: ${e}`)),
        music: {
            play: () => host.run("music.toggle"),
            next: () => host.run("music.next"),
            previous: () => host.run("music.prev"),
        },
        Il2Cpp,
    };
}

function loadMod(file: string): void {
    const info: ModInfo = { file, name: file.replace(/\.js$/, ""), version: "", author: "", description: "", error: null, features: [] };
    mods.set(file, info);
    if (saved.disabledMods.includes(file)) return;
    try {
        const code = File.readAllText(`${dir}/${file}`);
        // eslint-disable-next-line no-new-func
        new Function("api", "Il2Cpp", `"use strict";\n${code}\n//# sourceURL=mods/${file}`)(makeApi(file, info), Il2Cpp);
        log(`Mods: loaded ${info.name}${info.features.length ? ` (${info.features.length} features)` : ""}`);
    } catch (e) {
        info.error = (e as Error).message ?? String(e);
        log(`Mods: ${file} failed to load: ${(e as Error).stack ?? e}`);
    }
}

function unloadMod(file: string): void {
    for (const key of mods.get(file)?.features ?? []) {
        const f = features.get(key);
        if (f?.enabled) {
            try {
                f.onDisable?.();
            } catch {}
        }
        features.delete(key);
    }
    for (const t of timers.get(file) ?? []) clearInterval(t);
    timers.delete(file);
    for (let i = levelListeners.length - 1; i >= 0; i--) if (levelListeners[i].mod === file) levelListeners.splice(i, 1);
    mods.delete(file);
}

function persist(): void {
    for (const f of features.values()) saved.features[f.key] = { enabled: f.enabled, values: f.values };
    save(saved);
}

export async function setFeature(key: string, on: boolean): Promise<void> {
    const f = features.get(key);
    if (!f) throw new Error("That mod feature isn't loaded.");
    if (f.enabled === on) return;
    try {
        if (on) await Promise.resolve(f.onEnable?.(f.values));
        else await Promise.resolve(f.onDisable?.());
        f.enabled = on;
    } finally {
        persist();
    }
}

export async function setFeatureValue(key: string, id: string, value: unknown): Promise<void> {
    const f = features.get(key);
    if (!f) throw new Error("That mod feature isn't loaded.");
    f.values[id] = value;
    persist();
    if (f.enabled) await Promise.resolve(f.onSettingChange?.(id, value, f.values));
}

export function setModEnabled(file: string, on: boolean): void {
    saved.disabledMods = saved.disabledMods.filter(f => f !== file);
    if (!on) saved.disabledMods.push(file);
    persist();
    unloadMod(file);
    loadMod(file);
}

export function reloadMods(): void {
    for (const file of [...mods.keys()]) unloadMod(file);
    for (const file of listFiles(dir).filter(n => extension(n) === "js")) loadMod(file);
}

export function startMods(folder: string, state: SavedModState, saveState: (s: SavedModState) => void, logger: Log, modHost?: ModHost): void {
    if (modHost) host = modHost;
    dir = folder;
    log = logger;
    saved = { disabledMods: state?.disabledMods ?? [], features: state?.features ?? {} };
    save = saveState;
    try {
        hookLevelStart();
    } catch (e) {
        log(`Mods: onLevelStart isn't available (${e})`);
    }
    reloadMods();
}

function hookLevelStart(): void {
    const method = gameClass("NyanStudio.GameScreen")?.tryMethod("Open", 1);
    if (!method || method.virtualAddress.isNull() || sharedWith(method).length > 0) return log("Mods: onLevelStart isn't available");
    Interceptor.attach(method.virtualAddress, {
        onLeave() {
            for (const { cb, mod } of levelListeners) {
                try {
                    cb();
                } catch (e) {
                    log(`[${mods.get(mod)?.name ?? mod}] onLevelStart error: ${e}`);
                }
            }
        },
    });
}

export function modsStatus() {
    return {
        mods: [...mods.values()].map(m => ({ ...m, enabled: !saved.disabledMods.includes(m.file) })),
        features: [...features.values()].map(f => ({
            key: f.key,
            mod: f.mod,
            name: f.name,
            description: f.description ?? "",
            enabled: f.enabled,
            settings: f.settings ?? [],
            values: f.values,
        })),
    };
}

export function hasFeature(key: string): boolean {
    return features.has(key);
}

export function featureEnabled(key: string): boolean {
    return !!features.get(key)?.enabled;
}
