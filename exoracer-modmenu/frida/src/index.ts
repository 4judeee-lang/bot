import "frida-il2cpp-bridge";
import { serve, Request, Response } from "./http.js";
import { dump, scan, ScanResult, Target } from "./scanner.js";
import { PAGE } from "./ui.js";

const VERSION = "0.2.0";
const FIRST_PORT = 7777;

// …/Exoracer/Exoracer.app/Contents/MacOS/Exoracer → …/Exoracer/ExoMenu (made by install-macos.sh)
const GAME_DIR = Process.mainModule.path.split("/").slice(0, -4).join("/");
const DATA_DIR = `${GAME_DIR}/ExoMenu`;
const SETTINGS_PATH = `${DATA_DIR}/settings.json`;
const DUMP_PATH = `${DATA_DIR}/cosmetics-dump.txt`;
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

// ── settings ────────────────────────────────────────────────────────────────────────────

interface Settings {
    unlockAll: boolean;
    fpsUnlock: boolean;
    fpsTarget: number; // 0 = uncapped
    extraMethods: string[];
    ignoredMethods: string[];
    forceShared: string[];
}

const DEFAULTS: Settings = { unlockAll: false, fpsUnlock: false, fpsTarget: 0, extraMethods: [], ignoredMethods: [], forceShared: [] };

function loadSettings(): Settings {
    try {
        return { ...DEFAULTS, ...JSON.parse(File.readAllText(SETTINGS_PATH)) };
    } catch {
        return { ...DEFAULTS };
    }
}

const settings = loadSettings();

function saveSettings(): void {
    try {
        File.writeAllText(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    } catch (e) {
        log(`Couldn't save settings: ${e}`);
    }
}

// ── Unlock All ──────────────────────────────────────────────────────────────────────────

const hooked = new Map<string, NativeCallback<"bool", []>>(); // address → replacement kept alive
let lastScan: ScanResult | null = null;
let unlockStatus = "Waiting for the game to load…";

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
        // Returning a constant ignores every argument, so the signature doesn't matter.
        const replacement = new NativeCallback(() => (t.kind === "true" ? 1 : 0), "bool", []);
        try {
            Interceptor.replace(t.address, replacement);
            hooked.set(id, replacement);
            log(`  hooked [${t.kind}] ${t.key}`);
        } catch (e) {
            failed++;
            log(`  couldn't hook ${t.key}: ${(e as Error).message}`);
        }
    }
    Interceptor.flush();
    return failed;
}

function unhookAll(): void {
    for (const id of hooked.keys()) {
        try {
            Interceptor.revert(ptr(id));
        } catch (e) {
            log(`  couldn't unhook ${id}: ${(e as Error).message}`);
        }
    }
    hooked.clear();
    Interceptor.flush();
}

async function setUnlockAll(on: boolean): Promise<void> {
    await Il2Cpp.perform(() => {
        unhookAll();
        if (!on) {
            unlockStatus = "Off. Everything is back to how the game had it.";
            log("Unlock All: off");
            return;
        }
        const result = rescan();
        const failed = hook(result.targets);
        unlockStatus =
            hooked.size === 0
                ? "No unlock checks could be hooked. Write the dump file and send it over so the rules can be tailored."
                : `Hooked ${hooked.size} unlock checks` + (failed ? ` (${failed} failed, see exomenu.log).` : ".") + " Reopen the skin menu to see everything.";
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
    // Unity only allows these calls from its main thread.
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
                "main"
            );
        }
        const apply = () => applyFps(settings.fpsTarget > 0 ? settings.fpsTarget : -1, 0).catch(e => log(`FPS unlock failed: ${e}`));
        await apply();
        // The game can reset these when you change settings or scenes.
        if (!fpsTimer) fpsTimer = setInterval(apply, 2000);
    } else {
        if (fpsTimer) clearInterval(fpsTimer);
        fpsTimer = null;
        if (savedFps) await applyFps(savedFps.target, savedFps.vsync);
    }
    settings.fpsUnlock = on;
    saveSettings();
}

// ── dump ────────────────────────────────────────────────────────────────────────────────

function writeDump(): Promise<string> {
    return Il2Cpp.perform(() => {
        File.writeAllText(DUMP_PATH, dump(lastScan ?? rescan()));
        log(`Wrote ${DUMP_PATH}`);
        return DUMP_PATH;
    });
}

// ── menu API ────────────────────────────────────────────────────────────────────────────

let gameInfo = { unity: "?", game: "?" };

function state() {
    return {
        version: VERSION,
        ...gameInfo,
        dataDir: DATA_DIR,
        settings,
        unlock: {
            status: unlockStatus,
            hooked: settings.unlockAll ? (lastScan?.targets ?? []).map(t => ({ key: t.key, kind: t.kind, source: t.source })) : [],
            skipped: lastScan?.skipped ?? [],
        },
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

    if (req.method !== "POST") return json({ error: "not found" }, 404);
    // Browsers can't add this header to cross-site requests without a CORS preflight we never answer,
    // so other web pages can't flip switches behind your back.
    if (req.headers["x-exomenu"] !== "1") return json({ error: "forbidden" }, 403);

    const body = req.body ? JSON.parse(req.body) : {};
    switch (req.path) {
        case "/api/toggle":
            if (body.id === "unlockAll") await setUnlockAll(!!body.on);
            else if (body.id === "fpsUnlock") await setFpsUnlock(!!body.on);
            else return json({ error: `unknown feature ${body.id}` }, 400);
            return json(state());
        case "/api/settings":
            if (body.fpsTarget !== undefined) settings.fpsTarget = Math.max(0, Math.min(1000, Math.round(Number(body.fpsTarget) || 0)));
            if (body.extraMethods !== undefined) settings.extraMethods = lines(body.extraMethods);
            if (body.ignoredMethods !== undefined) settings.ignoredMethods = lines(body.ignoredMethods);
            if (body.forceShared !== undefined) settings.forceShared = lines(body.forceShared);
            saveSettings();
            if (settings.fpsUnlock && body.fpsTarget !== undefined) await setFpsUnlock(true);
            if (settings.unlockAll && (body.extraMethods !== undefined || body.ignoredMethods !== undefined || body.forceShared !== undefined))
                await setUnlockAll(true);
            return json(state());
        case "/api/rescan":
            if (settings.unlockAll) await setUnlockAll(true);
            else await Il2Cpp.perform(() => void rescan());
            return json(state());
        case "/api/dump":
            return json({ path: await writeDump() });
        default:
            return json({ error: "not found" }, 404);
    }
}

// ── start ───────────────────────────────────────────────────────────────────────────────

log(`ExoMenu ${VERSION} loading into ${Process.mainModule.name} (pid ${Process.id})`);

Il2Cpp.perform(async () => {
    gameInfo = {
        unity: (() => { try { return Il2Cpp.unityVersion; } catch { return "?"; } })(), // prettier-ignore
        game: (() => { try { return Il2Cpp.application.version ?? "?"; } catch { return "?"; } })(), // prettier-ignore
    };
    log(`IL2CPP ready: Unity ${gameInfo.unity}, Exoracer ${gameInfo.game}`);

    const port = await serve(FIRST_PORT, route, log);
    const url = `http://127.0.0.1:${port}/`;
    try {
        File.writeAllText(URL_PATH, url);
    } catch {}
    log(`Menu is at ${url}`);

    if (settings.unlockAll) await setUnlockAll(true);
    else unlockStatus = "Off.";
    if (settings.fpsUnlock) await setFpsUnlock(true).catch(e => log(`FPS unlock failed: ${e}`));

    try {
        File.readAllText(DUMP_PATH);
    } catch {
        await writeDump().catch(e => log(`Couldn't write the dump: ${e}`));
    }
}).catch(e => log(`ExoMenu failed to start: ${(e as Error).stack ?? e}`));
