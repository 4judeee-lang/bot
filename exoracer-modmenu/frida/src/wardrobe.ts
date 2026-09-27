import "frida-il2cpp-bridge";
import { replaceWithConstant, revertTarget } from "./native.js";
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

function gameClass(name: string): Il2Cpp.Class | null {
    return Il2Cpp.domain.tryAssembly("Assembly-CSharp")?.image.tryClass(name) ?? null;
}

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

const chosen: Partial<Record<Slot, { id: string; pointer: NativePointer }>> = {};
// Pinned forever: freeing a handle crashed in 0.3.1, and a stub may still point at the old string.
const pins: Il2Cpp.GCHandle[] = [];
const targets: Partial<Record<Slot, NativePointer | null>> = {};

/**
 * The DebugController getter for a slot, or null if it's missing or its compiled code is shared with
 * other methods (hooking shared code would change those too, which is what froze 0.3.0).
 */
function overrideTarget(slot: Slot, log: Log): NativePointer | null {
    if (slot in targets) return targets[slot]!;
    targets[slot] = null;
    const method = gameClass("NyanStudio.DebugController")?.tryMethod(OVERRIDE_METHOD[slot], 0);
    if (!method || method.virtualAddress.isNull()) {
        log(`Wardrobe: DebugController.${OVERRIDE_METHOD[slot]} not found`);
        return null;
    }
    const shared = sharedWith(method);
    if (shared.length > 0) {
        log(`Wardrobe: not hooking DebugController.${OVERRIDE_METHOD[slot]}, its code is shared with ${shared.slice(0, 3).join(", ")}`);
        return null;
    }
    targets[slot] = method.virtualAddress;
    return method.virtualAddress;
}

/** Returns false if this slot can't be overridden safely. */
export function setOverride(slot: Slot, id: string | null, log: Log): boolean {
    const target = overrideTarget(slot, log);
    if (!target) return false;
    revertTarget(target);
    delete chosen[slot];
    if (id) {
        const str = Il2Cpp.string(id);
        // Pin it so the garbage collector never frees a string the game is still reading.
        pins.push(str.object.ref(true));
        chosen[slot] = { id, pointer: str.handle };
        replaceWithConstant(target, str.handle);
    }
    log(`Wardrobe: ${slot} → ${id ?? "(your own)"}`);
    return true;
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
                log(`Trace: ${label}(${p ? readString(p) : ""})`);
                if (--remaining <= 0) Script.nextTick(() => listener.detach());
            },
        });
        attached++;
    }
    log(`Trace: recording ${attached} equip methods; equip something in the game now`);
    return attached;
}

function readString(p: NativePointer): string {
    if (p.isNull()) return "null";
    try {
        const s = new Il2Cpp.String(p).content;
        return s === null ? "null" : JSON.stringify(s);
    } catch {
        return p.toString();
    }
}
