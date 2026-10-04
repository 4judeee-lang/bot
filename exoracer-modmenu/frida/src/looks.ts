import "frida-il2cpp-bridge";
import { dataController, gameClass, probeViews } from "./game.js";
import { cachedMedia, listMedia, Media, MediaEntry, MediaPlayer, prepareMedia, unusableMedia } from "./media.js";
import { sharedWith } from "./scanner.js";
import { color, componentsIn, hsv, isAlive, keep, readVector3, typeOf, uclass, vector3 } from "./unity.js";
import { onMyCharacterDressed } from "./wardrobe.js";

// Client-side looks: your own background (still or animated), a custom skin image, your name
// colour, and a custom profile picture (still or animated). Nothing here runs every frame: work
// happens when the game draws something of yours, plus one timer per animation.

type Log = (message: string) => void;

export interface LooksSettings {
    background: MediaEntry | null;
    backgroundFps: number;
    backgroundScale: number;
    backgroundTint: string;
    skinImage: MediaEntry | null;
    skinImageFps: number;
    skinImageScale: number;
    nameColor: string | null;
    nameRainbow: boolean;
    pfp: MediaEntry | null;
    pfpFps: number;
    pfpIcon: string | null; // one of the game's own profile icons, shown instead of yours
}

export const LOOKS_DEFAULTS: LooksSettings = {
    background: null,
    backgroundFps: 12,
    backgroundScale: 1,
    backgroundTint: "#ffffff",
    skinImage: null,
    skinImageFps: 12,
    skinImageScale: 1,
    nameColor: null,
    nameRainbow: false,
    pfp: null,
    pfpFps: 12,
    pfpIcon: null,
};

export interface LooksDirs {
    backgrounds: string;
    skins: string;
    pfp: string;
}

let settings: LooksSettings = { ...LOOKS_DEFAULTS };
let dirs: LooksDirs;
let log: Log = () => {};

const spriteRendererClass = () => uclass("UnityEngine.CoreModule", "UnityEngine.SpriteRenderer")!;
const animatorClass = () => uclass("UnityEngine.AnimationModule", "UnityEngine.Animator");

// ── loading ─────────────────────────────────────────────────────────────────────────────
//
// Pictures are loaded in the background (see media.ts). Until one is ready the game keeps its own
// look; when it's ready, the matching apply function runs again on the main thread.

type MediaSlot = "background" | "skinImage" | "pfp";
const SIDE: Record<MediaSlot, number> = { background: 2560, skinImage: 512, pfp: 256 };
const loadErrors = new Map<MediaSlot, string>();
const loadingNow = new Map<MediaSlot, string>();

function mediaFor(slot: MediaSlot, dir: string, entry: MediaEntry, fps: number, reapply: () => void): Media | null {
    const ready = cachedMedia(dir, entry, fps, SIDE[slot]);
    if (ready) return ready;
    if (loadErrors.has(slot) || loadingNow.get(slot) === entry.name) return null;
    loadingNow.set(slot, entry.name);
    // Hooks call this on the main thread; do the loading from the agent thread instead.
    setTimeout(() => {
        prepareMedia(dir, entry, fps, SIDE[slot])
            .then(() => {
                if (loadingNow.get(slot) === entry.name) loadingNow.delete(slot);
                return Il2Cpp.perform(reapply, "main");
            })
            .catch(e => {
                if (loadingNow.get(slot) === entry.name) loadingNow.delete(slot);
                const message = String((e as Error).message ?? e);
                loadErrors.set(slot, `Couldn't use ${entry.name}: ${message}`);
                log(`Looks: couldn't load ${entry.name}: ${(e as Error).stack ?? e}`);
            });
    }, 0);
    return null;
}

// ── background ──────────────────────────────────────────────────────────────────────────
//
// Your picture goes on the game's own background sprite (so it's drawn exactly where the game's
// background is, by the game's camera), scaled to cover the screen. Everything we change on it is
// remembered and put back when you switch the background off.

interface SavedRenderer {
    renderer: Il2Cpp.Object;
    sprite: Il2Cpp.Object | null;
    enabled: boolean;
    scale: { x: number; y: number; z: number };
    color: Il2Cpp.ValueType;
    drawMode: number | null;
}
const saved = new Map<string, SavedRenderer>();
let bgTargets: Il2Cpp.Object[] = [];
const bgPlayer = new MediaPlayer(() => bgTargets.filter(isAlive), m => log(m));

function games(): Il2Cpp.Object[] {
    const klass = gameClass("NyanStudio.Game");
    return klass ? Il2Cpp.gc.choose(klass).filter(isAlive) : [];
}

function mainCamera(): Il2Cpp.Object | null {
    const cam = uclass("UnityEngine.CoreModule", "UnityEngine.Camera")?.method<Il2Cpp.Object>("get_main").invoke();
    return cam && !cam.isNull() ? cam : null;
}

function rendererOf(game: Il2Cpp.Object, field: string): Il2Cpp.Object | null {
    const r = game.tryField<Il2Cpp.Object>(field)?.value;
    return isAlive(r) ? r! : null;
}

function visible(r: Il2Cpp.Object): boolean {
    try {
        const go = r.method<Il2Cpp.Object>("get_gameObject").invoke();
        return r.method<boolean>("get_enabled").invoke() && go.method<boolean>("get_activeInHierarchy").invoke();
    } catch {
        return false;
    }
}

function remember(r: Il2Cpp.Object): void {
    const k = r.handle.toString();
    if (saved.has(k)) return;
    let drawMode: number | null = null;
    try {
        drawMode = r.method<number>("get_drawMode").invoke();
    } catch {}
    const sprite = r.method<Il2Cpp.Object>("get_sprite").invoke();
    saved.set(k, {
        renderer: r,
        sprite: sprite && !sprite.isNull() ? sprite : null,
        enabled: r.method<boolean>("get_enabled").invoke(),
        scale: readVector3(r.method<Il2Cpp.Object>("get_transform").invoke().method<Il2Cpp.ValueType>("get_localScale").invoke()),
        color: r.method<Il2Cpp.ValueType>("get_color").invoke(),
        drawMode,
    });
}

/** The size of the camera's view, in world units, at the renderer's distance. */
function viewSize(cam: Il2Cpp.Object, r: Il2Cpp.Object): { width: number; height: number } {
    const aspect = cam.method<number>("get_aspect").invoke();
    if (cam.method<boolean>("get_orthographic").invoke()) {
        const height = 2 * cam.method<number>("get_orthographicSize").invoke();
        return { width: height * aspect, height };
    }
    const camZ = readVector3(cam.method<Il2Cpp.Object>("get_transform").invoke().method<Il2Cpp.ValueType>("get_position").invoke()).z;
    const z = readVector3(r.method<Il2Cpp.Object>("get_transform").invoke().method<Il2Cpp.ValueType>("get_position").invoke()).z;
    const height = 2 * Math.abs(z - camZ) * Math.tan((cam.method<number>("get_fieldOfView").invoke() * Math.PI) / 360);
    return { width: height * aspect, height };
}

/** Scales the renderer so the picture covers the whole view (idempotent: it measures what's there). */
function cover(r: Il2Cpp.Object): void {
    const cam = mainCamera();
    if (!cam) return;
    const view = viewSize(cam, r);
    const ext = readVector3(r.method<Il2Cpp.ValueType>("get_bounds").invoke().field<Il2Cpp.ValueType>("m_Extents").value);
    if (ext.x <= 1e-6 || ext.y <= 1e-6 || !isFinite(view.width) || view.width <= 0) return;
    const k = Math.max(view.width / (2 * ext.x), view.height / (2 * ext.y)) * settings.backgroundScale;
    if (Math.abs(k - 1) < 0.002) return;
    const t = r.method<Il2Cpp.Object>("get_transform").invoke();
    const s = readVector3(t.method<Il2Cpp.ValueType>("get_localScale").invoke());
    t.method("set_localScale").invoke(vector3(s.x * k, s.y * k, s.z));
}

/** Main thread. Re-applied whenever the game shows a background (menus and levels). */
function applyBackground(): void {
    if (!settings.background) return restoreGameBackground();
    const media = mediaFor("background", dirs.backgrounds, settings.background, settings.backgroundFps, applyBackground);
    if (!media) return; // still loading (or failed): the game keeps its own background

    const targets: Il2Cpp.Object[] = [];
    for (const g of games()) {
        const plain = rendererOf(g, "plainBackgroundSpriteRenderer");
        const custom = rendererOf(g, "customBackgroundSpriteRenderer");
        // Use whichever background is on screen now; the other one is hidden so they don't overlap.
        const target = [custom, plain].find(r => r && visible(r)) ?? custom ?? plain;
        if (!target) continue;
        for (const r of [plain, custom]) {
            if (!r) continue;
            remember(r);
            if (r !== target) r.method("set_enabled").invoke(false);
        }
        targets.push(target);
    }
    if (targets.length === 0) {
        loadErrors.set("background", "The game's background wasn't found on this screen. Start a level or go back to the main menu.");
        return;
    }
    loadErrors.delete("background");
    bgTargets = targets;
    for (const r of targets) {
        r.method("set_enabled").invoke(true);
        try {
            r.method("set_drawMode").invoke(0); // Simple: no tiling or slicing of our picture
        } catch {}
    }
    if (bgPlayer.current !== media) bgPlayer.start(media);
    else bgPlayer.show();
    const tint = color(settings.backgroundTint || "#ffffff");
    for (const r of targets) {
        r.method("set_color").invoke(tint);
        cover(r);
    }
}

function restoreGameBackground(): void {
    bgPlayer.stop();
    bgTargets = [];
    for (const s of saved.values()) {
        if (!isAlive(s.renderer)) continue;
        try {
            const r = s.renderer;
            r.method("set_sprite").invoke(s.sprite ?? NULL);
            r.method("set_color").invoke(s.color);
            if (s.drawMode !== null) r.method("set_drawMode").invoke(s.drawMode);
            r.method<Il2Cpp.Object>("get_transform").invoke().method("set_localScale").invoke(vector3(s.scale.x, s.scale.y, s.scale.z));
            r.method("set_enabled").invoke(s.enabled);
        } catch (e) {
            log(`Background: couldn't restore the game's background: ${e}`);
        }
    }
    saved.clear();
}

// ── your character: custom skin image and name colour ──────────────────────────────────────

const myViews = new Map<string, Il2Cpp.Object>();
let skinTargets: Il2Cpp.Object[] = [];
const skinPlayer = new MediaPlayer(() => skinTargets.filter(isAlive), m => log(m));

function liveViews(): Il2Cpp.Object[] {
    for (const [k, v] of myViews) if (!isAlive(v)) myViews.delete(k);
    return [...myViews.values()];
}

function applySkinImage(view: Il2Cpp.Object): void {
    if (!settings.skinImage) return;
    const media = mediaFor("skinImage", dirs.skins, settings.skinImage, settings.skinImageFps, () => {
        for (const v of liveViews()) applySkinImage(v);
    });
    if (!media) return; // loading: keep the real skin until it's ready
    const character = view.field<Il2Cpp.Object>("character").value;
    if (!isAlive(character)) return;
    const spriteGo = character.field<Il2Cpp.Object>("spriteGo").value;
    if (!isAlive(spriteGo)) return;
    const renderers = componentsIn(spriteGo, spriteRendererClass());
    if (renderers.length === 0) return;
    const anim = animatorClass();
    if (anim) for (const a of componentsIn(spriteGo, anim)) a.method("set_enabled").invoke(false); // or it'd swap the sprite back
    const main = renderers[0];
    for (const r of renderers.slice(1)) r.method("set_enabled").invoke(false);

    // Keep the character's size: scale our picture to the skin's on-screen size.
    const before = readVector3(main.method<Il2Cpp.ValueType>("get_bounds").invoke().field<Il2Cpp.ValueType>("m_Extents").value);
    main.method("set_sprite").invoke(media.frames[0]);
    const after = readVector3(main.method<Il2Cpp.ValueType>("get_bounds").invoke().field<Il2Cpp.ValueType>("m_Extents").value);
    const ratio = Math.max(before.x, before.y) / Math.max(after.x, after.y, 1e-6);
    const t = main.method<Il2Cpp.Object>("get_transform").invoke();
    const s = readVector3(t.method<Il2Cpp.ValueType>("get_localScale").invoke());
    const k = ratio * settings.skinImageScale;
    t.method("set_localScale").invoke(vector3(s.x * k, s.y * k, s.z));

    skinTargets = [...skinTargets.filter(isAlive), main];
    if (skinPlayer.current?.name !== media.name) skinPlayer.start(media);
    else skinPlayer.show();
}

let rainbowTimer: ReturnType<typeof setInterval> | null = null;
let hue = 0;

function applyNameColor(hex: string | null): void {
    if (!hex) return;
    const c = color(hex);
    for (const view of liveViews()) {
        const label = view.tryField<Il2Cpp.Object>("nameLabel")?.value;
        if (isAlive(label)) label!.method("set_color").invoke(c);
    }
}

function updateRainbow(): void {
    if (rainbowTimer) clearInterval(rainbowTimer);
    rainbowTimer = null;
    if (!settings.nameRainbow) {
        Il2Cpp.perform(() => applyNameColor(settings.nameColor ?? "#ffffff"), "main").catch(() => {});
        return;
    }
    rainbowTimer = setInterval(() => {
        if (myViews.size === 0) return;
        hue = (hue + 0.02) % 1;
        Il2Cpp.perform(() => applyNameColor(hsv(hue)), "main").catch(() => {});
    }, 120);
}

function onDressed(view: Il2Cpp.Object): void {
    myViews.set(view.handle.toString(), view);
    try {
        applySkinImage(view);
    } catch (e) {
        log(`Custom skin image failed: ${e}`);
    }
    if (!settings.nameRainbow) applyNameColor(settings.nameColor);
}

/** Puts your real skin back on your characters (main thread). */
function redressMine(): void {
    skinPlayer.stop();
    skinTargets = [];
    const real = dataController()?.method<Il2Cpp.String>("get_Skin").invoke();
    if (!real || real.isNull()) return;
    for (const view of liveViews()) {
        try {
            view.method("SetSkin", 2).overload("System.String", "System.Boolean").invoke(real, false);
        } catch {}
    }
}

// ── profile picture ─────────────────────────────────────────────────────────────────────

const myIconViews = new Map<string, Il2Cpp.Object>();
const pfpPlayer = new MediaPlayer(() => pfpImages(), m => log(m));
let pfpTimer: ReturnType<typeof setInterval> | null = null;

function pfpImages(): Il2Cpp.Object[] {
    const out: Il2Cpp.Object[] = [];
    for (const [k, v] of myIconViews) {
        if (!isAlive(v)) {
            myIconViews.delete(k);
            continue;
        }
        const img = v.field<Il2Cpp.Object>("image").value;
        if (isAlive(img)) out.push(img);
    }
    return out;
}

function myIcon(): string | null {
    try {
        const user = dataController()?.method<Il2Cpp.Object>("get_User").invoke();
        const s = user && !user.isNull() ? user.field<Il2Cpp.String>("playerIcon").value : null;
        return s && !s.isNull() ? s.content : null;
    } catch {
        return null;
    }
}

function applyPfp(view: Il2Cpp.Object): void {
    if (!settings.pfp) return;
    const media = mediaFor("pfp", dirs.pfp, settings.pfp, settings.pfpFps, () => {
        for (const [, v] of myIconViews) if (isAlive(v)) applyPfp(v);
    });
    if (!media) return;
    const img = view.field<Il2Cpp.Object>("image").value;
    if (!isAlive(img)) return;
    img.method("set_preserveAspect").invoke(true);
    const spinner = view.tryField<Il2Cpp.Object>("spinnerGo")?.value;
    if (isAlive(spinner)) spinner!.method("SetActive").invoke(false);
    if (pfpPlayer.current?.name !== media.name) pfpPlayer.start(media);
    else pfpPlayer.show();
}

const pinnedStrings = new Map<string, NativePointer>();
function pinnedString(text: string): NativePointer {
    let p = pinnedStrings.get(text);
    if (!p) {
        const str = Il2Cpp.string(text);
        keep(str.object);
        p = str.handle;
        pinnedStrings.set(text, p);
    }
    return p;
}

/** Ids of every profile icon the game has loaded. */
export function iconCatalog(): string[] {
    const klass = gameClass("NyanStudio.PlayerIcon");
    if (!klass) return [];
    const ids = new Set<string>();
    for (const o of Il2Cpp.gc.choose(klass)) {
        const s = o.tryField<Il2Cpp.String>("id")?.value;
        if (s && !s.isNull() && s.content) ids.add(s.content);
    }
    return [...ids].sort();
}

function hookProfilePicture(): void {
    const klass = gameClass("NyanStudio.PlayerIconView");
    if (!klass) return log("Looks: PlayerIconView not found; custom profile pictures are off");
    const methods = klass.methods.filter(m => m.name === "Initialize" || m.name === "LoadPicture");
    for (const method of methods) {
        if (method.virtualAddress.isNull() || sharedWith(method).length > 0) continue;
        const isInit = method.name === "Initialize";
        Interceptor.attach(method.virtualAddress, {
            // Runs when a profile picture is set up (opening a screen), not every frame. Your icon views
            // are tracked even with no custom picture, so picking one later updates them right away.
            onEnter(args) {
                this.view = args[0];
                this.probe = probeViews.has(args[0].toString());
                if (this.probe) return; // our thumbnail maker, not something on screen
                this.icon = isInit ? args[1] : NULL;
                // Built-in icon swap: change the id before the game looks it up (only for your icon).
                if (isInit && settings.pfpIcon && !settings.pfp && !args[1].isNull()) {
                    try {
                        if (new Il2Cpp.String(args[1]).content === myIcon()) args[1] = pinnedString(settings.pfpIcon);
                    } catch {}
                }
            },
            onLeave() {
                if (this.probe) return;
                try {
                    const view = new Il2Cpp.Object(this.view);
                    const key = view.handle.toString();
                    if (isInit) {
                        const icon = this.icon.isNull() ? null : new Il2Cpp.String(this.icon).content;
                        if (!icon || icon !== myIcon()) {
                            myIconViews.delete(key); // this view now shows someone else
                            return;
                        }
                        myIconViews.set(key, view);
                    } else if (!myIconViews.has(key)) {
                        return;
                    }
                    applyPfp(view);
                } catch (e) {
                    log(`Profile picture failed: ${e}`);
                }
            },
        });
    }
    log(`Looks: watching ${methods.length} profile picture methods`);
}

function updatePfpTimer(): void {
    if (pfpTimer) clearInterval(pfpTimer);
    pfpTimer = null;
    if (!settings.pfp) return;
    // Your real picture can finish downloading after we've swapped it; put ours back if so.
    pfpTimer = setInterval(() => {
        if (myIconViews.size === 0) return;
        Il2Cpp.perform(() => {
            const frame = pfpPlayer.frame();
            for (const img of pfpImages()) {
                const s = img.method<Il2Cpp.Object>("get_sprite").invoke();
                if (frame && !s.handle.equals(frame.handle) && pfpPlayer.current?.frames.length === 1) img.method("set_sprite").invoke(frame);
            }
        }, "main").catch(() => {});
    }, 2000);
}

// ── setup ───────────────────────────────────────────────────────────────────────────────

function hookBackgrounds(): void {
    const klass = gameClass("NyanStudio.Game");
    for (const name of ["ShowGameBackground", "ShowMenuBackground"]) {
        const method = klass?.tryMethod(name);
        if (!method || method.virtualAddress.isNull() || sharedWith(method).length > 0) {
            log(`Looks: can't watch Game.${name}`);
            continue;
        }
        Interceptor.attach(method.virtualAddress, {
            onLeave() {
                if (!settings.background) return;
                try {
                    applyBackground();
                } catch (e) {
                    log(`Background failed: ${e}`);
                }
            },
        });
    }
}

export function startLooks(initial: LooksSettings, folders: LooksDirs, logger: Log): void {
    settings = { ...LOOKS_DEFAULTS, ...initial };
    dirs = folders;
    log = logger;
    hookBackgrounds();
    hookProfilePicture();
    onMyCharacterDressed(onDressed, log);
    updateRainbow();
    updatePfpTimer();
}

/** Applies changed settings right away. Main thread. */
export function updateLooks(next: LooksSettings): void {
    const prev = settings;
    settings = { ...LOOKS_DEFAULTS, ...next };
    const changed = (k: keyof LooksSettings) => JSON.stringify(prev[k]) !== JSON.stringify(settings[k]);
    if (changed("background") || changed("backgroundFps")) loadErrors.delete("background");
    if (changed("skinImage") || changed("skinImageFps")) loadErrors.delete("skinImage");
    if (changed("pfp") || changed("pfpFps")) loadErrors.delete("pfp");

    if (changed("background") || changed("backgroundFps")) bgPlayer.stop();
    if (changed("background") || changed("backgroundFps") || changed("backgroundScale") || changed("backgroundTint")) {
        try {
            applyBackground();
        } catch (e) {
            log(`Background failed: ${e}`);
            throw e;
        }
    }
    if (changed("skinImage") || changed("skinImageFps") || changed("skinImageScale")) {
        redressMine(); // back to the real skin first, so sizing starts from the game's own sprite
        // Calls we make ourselves don't always pass through our hooks, so apply the new image directly.
        if (settings.skinImage) for (const view of liveViews()) applySkinImage(view);
    }
    if (changed("nameRainbow")) updateRainbow();
    if (changed("nameColor") && !settings.nameRainbow) applyNameColor(settings.nameColor ?? "#ffffff");
    if (changed("pfp") || changed("pfpFps")) {
        pfpPlayer.stop();
        updatePfpTimer();
        for (const [, view] of myIconViews) if (isAlive(view)) applyPfp(view);
    }
}

export function looksMedia() {
    return {
        backgrounds: listMedia(dirs.backgrounds),
        skins: listMedia(dirs.skins),
        pfp: listMedia(dirs.pfp),
        unusable: { backgrounds: unusableMedia(dirs.backgrounds), skins: unusableMedia(dirs.skins), pfp: unusableMedia(dirs.pfp) },
    };
}

export function looksNotes(): string[] {
    const notes = [bgPlayer.current?.note, skinPlayer.current?.note, pfpPlayer.current?.note].filter((n): n is string => !!n);
    for (const name of loadingNow.values()) notes.push(`Loading ${name}…`);
    for (const message of loadErrors.values()) notes.push(message);
    return notes;
}
