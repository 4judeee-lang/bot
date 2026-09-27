import "frida-il2cpp-bridge";

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

const chosen: Partial<Record<Slot, { id: string; handle: Il2Cpp.GCHandle; pointer: NativePointer }>> = {};
let hooksInstalled = false;

function installHooks(log: Log): void {
    if (hooksInstalled) return;
    hooksInstalled = true;
    const debug = gameClass("NyanStudio.DebugController");
    if (!debug) return log("Wardrobe: NyanStudio.DebugController not found; can't override cosmetics");
    for (const slot of SLOTS) {
        const method = debug.tryMethod(OVERRIDE_METHOD[slot], 0);
        if (!method || method.virtualAddress.isNull()) {
            log(`Wardrobe: DebugController.${OVERRIDE_METHOD[slot]} not found`);
            continue;
        }
        Interceptor.attach(method.virtualAddress, {
            onLeave(retval) {
                const pick = chosen[slot];
                if (pick) retval.replace(pick.pointer);
            },
        });
        log(`Wardrobe: hooked DebugController.${OVERRIDE_METHOD[slot]}`);
    }
}

export function setOverride(slot: Slot, id: string | null, log: Log): void {
    installHooks(log);
    chosen[slot]?.handle.free();
    delete chosen[slot];
    if (id) {
        const str = Il2Cpp.string(id);
        // Pin it so the garbage collector never frees a string the game is still reading.
        chosen[slot] = { id, handle: str.object.ref(true), pointer: str.handle };
    }
    log(`Wardrobe: ${slot} → ${id ?? "(your own)"}`);
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
export function traceEquipFlow(log: Log): void {
    const targets: [string, string, "arg" | "ret"][] = [
        ["NyanStudio.DebugController", "GetSkin", "ret"],
        ["NyanStudio.DebugController", "GetGliderSkin", "ret"],
        ["NyanStudio.DebugController", "GetHookSkin", "ret"],
        ["NyanStudio.DebugController", "GetTrail", "ret"],
        ["NyanStudio.DataController", "get_SelectedSkin", "ret"],
        ["NyanStudio.DataController", "get_SelectedTrail", "ret"],
        ["NyanStudio.DataController", "set_SelectedSkin", "arg"],
        ["NyanStudio.DataController", "set_SelectedGliderSkin", "arg"],
        ["NyanStudio.DataController", "set_SelectedHookSkin", "arg"],
        ["NyanStudio.DataController", "set_SelectedTrail", "arg"],
        ["NyanStudio.CustomizeUI", "SetSelectedSkin", "arg"],
        ["NyanStudio.CustomizeLandscapeUI", "SetSelectedSkin", "arg"],
        ["NyanStudio.CollectionPanel", "SetSelectedSkin", "arg"],
        ["NyanStudio.CollectionPanel", "SetSelectedTrail", "arg"],
        ["NyanStudio.SkinItem", "OnClickSelect", "arg"],
        ["NyanStudio.SkinInfoUI", "OnClickUse", "arg"],
    ];
    for (const [className, methodName, what] of targets) {
        const method = gameClass(className)?.tryMethod(methodName);
        if (!method || method.virtualAddress.isNull()) {
            log(`Trace: ${className}.${methodName} not found`);
            continue;
        }
        let remaining = 6;
        const label = `${className.replace("NyanStudio.", "")}.${methodName}`;
        const listener = Interceptor.attach(method.virtualAddress, {
            onEnter(args) {
                if (what !== "arg" || remaining <= 0) return;
                // Instance methods: args[0] is `this`, args[1] the first parameter; statics start at args[0].
                const p = method.parameterCount > 0 ? args[method.isStatic ? 0 : 1] : null;
                log(`Trace: ${label}(${p ? readString(p) : ""})`);
                if (--remaining <= 0) Script.nextTick(() => listener.detach());
            },
            onLeave(retval) {
                if (what !== "ret" || remaining <= 0) return;
                log(`Trace: ${label} → ${readString(retval)}`);
                if (--remaining <= 0) Script.nextTick(() => listener.detach());
            },
        });
    }
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
