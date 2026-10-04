import "frida-il2cpp-bridge";
import { setOwnEverything, status as ownStatus } from "./cosmetics.js";
import { ensureDir } from "./fsutil.js";
import { serve, Request, Response } from "./http.js";
import { iconCatalog, LOOKS_DEFAULTS, LooksSettings, looksMedia, looksNotes, startLooks, updateLooks } from "./looks.js";
import { modsStatus, reloadMods, SavedModState, setFeature, setFeatureValue, setModEnabled, startMods, hasFeature, featureEnabled } from "./mods.js";
import { MUSIC_DEFAULTS, MusicSettings, musicStatus, pause, play, skip, startMusic, toggle as toggleMusic, updateMusic } from "./music.js";
import { replaceWithConstant, revertTarget } from "./native.js";
import { clearKey, DEFAULT_MENU_KEY, KeyBinding, keyState, listenForKey, revealFolder, setOverlaySize, startOverlay, toggleFromAgent } from "./overlay.js";
import { deepDump, dump, scan, ScanResult, Target } from "./scanner.js";
import { PAGE } from "./ui.js";
import { catalog, getExtraTrails, overrides, setExtraTrails, setOverride, Slot, SLOTS, traceEquipFlow } from "./wardrobe.js";

const VERSION = "0.6.0";
const FIRST_PORT = 7777;

// …/Exoracer/Exoracer.app/Contents/MacOS/Exoracer → …/Exoracer/ExoMenu (made by install-macos.sh)
const GAME_DIR = Process.mainModule.path.split("/").slice(0, -4).join("/");
const DATA_DIR = `${GAME_DIR}/ExoMenu`;
const FOLDERS = {
    backgrounds: `${DATA_DIR}/backgrounds`,
    skins: `${DATA_DIR}/skins`,
    pfp: `${DATA_DIR}/profile-pictures`,
    music: `${DATA_DIR}/music`,
    mods: `${DATA_DIR}/mods`,
    main: DATA_DIR,
};
const SETTINGS_PATH = `${DATA_DIR}/settings.json`;
const DUMP_PATH = `${DATA_DIR}/cosmetics-dump.txt`;
const DEEP_DUMP_PATH = `${DATA_DIR}/deep-dump.txt`;
const URL_PATH = `${DATA_DIR}/menu-url.txt`;

// ── logging ─────────────────────────────────────────────────────────────────────────────

let logFile: File | null = null;
try {
    logFile = new File(`${DATA_DIR}/exomenu.log`, "w");
} catch {}

function log(message: string): void {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${message}`;
    try {
        logFile?.write(line + "\n");
        logFile?.flush();
    } catch {}
}

/** Replaces a file's contents ("w" truncates first; File.writeAllText left stale bytes behind). */
function writeText(path: string, text: string): void {
    const f = new File(path, "w");
    try {
        f.write(text);
        f.flush();
    } finally {
        f.close();
    }
}

// ── settings ────────────────────────────────────────────────────────────────────────────

interface Settings {
    unlockAll: boolean;
    fpsUnlock: boolean;
    fpsTarget: number; // 0 = uncapped
    extraMethods: string[];
    ignoredMethods: string[];
    forceShared: string[];
    wardrobe: Partial<Record<Slot, string>>;
    ownEverything: boolean;
    extraTrails: string[];
    keybinds: Record<string, KeyBinding>;
    menuKey?: KeyBinding; // before 0.6
    looks: LooksSettings;
    lastBackground: LooksSettings["background"];
    music: MusicSettings;
    mods: SavedModState;
    ui: { width: number; height: number };
}

const DEFAULTS: Settings = {
    unlockAll: false,
    fpsUnlock: false,
    fpsTarget: 0,
    extraMethods: [],
    ignoredMethods: [],
    forceShared: [],
    wardrobe: {},
    ownEverything: false,
    extraTrails: [],
    keybinds: { menu: DEFAULT_MENU_KEY },
    looks: { ...LOOKS_DEFAULTS },
    lastBackground: null,
    music: { ...MUSIC_DEFAULTS },
    mods: { disabledMods: [], features: {} },
    ui: { width: 0.72, height: 0.8 },
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function loadSettings(): Settings {
    let text: string;
    try {
        text = File.readAllText(SETTINGS_PATH);
    } catch {
        return clone(DEFAULTS);
    }
    let parsed: Partial<Settings>;
    try {
        parsed = JSON.parse(text);
    } catch {
        try {
            parsed = JSON.parse(text.slice(0, text.lastIndexOf("}"))); // older versions could leave junk at the end
            log("Repaired settings.json");
        } catch {
            log("settings.json was unreadable; starting from defaults");
            return clone(DEFAULTS);
        }
    }
    const s = Object.assign(clone(DEFAULTS), parsed) as Settings;
    s.looks = { ...LOOKS_DEFAULTS, ...(parsed.looks ?? {}) };
    s.music = { ...MUSIC_DEFAULTS, ...(parsed.music ?? {}) };
    const oldMenuKey: KeyBinding | null = parsed.menuKey ? { code: parsed.menuKey.code, label: parsed.menuKey.label, mods: parsed.menuKey.mods ?? 0 } : null;
    s.keybinds = { menu: oldMenuKey ?? DEFAULT_MENU_KEY, ...(parsed.keybinds ?? {}) };
    delete s.menuKey;
    return s;
}

const settings = loadSettings();

function saveSettings(): void {
    try {
        writeText(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    } catch (e) {
        log(`Couldn't save settings: ${e}`);
    }
}

// ── Unlock All (shop shows owned) ───────────────────────────────────────────────────────

const hooked = new Set<string>();
let lastScan: ScanResult | null = null;
let unlockStatus = "Off.";

function rescan(): ScanResult {
    lastScan = scan({ extra: settings.extraMethods, ignored: settings.ignoredMethods, forceShared: settings.forceShared });
    log(`Scanned ${lastScan.classesScanned} classes in ${lastScan.ms} ms: ${lastScan.targets.length} checks to hook, ${lastScan.skipped.length} skipped for safety`);
    return lastScan;
}

function hook(targets: Target[]): number {
    let failed = 0;
    for (const t of targets) {
        const id = t.address.toString();
        if (hooked.has(id)) continue;
        try {
            replaceWithConstant(t.address, ptr(t.kind === "true" ? 1 : 0));
            hooked.add(id);
        } catch (e) {
            failed++;
            log(`  couldn't hook ${t.key}: ${(e as Error).message}`);
        }
    }
    return failed;
}

async function setUnlockAll(on: boolean): Promise<void> {
    await Il2Cpp.perform(() => {
        for (const id of hooked) revertTarget(ptr(id));
        hooked.clear();
        if (!on) {
            unlockStatus = "Off.";
            return;
        }
        const failed = hook(rescan().targets);
        unlockStatus = `Hooked ${hooked.size} unlock checks` + (failed ? ` (${failed} failed, see exomenu.log).` : ".");
        log(`Unlock All: ${unlockStatus}`);
    });
    settings.unlockAll = on;
    saveSettings();
}

// ── FPS ─────────────────────────────────────────────────────────────────────────────────

let savedFps: { target: number; vsync: number } | null = null;
let fpsTimer: ReturnType<typeof setInterval> | null = null;

function unityClass(name: string): Il2Cpp.Class {
    return Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class(name);
}

function applyFps(target: number, vsync: number): Promise<void> {
    return Il2Cpp.perform(() => {
        unityClass("UnityEngine.QualitySettings").method("set_vSyncCount").invoke(vsync);
        unityClass("UnityEngine.Application").method("set_targetFrameRate").invoke(target);
    }, "main");
}

async function setFpsUnlock(on: boolean): Promise<void> {
    if (on) {
        if (!savedFps) {
            savedFps = await Il2Cpp.perform(
                () => ({
                    target: unityClass("UnityEngine.Application").method<number>("get_targetFrameRate").invoke(),
                    vsync: unityClass("UnityEngine.QualitySettings").method<number>("get_vSyncCount").invoke(),
                }),
                "main",
            );
        }
        const apply = () => applyFps(settings.fpsTarget > 0 ? settings.fpsTarget : -1, 0).catch(e => log(`FPS unlock failed: ${e}`));
        await apply();
        if (!fpsTimer) fpsTimer = setInterval(apply, 5000); // the game can reset these on scene changes
    } else {
        if (fpsTimer) clearInterval(fpsTimer);
        fpsTimer = null;
        if (savedFps) await applyFps(savedFps.target, savedFps.vsync);
    }
    settings.fpsUnlock = on;
    saveSettings();
}

// ── looks, music, mods ──────────────────────────────────────────────────────────────────

let sessionLooks: Partial<LooksSettings> = {}; // set by mods, not saved

async function setLooks(patch: Partial<LooksSettings>, persist = true): Promise<void> {
    if (persist) {
        settings.looks = { ...settings.looks, ...patch };
        if (patch.background) settings.lastBackground = patch.background;
        for (const k of Object.keys(patch)) delete (sessionLooks as Record<string, unknown>)[k];
        saveSettings();
    } else {
        sessionLooks = { ...sessionLooks, ...patch };
    }
    const effective = { ...settings.looks, ...sessionLooks };
    await Il2Cpp.perform(() => updateLooks(effective), "main");
}

async function setMusicSettings(patch: Partial<MusicSettings>): Promise<void> {
    settings.music = { ...settings.music, ...patch };
    saveSettings();
    await updateMusic(settings.music);
}

async function setOwn(on: boolean): Promise<void> {
    await setOwnEverything(on, log);
    settings.ownEverything = ownStatus() !== "Off.";
    saveSettings();
}

let stashedExtraTrails: string[] = [];

// ── keybind actions ─────────────────────────────────────────────────────────────────────

const ACTIONS: { id: string; label: string; group: string }[] = [
    { id: "menu", label: "Open / close the menu", group: "Menu" },
    { id: "own.toggle", label: "Own every skin on / off", group: "Cosmetics" },
    { id: "wardrobe.clear", label: "Wear my own cosmetics again", group: "Cosmetics" },
    { id: "trails.toggle", label: "Extra trails on / off", group: "Cosmetics" },
    { id: "background.toggle", label: "Custom background on / off", group: "Looks" },
    { id: "name.rainbow", label: "Rainbow name on / off", group: "Looks" },
    { id: "music.toggle", label: "Play / pause music", group: "Music" },
    { id: "music.next", label: "Next song", group: "Music" },
    { id: "music.prev", label: "Previous song", group: "Music" },
    { id: "fps.toggle", label: "Unlock FPS on / off", group: "Performance" },
];

async function runAction(action: string): Promise<void> {
    log(`Keybind: ${action}`);
    switch (action) {
        case "menu":
            return toggleFromAgent();
        case "own.toggle":
            return setOwn(ownStatus() === "Off.");
        case "wardrobe.clear":
            for (const slot of SLOTS) await Il2Cpp.perform(() => setOverride(slot, null, log));
            settings.wardrobe = overrides();
            return saveSettings();
        case "trails.toggle": {
            const now = getExtraTrails();
            const next = now.length ? [] : stashedExtraTrails;
            if (now.length) stashedExtraTrails = now;
            await Il2Cpp.perform(() => setExtraTrails(next, log));
            settings.extraTrails = next;
            return saveSettings();
        }
        case "background.toggle":
            return setLooks({ background: settings.looks.background ? null : settings.lastBackground });
        case "name.rainbow":
            return setLooks({ nameRainbow: !settings.looks.nameRainbow });
        case "music.toggle":
            return toggleMusic();
        case "music.next":
            return skip(1);
        case "music.prev":
            return skip(-1);
        case "fps.toggle":
            return setFpsUnlock(!settings.fpsUnlock);
        default:
            if (action.startsWith("mod:") && hasFeature(action.slice(4))) return setFeature(action.slice(4), !featureEnabled(action.slice(4)));
            log(`Keybind: nothing called ${action}`);
    }
}

// ── menu API ────────────────────────────────────────────────────────────────────────────

let gameInfo = { unity: "?", game: "?" };

function state() {
    return {
        version: VERSION,
        ...gameInfo,
        dataDir: DATA_DIR,
        settings,
        wardrobe: overrides(),
        extraTrails: getExtraTrails(),
        own: ownStatus(),
        keys: { ...keyState(), actions: ACTIONS },
        music: musicStatus(),
        mods: modsStatus(),
        notes: looksNotes(),
        unlock: { status: unlockStatus, skipped: lastScan?.skipped ?? [] },
    };
}

function json(body: unknown, status = 200): Response {
    return { status, type: "application/json", body: JSON.stringify(body) };
}

function lines(value: unknown): string[] {
    const list = Array.isArray(value) ? value : String(value ?? "").split(/[\n,]/);
    return list.map(s => String(s).trim()).filter(s => s.length > 0);
}

async function route(req: Request): Promise<Response> {
    if (req.method === "GET" && (req.path === "/" || req.path === "/index.html")) return { type: "text/html; charset=utf-8", body: PAGE };
    if (req.method === "GET" && req.path === "/api/state") return json(state());
    if (req.method === "GET" && req.path === "/api/wardrobe") return json(await Il2Cpp.perform(() => catalog(log)));
    if (req.method === "GET" && req.path === "/api/media") return json({ ...looksMedia(), icons: await Il2Cpp.perform(() => iconCatalog()) });

    if (req.method !== "POST") return json({ error: "not found" }, 404);
    // Browsers can't add this header to cross-site requests without a CORS preflight we never answer,
    // so other web pages can't flip switches behind your back.
    if (req.headers["x-exomenu"] !== "1") return json({ error: "forbidden" }, 403);

    const body = req.body ? JSON.parse(req.body) : {};
    switch (req.path) {
        case "/api/toggle":
            if (body.id === "unlockAll") await setUnlockAll(!!body.on);
            else if (body.id === "fpsUnlock") await setFpsUnlock(!!body.on);
            else if (body.id === "ownEverything") await setOwn(!!body.on);
            else return json({ error: `unknown feature ${body.id}` }, 400);
            return json(state());
        case "/api/settings":
            if (body.fpsTarget !== undefined) settings.fpsTarget = Math.max(0, Math.min(1000, Math.round(Number(body.fpsTarget) || 0)));
            if (body.extraMethods !== undefined) settings.extraMethods = lines(body.extraMethods);
            if (body.ignoredMethods !== undefined) settings.ignoredMethods = lines(body.ignoredMethods);
            if (body.forceShared !== undefined) settings.forceShared = lines(body.forceShared);
            saveSettings();
            if (settings.fpsUnlock && body.fpsTarget !== undefined) await setFpsUnlock(true);
            return json(state());
        case "/api/looks":
            await setLooks(body ?? {});
            return json(state());
        case "/api/music":
            if (body.action === "play") await play(body.name);
            else if (body.action === "pause") await pause();
            else if (body.action === "toggle") await toggleMusic();
            else if (body.action === "next") await skip(1);
            else if (body.action === "prev") await skip(-1);
            else if (body.action === "settings") await setMusicSettings(body.settings ?? {});
            else return json({ error: `unknown music action ${body.action}` }, 400);
            return json(state());
        case "/api/mods":
            if (body.action === "feature") await setFeature(String(body.key), !!body.on);
            else if (body.action === "value") await setFeatureValue(String(body.key), String(body.id), body.value);
            else if (body.action === "mod") setModEnabled(String(body.file), !!body.on);
            else if (body.action === "reload") reloadMods();
            else return json({ error: `unknown mods action ${body.action}` }, 400);
            return json(state());
        case "/api/keys":
            if (body.action === "listen") listenForKey(String(body.id));
            else if (body.action === "clear") clearKey(String(body.id));
            else if (body.action === "run") await runAction(String(body.id));
            return json(state());
        case "/api/ui":
            settings.ui = { width: Number(body.width) || settings.ui.width, height: Number(body.height) || settings.ui.height };
            setOverlaySize(settings.ui);
            saveSettings();
            return json(state());
        case "/api/folder": {
            const path = FOLDERS[body.which as keyof typeof FOLDERS];
            if (!path) return json({ error: "unknown folder" }, 400);
            revealFolder(path);
            return json({ ok: true });
        }
        case "/api/extratrails": {
            const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 8);
            if (!(await Il2Cpp.perform(() => setExtraTrails(ids, log))))
                return json({ error: "The game's character code couldn't be hooked safely (see exomenu.log)." }, 400);
            settings.extraTrails = ids;
            saveSettings();
            return json(state());
        }
        case "/api/wardrobe":
            if (!SLOTS.includes(body.slot)) return json({ error: `unknown slot ${body.slot}` }, 400);
            if (!(await Il2Cpp.perform(() => setOverride(body.slot, body.id ? String(body.id) : null, log))))
                return json({ error: "The game doesn't allow changing this safely yet (see exomenu.log)." }, 400);
            settings.wardrobe = overrides();
            saveSettings();
            return json(state());
        case "/api/trace":
            return json({ attached: await Il2Cpp.perform(() => traceEquipFlow(log)) });
        case "/api/dump":
            return json({
                path: await Il2Cpp.perform(() => {
                    writeText(DUMP_PATH, dump(lastScan ?? rescan()));
                    writeText(DEEP_DUMP_PATH, deepDump());
                    log(`Wrote ${DUMP_PATH} and ${DEEP_DUMP_PATH}`);
                    return DATA_DIR;
                }),
            });
        default:
            return json({ error: "not found" }, 404);
    }
}

// ── start ───────────────────────────────────────────────────────────────────────────────

log(`ExoMenu ${VERSION} loading into ${Process.mainModule.name} (pid ${Process.id})`);
for (const dir of Object.values(FOLDERS)) ensureDir(dir);

function step(name: string, fn: () => void): void {
    try {
        fn();
    } catch (e) {
        log(`Startup: ${name} failed: ${(e as Error).stack ?? e}`);
    }
}

Il2Cpp.perform(async () => {
    gameInfo = {
        unity: (() => { try { return Il2Cpp.unityVersion; } catch { return "?"; } })(), // prettier-ignore
        game: (() => { try { return Il2Cpp.application.version ?? "?"; } catch { return "?"; } })(), // prettier-ignore
    };
    log(`IL2CPP ready: Unity ${gameInfo.unity}, Exoracer ${gameInfo.game}`);

    const port = await serve(FIRST_PORT, route, log);
    const url = `http://127.0.0.1:${port}/`;
    step("menu-url", () => writeText(URL_PATH, url));
    log(`Menu is at ${url}`);

    step("overlay", () =>
        startOverlay({
            url,
            bindings: settings.keybinds,
            size: settings.ui,
            onBindingsChanged: b => {
                settings.keybinds = b;
                saveSettings();
            },
            onAction: a => {
                runAction(a).catch(e => log(`Keybind ${a} failed: ${e}`));
            },
            log,
        }),
    );
    step("wardrobe", () => {
        for (const slot of SLOTS) {
            const id = settings.wardrobe?.[slot];
            if (id) setOverride(slot, id, log);
        }
        if (settings.extraTrails?.length) setExtraTrails(settings.extraTrails, log);
    });
    step("looks", () => startLooks(settings.looks, FOLDERS, log));
    step("music", () => startMusic(FOLDERS.music, settings.music, log));
    step("mods", () =>
        startMods(
            FOLDERS.mods,
            settings.mods,
            s => {
                settings.mods = s;
                saveSettings();
            },
            log,
            {
                looks: patch => setLooks(patch as Partial<LooksSettings>, false),
                run: action => runAction(action),
            },
        ),
    );

    if (settings.ownEverything) {
        // DataController loads after sign-in; keep trying for a minute.
        let tries = 0;
        const retry = setInterval(() => {
            setOwnEverything(true, log)
                .then(s => {
                    if (s !== "Off." || ++tries >= 12) clearInterval(retry);
                })
                .catch(e => log(`Own everything failed: ${e}`));
        }, 5000);
    }
    if (settings.unlockAll) await setUnlockAll(true).catch(e => log(`Unlock All failed: ${e}`));
    if (settings.fpsUnlock) await setFpsUnlock(true).catch(e => log(`FPS unlock failed: ${e}`));
    log("Startup: done");
}).catch(e => log(`ExoMenu failed to start: ${(e as Error).stack ?? e}`));
