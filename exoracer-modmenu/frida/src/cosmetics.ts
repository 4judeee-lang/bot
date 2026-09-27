import "frida-il2cpp-bridge";
import { replaceWithConstant, revertTarget } from "./native.js";
import { sharedWith } from "./scanner.js";
import { dataController, equipped, gameClass } from "./game.js";
import { catalog, Slot, SLOTS } from "./wardrobe.js";

// "Own everything", on this Mac only.
//
// Exoracer's customize screens list what's in UserInventory (skins, gliderSkins, hookSkins and
// blueprints, which are trails). Adding every catalog id to those in-memory lists makes everything
// show as owned and equippable. Equipping then goes through DataController.set_Skin/set_Trail…,
// and DataController.SendPendingCosmeticChange() is what uploads the change; while this is on that
// upload is replaced with a no-op, so the server never hears about it and other players keep seeing
// your real cosmetics. Turning it off removes the added ids and puts your real equips back.

type Log = (message: string) => void;

const INVENTORY_LIST: Record<Slot, string> = { skin: "skins", gliderSkin: "gliderSkins", hookSkin: "hookSkins", trail: "blueprints" };
// What you're wearing, as DataController getters/setters.
const EQUIPPED: [string, string][] = [
    ["get_Skin", "set_Skin"],
    ["get_GliderSkin", "set_GliderSkin"],
    ["get_HookSkin", "set_HookSkin"],
    ["get_Trail", "set_Trail"],
    ["get_SecondaryTrail", "set_SecondaryTrail"],
];

function dataControllerClass(): Il2Cpp.Class | null {
    return gameClass("NyanStudio.DataController");
}

function readList(list: Il2Cpp.Object): string[] {
    const out: string[] = [];
    const count = list.method<number>("get_Count").invoke();
    for (let i = 0; i < count; i++) {
        const s = list.method<Il2Cpp.String>("get_Item").invoke(i);
        if (!s.isNull() && s.content) out.push(s.content);
    }
    return out;
}

const added: Record<Slot, Set<string>> = { skin: new Set(), gliderSkin: new Set(), hookSkin: new Set(), trail: new Set() };
let realEquips: Record<string, string | null> | null = null;
let uploadBlock: NativePointer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let active = false;

function fillInventory(log: Log): number {
    const inventory = dataController()?.method<Il2Cpp.Object>("get_UserInventory").invoke();
    if (!inventory || inventory.isNull()) return 0;
    const items = catalog(log).items;
    let count = 0;
    for (const slot of SLOTS) {
        const list = inventory.field<Il2Cpp.Object>(INVENTORY_LIST[slot]).value;
        if (list.isNull()) continue;
        const have = new Set(readList(list));
        for (const id of items[slot]) {
            if (have.has(id)) continue;
            list.method("Add").invoke(Il2Cpp.string(id));
            added[slot].add(id);
            count++;
        }
    }
    return count;
}

function emptyInventory(): void {
    const inventory = dataController()?.method<Il2Cpp.Object>("get_UserInventory").invoke();
    if (!inventory || inventory.isNull()) return;
    for (const slot of SLOTS) {
        const list = inventory.field<Il2Cpp.Object>(INVENTORY_LIST[slot]).value;
        if (!list.isNull()) for (const id of added[slot]) list.method("Remove").invoke(Il2Cpp.string(id));
        added[slot].clear();
    }
}

function blockUpload(log: Log): boolean {
    const method = dataControllerClass()?.tryMethod("SendPendingCosmeticChange", 0);
    if (!method || method.virtualAddress.isNull()) {
        log("Own everything: DataController.SendPendingCosmeticChange not found; not turning on (it could reach the server)");
        return false;
    }
    const shared = sharedWith(method);
    if (shared.length > 0) {
        log(`Own everything: SendPendingCosmeticChange shares code with ${shared.slice(0, 3).join(", ")}; not turning on`);
        return false;
    }
    replaceWithConstant(method.virtualAddress, ptr(0)); // a no-op: nothing is uploaded
    uploadBlock = method.virtualAddress;
    return true;
}

/** Runs on Unity's main thread, since the game reads these lists from there. */
export async function setOwnEverything(on: boolean, log: Log): Promise<string> {
    if (on === active) return status();
    if (on) {
        const ok = await Il2Cpp.perform(() => {
            if (!dataController()) {
                log("Own everything: DataController isn't loaded yet");
                return false;
            }
            if (!blockUpload(log)) return false;
            realEquips = Object.fromEntries(EQUIPPED.map(([get]) => [get, equipped(get)]));
            log(`Own everything: blocked cosmetic uploads; real equips ${JSON.stringify(realEquips)}`);
            log(`Own everything: added ${fillInventory(log)} items to your inventory (in memory only)`);
            return true;
        }, "main");
        if (!ok) return "Couldn't turn on safely; see exomenu.log.";
        active = true;
        // The game can replace the inventory when it refreshes from the server; top it up.
        timer = setInterval(() => {
            Il2Cpp.perform(() => {
                const n = fillInventory(log);
                if (n > 0) log(`Own everything: re-added ${n} items after the game refreshed your inventory`);
            }, "main").catch(e => log(`Own everything: refresh failed: ${e}`));
        }, 5000);
    } else {
        if (timer) clearInterval(timer);
        timer = null;
        await Il2Cpp.perform(() => {
            emptyInventory();
            // Put your real equips back before uploads resume, so nothing you don't own is ever sent.
            const dc = dataController();
            if (dc && realEquips) {
                for (const [get, set] of EQUIPPED) {
                    const real = realEquips[get];
                    if (real !== equipped(get)) dc.method(set).invoke(real === null ? Il2Cpp.string(null) : Il2Cpp.string(real));
                }
            }
            if (uploadBlock) revertTarget(uploadBlock);
            uploadBlock = null;
            log("Own everything: off, real inventory and equips restored");
        }, "main");
        active = false;
    }
    return status();
}

export function status(): string {
    if (!active) return "Off.";
    const n = SLOTS.reduce((sum, s) => sum + added[s].size, 0);
    return `On: ${n} extra items in customization, on your screen only. Equip anything; nothing is sent to the server while this is on.`;
}
