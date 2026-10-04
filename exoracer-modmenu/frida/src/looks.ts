import "frida-il2cpp-bridge";
import { dataController, gameClass, probeViews } from "./game.js";
import { listMedia, loadMedia, MediaEntry, MediaPlayer, unusableMedia } from "./media.js";
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

// ── background ──────────────────────────────────────────────────────────────────────────
//
// Our own sprite, parented to the main camera so it follows it natively (no per-frame work), drawn
// in the game's background sorting layer, with the game's own background renderers hidden.

let bgObject: Il2Cpp.Object | null = null; // our GameObject
let bgRenderer: Il2Cpp.Object | null = null;
const hiddenGameRenderers = new Set<string>(); // game renderers we disabled, to give back
const bgPlayer = new MediaPlayer(() => (isAlive(bgRenderer) ? [bgRenderer!] : []), m => log(m));

function games(): Il2Cpp.Object[] {
    const klass = gameClass("NyanStudio.Game");
    return klass ? Il2Cpp.gc.choose(klass).filter(isAlive) : [];
}

function mainCamera(): Il2Cpp.Object | null {
    const cam = uclass("UnityEngine.CoreModule", "UnityEngine.Camera")?.method<Il2Cpp.Object>("get_main").invoke();
    return cam && !cam.isNull() ? cam : null;
}

function gameRenderers(): Il2Cpp.Object[] {
    const out: Il2Cpp.Object[] = [];
    for (const g of games()) {
        for (const f of ["plainBackgroundSpriteRenderer", "customBackgroundSpriteRenderer"]) {
            const r = g.tryField<Il2Cpp.Object>(f)?.value;
            if (isAlive(r)) out.push(r!);
        }
    }
    return out;
}

function ensureBackgroundObject(): boolean {
    const cam = mainCamera();
    if (!cam) return false;
    const camTransform = cam.method<Il2Cpp.Object>("get_transform").invoke();
    if (!isAlive(bgObject)) {
        const go = uclass("UnityEngine.CoreModule", "UnityEngine.GameObject")!.alloc();
        go.method(".ctor", 1).invoke(Il2Cpp.string("ExoMenu Background"));
        bgObject = keep(go);
        bgRenderer = keep(go.method<Il2Cpp.Object>("AddComponent", 1).overload("System.Type").invoke(typeOf(spriteRendererClass())));
    }
    const t = bgObject!.method<Il2Cpp.Object>("get_transform").invoke();
    t.method("SetParent", 2).overload("UnityEngine.Transform", "System.Boolean").invoke(camTransform, false);
    // Copy the game's background sorting so we draw where its background was.
    const ref = gameRenderers()[0];
    if (ref) {
        bgRenderer!.method("set_sortingLayerID").invoke(ref.method<number>("get_sortingLayerID").invoke());
        bgRenderer!.method("set_sortingOrder").invoke(ref.method<number>("get_sortingOrder").invoke());
    } else {
        bgRenderer!.method("set_sortingOrder").invoke(-32000);
    }
    const far = cam.method<number>("get_farClipPlane").invoke();
    t.method("set_localPosition").invoke(vector3(0, 0, Math.min(far * 0.5, 500)));
    return true;
}

function fitBackground(): void {
    const media = bgPlayer.current;
    const cam = mainCamera();
    if (!media || !cam || !isAlive(bgRenderer)) return;
    const height = 2 * cam.method<number>("get_orthographicSize").invoke();
    const width = height * cam.method<number>("get_aspect").invoke();
    const cover = Math.max(width / (media.width / 100), height / (media.height / 100)) * settings.backgroundScale;
    bgObject!.method<Il2Cpp.Object>("get_transform").invoke().method("set_localScale").invoke(vector3(cover, cover, 1));
    bgRenderer!.method("set_color").invoke(color(settings.backgroundTint || "#ffffff"));
}

/** Main thread. Re-applied whenever the game shows a background (menus and levels). */
function applyBackground(): void {
    if (!settings.background) return restoreGameBackground();
    if (!ensureBackgroundObject()) return;
    if (!bgPlayer.current || bgPlayer.current.name !== settings.background.name) {
        bgPlayer.start(loadMedia(dirs.backgrounds, settings.background, settings.backgroundFps));
    } else {
        bgPlayer.show();
    }
    fitBackground();
    bgObject!.method("SetActive").invoke(true);
    for (const r of gameRenderers()) {
        if (r.method<boolean>("get_enabled").invoke()) {
            r.method("set_enabled").invoke(false);
            hiddenGameRenderers.add(r.handle.toString());
        }
    }
}

function restoreGameBackground(): void {
    bgPlayer.stop();
    if (isAlive(bgObject)) bgObject!.method("SetActive").invoke(false);
    for (const r of gameRenderers()) if (hiddenGameRenderers.has(r.handle.toString())) r.method("set_enabled").invoke(true);
    hiddenGameRenderers.clear();
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
    const media = loadMedia(dirs.skins, settings.skinImage, settings.skinImageFps);
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
    const media = loadMedia(dirs.pfp, settings.pfp, settings.pfpFps);
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
    return [bgPlayer.current?.note, skinPlayer.current?.note, pfpPlayer.current?.note].filter((n): n is string => !!n);
}
