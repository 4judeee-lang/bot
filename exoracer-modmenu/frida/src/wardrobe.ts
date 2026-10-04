import "frida-il2cpp-bridge";
import { equipped, gameClass, readString } from "./game.js";
import { sharedWith } from "./scanner.js";

// Exoracer keeps what you own in UserInventory (lists of ids) and what you wear in DataController /
// User. Equipping goes through the server, which refuses anything you don't own. The wardrobe instead
// answers DebugController.GetSkin/GetGliderSkin/GetHookSkin/GetTrail, the game's own developer
// override for what your character wears, so a pick only changes what this Mac draws. Nothing is
// written to your inventory, your save or the server.

export type Slot = "skin" | "gliderSkin" | "hookSkin" | "trail";
export const SLOTS: Slot[] = ["skin", "gliderSkin", "hookSkin", "trail"];

const CATALOG_CLASS: Record<Slot, string> = {
    skin: "NyanStudio.Skin",
    gliderSkin: "NyanStudio.GliderSkin",
    hookSkin: "NyanStudio.HookSkin",
    trail: "NyanStudio.Blueprint", // trails are "blueprints" in Exoracer
};

const OVERRIDE_METHOD: Record<Slot, string> = {
    skin: "GetSkin",
    gliderSkin: "GetGliderSkin",
    hookSkin: "GetHookSkin",
    trail: "GetTrail",
};

const OWNED_LIST: Record<Slot, string> = { skin: "skins", gliderSkin: "gliderSkins", hookSkin: "hookSkins", trail: "blueprints" };

type Log = (message: string) => void;


function stringField(obj: Il2Cpp.Object, name: string): string | null {
    try {
        const value = obj.tryField<Il2Cpp.String>(name)?.value;
        return value && !value.isNull() ? value.content : null;
    } catch {
        return null;
    }
}

function stringList(obj: Il2Cpp.Object, name: string): string[] {
    try {
        const list = obj.tryField<Il2Cpp.Object>(name)?.value;
        if (!list || list.isNull()) return [];
        const count = list.method<number>("get_Count").invoke();
        const out: string[] = [];
        for (let i = 0; i < count; i++) {
            const s = list.method<Il2Cpp.String>("get_Item").invoke(i);
            if (!s.isNull() && s.content) out.push(s.content);
        }
        return out;
    } catch {
        return [];
    }
}

// ── catalog ───────────────────────────────────────────────────────────────────────────────

export interface Catalog {
    items: Record<Slot, string[]>;
    owned: Record<Slot, string[]>;
}

let cached: Record<Slot, string[]> | null = null;

/** Every skin/glider/hook/trail id the game has loaded, found by walking live objects. */
export function catalog(log: Log): Catalog {
    if (!cached || SLOTS.some(s => cached![s].length === 0)) {
        const items = {} as Record<Slot, string[]>;
        for (const slot of SLOTS) {
            const klass = gameClass(CATALOG_CLASS[slot]);
            const ids = new Set<string>();
            if (klass) {
                for (const obj of Il2Cpp.gc.choose(klass)) {
                    const id = (slot === "trail" ? stringField(obj, "trail") : null) ?? stringField(obj, "id");
                    if (id) ids.add(id);
                }
            }
            items[slot] = [...ids].sort();
        }
        cached = items;
        log(`Wardrobe catalog: ${SLOTS.map(s => `${items[s].length} ${s}`).join(", ")}`);
        describeBlueprint(log);
    }

    const owned = { skin: [], gliderSkin: [], hookSkin: [], trail: [] } as Record<Slot, string[]>;
    const inventoryClass = gameClass("NyanStudio.UserInventory");
    const inventory = inventoryClass ? Il2Cpp.gc.choose(inventoryClass).find(o => stringList(o, "skins").length > 0) : undefined;
    if (inventory) for (const slot of SLOTS) owned[slot] = stringList(inventory, OWNED_LIST[slot]);

    return { items: cached, owned };
}

let blueprintDescribed = false;
function describeBlueprint(log: Log): void {
    if (blueprintDescribed) return;
    blueprintDescribed = true;
    const klass = gameClass("NyanStudio.Blueprint");
    if (!klass) return log("Wardrobe: NyanStudio.Blueprint not found");
    try {
        log(`Wardrobe: Blueprint fields = ${klass.fields.map(f => `${f.type.name} ${f.name}`).join(", ")}`);
    } catch {}
}

// ── overrides ─────────────────────────────────────────────────────────────────────────────
//
// CharacterEntityView.SetSkin(skin, preview) / SetGliderSkin(id) / SetHookSkin(id) /
// SetTrail(trailId, secondaryTrailId) are what put cosmetics on a character, in menus and in levels.
// When one of them is called with what *you* really wear, the id is swapped for your pick before the
// game looks it up, so only your character changes and only on this Mac.

const chosen: Partial<Record<Slot, { id: string; pointer: NativePointer }>> = {};
// Pinned for the whole session: the game may keep reading a string after we've moved on.
const pins: Il2Cpp.GCHandle[] = [];
let extraTrails: string[] = [];
let hooksReady: boolean | null = null;
let swapLogs = 8;

function pinned(id: string): NativePointer {
    const str = Il2Cpp.string(id);
    pins.push(str.object.ref(true));
    return str.handle;
}

type ViewHook = { method: string; params: string[]; slot: Slot; getter: string };
const VIEW_HOOKS: ViewHook[] = [
    { method: "SetSkin", params: ["System.String", "System.Boolean"], slot: "skin", getter: "get_Skin" },
    { method: "SetGliderSkin", params: ["System.String"], slot: "gliderSkin", getter: "get_GliderSkin" },
    { method: "SetHookSkin", params: ["System.String"], slot: "hookSkin", getter: "get_HookSkin" },
    { method: "SetTrail", params: ["System.String", "System.String"], slot: "trail", getter: "get_Trail" },
];

const dressedListeners: ((view: Il2Cpp.Object) => void)[] = [];

/** Calls `cb` (on the main thread) with your CharacterEntityView each time the game dresses it. */
export function onMyCharacterDressed(cb: (view: Il2Cpp.Object) => void, log: Log): boolean {
    if (!installViewHooks(log)) return false;
    dressedListeners.push(cb);
    return true;
}

function installViewHooks(log: Log): boolean {
    if (hooksReady !== null) return hooksReady;
    const view = gameClass("NyanStudio.CharacterEntityView");
    if (!view) {
        log("Wardrobe: NyanStudio.CharacterEntityView not found");
        return (hooksReady = false);
    }
    let count = 0;
    for (const h of VIEW_HOOKS) {
        const method = view.tryMethod(h.method, h.params.length)?.tryOverload(...h.params);
        if (!method || method.virtualAddress.isNull()) {
            log(`Wardrobe: CharacterEntityView.${h.method} not found`);
            continue;
        }
        const shared = sharedWith(method);
        if (shared.length > 0) {
            log(`Wardrobe: not hooking CharacterEntityView.${h.method}, its code is shared with ${shared.slice(0, 3).join(", ")}`);
            continue;
        }
        const isTrail = h.slot === "trail";
        Interceptor.attach(method.virtualAddress, {
            // Runs on the game's main thread, only when a character is dressed (not every frame).
            onEnter(args) {
                this.mine = false;
                const pick = chosen[h.slot];
                const wanted = pick || (isTrail && extraTrails.length > 0) || (h.slot === "skin" && dressedListeners.length > 0);
                if (!wanted) return;
                const passed = readString(args[1]);
                if (passed === null || passed !== equipped(h.getter)) return; // someone else's character
                this.mine = true;
                this.self = args[0];
                this.secondary = isTrail ? args[2] : NULL;
                if (pick) {
                    args[1] = pick.pointer;
                    if (swapLogs-- > 0) log(`Wardrobe: dressed your character: ${h.method}(${passed} → ${pick.id})`);
                }
            },
            onLeave() {
                if (h.slot === "skin" && this.mine) {
                    const view = new Il2Cpp.Object(this.self);
                    for (const cb of dressedListeners) {
                        try {
                            cb(view);
                        } catch (e) {
                            log(`After dressing your character: ${e}`);
                        }
                    }
                }
                if (isTrail && this.mine && extraTrails.length > 0 && !addingTrails) {
                    try {
                        addExtraTrails(new Il2Cpp.Object(this.self), log);
                    } catch (e) {
                        log(`Extra trails failed: ${e}`);
                    }
                }
            },
        });
        count++;
        log(`Wardrobe: hooked CharacterEntityView.${h.method}`);
    }
    return (hooksReady = count > 0);
}

// ── extra trails (experimental) ───────────────────────────────────────────────────────────
//
// The game gives a character two trails. For each extra one: set it as the secondary trail, clone the
// resulting trail object onto the character, then put the real secondary trail back.

let addingTrails = false;
const clones = new Map<string, Il2Cpp.Object[]>(); // view handle → cloned trail objects

function unityObject(): Il2Cpp.Class {
    return Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class("UnityEngine.Object");
}

function addExtraTrails(view: Il2Cpp.Object, log: Log): void {
    const key = view.handle.toString();
    const destroy = unityObject().method("Destroy", 1);
    for (const old of clones.get(key) ?? []) destroy.invoke(old);
    clones.set(key, []);

    const setTrail = view.method("SetTrail", 2).overload("System.String", "System.String");
    const primary = equipped("get_Trail");
    const secondary = equipped("get_SecondaryTrail");
    const instantiate = unityObject().method<Il2Cpp.Object>("Instantiate", 2).overload("UnityEngine.Object", "UnityEngine.Transform");
    const parent = view.field<Il2Cpp.Object>("trailTransform").value;

    addingTrails = true;
    try {
        for (const id of extraTrails) {
            setTrail.invoke(Il2Cpp.string(primary), Il2Cpp.string(id));
            const trail = view.field<Il2Cpp.Object>("secondaryTrail").value;
            if (trail.isNull()) continue;
            const go = trail.method<Il2Cpp.Object>("get_gameObject").invoke();
            clones.get(key)!.push(instantiate.invoke(go, parent));
        }
        setTrail.invoke(Il2Cpp.string(primary), Il2Cpp.string(secondary));
        log(`Extra trails: added ${clones.get(key)!.length} (${extraTrails.join(", ")})`);
    } finally {
        addingTrails = false;
    }
}

/** Returns false if the game's character code couldn't be hooked safely. */
export function setOverride(slot: Slot, id: string | null, log: Log): boolean {
    if (!installViewHooks(log)) return false;
    delete chosen[slot];
    if (id) chosen[slot] = { id, pointer: pinned(id) };
    log(`Wardrobe: ${slot} → ${id ?? "(your own)"}`);
    return true;
}

export function setExtraTrails(ids: string[], log: Log): boolean {
    if (!installViewHooks(log)) return false;
    extraTrails = ids.slice(0, 8);
    log(`Extra trails: ${extraTrails.length ? extraTrails.join(", ") : "none"}`);
    return true;
}

export function getExtraTrails(): string[] {
    return [...extraTrails];
}

export function overrides(): Partial<Record<Slot, string>> {
    const out: Partial<Record<Slot, string>> = {};
    for (const slot of SLOTS) if (chosen[slot]) out[slot] = chosen[slot]!.id;
    return out;
}

// ── tracing ───────────────────────────────────────────────────────────────────────────────

/**
 * Logs the first few calls to the methods involved in equipping, with their arguments, so the
 * next version can hook exactly the right place if the DebugController override isn't used everywhere.
 */
export function traceEquipFlow(log: Log): number {
    const targets: [string, string][] = [
        ["NyanStudio.DataController", "set_SelectedSkin"],
        ["NyanStudio.DataController", "set_SelectedGliderSkin"],
        ["NyanStudio.DataController", "set_SelectedHookSkin"],
        ["NyanStudio.DataController", "set_SelectedTrail"],
        ["NyanStudio.CustomizeUI", "SetSelectedSkin"],
        ["NyanStudio.CustomizeUI", "SetSelectedTrail"],
        ["NyanStudio.CustomizeLandscapeUI", "SetSelectedSkin"],
        ["NyanStudio.CustomizeLandscapeUI", "SetSelectedTrail"],
        ["NyanStudio.CollectionPanel", "SetSelectedSkin"],
        ["NyanStudio.CollectionPanel", "SetSelectedGliderSkin"],
        ["NyanStudio.CollectionPanel", "SetSelectedHookSkin"],
        ["NyanStudio.CollectionPanel", "SetSelectedTrail"],
        ["NyanStudio.SkinItem", "OnClickSelect"],
        ["NyanStudio.SkinInfoUI", "OnClickUse"],
        ["NyanStudio.DataController", "set_Skin"],
        ["NyanStudio.DataController", "set_Trail"],
        ["NyanStudio.DataController", "set_SecondaryTrail"],
        ["NyanStudio.DataController", "SendPendingCosmeticChange"],
    ];
    let attached = 0;
    for (const [className, methodName] of targets) {
        const method = gameClass(className)?.tryMethod(methodName);
        const label = `${className.replace("NyanStudio.", "")}.${methodName}`;
        if (!method || method.virtualAddress.isNull()) {
            log(`Trace: ${label} not found`);
            continue;
        }
        const shared = sharedWith(method);
        if (shared.length > 0) {
            log(`Trace: skipping ${label}, its code is shared with ${shared.slice(0, 3).join(", ")}`);
            continue;
        }
        let remaining = 6;
        const listener = Interceptor.attach(method.virtualAddress, {
            onEnter(args) {
                if (remaining <= 0) return;
                // Instance methods: args[0] is `this`, args[1] the first parameter.
                const p = method.parameterCount > 0 ? args[method.isStatic ? 0 : 1] : null;
                log(`Trace: ${label}(${p ? quoted(p) : ""})`);
                if (--remaining <= 0) Script.nextTick(() => listener.detach());
            },
        });
        attached++;
    }
    log(`Trace: recording ${attached} equip methods; equip something in the game now`);
    return attached;
}

function quoted(p: NativePointer): string {
    if (p.isNull()) return "null";
    try {
        const s = new Il2Cpp.String(p).content;
        return s === null ? "null" : JSON.stringify(s);
    } catch {
        return p.toString();
    }
}
