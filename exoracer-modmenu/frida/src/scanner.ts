import "frida-il2cpp-bridge";

// Same rules as the BepInEx version (src/Modules/CosmeticScanner.cs), ported to the IL2CPP runtime.

export type Kind = "true" | "false";

export interface Target {
    key: string;
    kind: Kind;
    source: "auto" | "config";
    address: NativePointer;
}

export interface Skipped {
    key: string;
    reason: string;
}

const NOUN = "skin|trail|glider|cosmetic|outfit|costume|hat|helmet|avatar|emote|effect|particle|wing|cape|color|colour|paint|style|item|reward|unlockable|customi[sz]ation|collectible";

// IsUnlocked, get_IsOwned, HasSkin, IsTrailUnlocked, IsPurchased, CanEquip …
const FORCE_TRUE = new RegExp(
    `^(is|has|get(is|has)?|check(if)?)?(been)?(${NOUN})?(unlocked|owned|owns|purchased|bought|acquired|collected|obtained)(${NOUN})?$` +
        `|^(can)(equip|select|wear)(${NOUN})?$` +
        `|^(has|owns)(${NOUN})$`,
    "i"
);

// IsLocked, get_IsSkinLocked, RequiresPurchase, NeedsUnlock …
const FORCE_FALSE = new RegExp(`^(is|get(is)?)?(${NOUN})?locked(${NOUN})?$|^(requires|needs)(purchase|unlock|buy)(ing)?$`, "i");

const COSMETIC_CONTEXT = /skin|trail|glider|cosmetic|outfit|costume|hat|helmet|avatar|emote|wing|cape|paint|wardrobe|locker|customi[sz]|unlockable|collectible|inventory|shop|store|item|reward|colou?r/i;

// Never touch these, even if the names match: they decide gameplay, progression or what gets sent
// to Exoracer's servers.
const EXCLUDED =
    /level|stage|map|leaderboard|record|ghost|replay|achievement|steam|network|server|http|request|api|auth|login|account|session|premium|subscription|vip|member|iap|receipt|dlc|tutorial|multiplayer|lobby|match|checkpoint|physics/i;

const THIRD_PARTY = [
    "system", "mscorlib", "netstandard", "mono.", "microsoft.", "unity.", "unityengine", "__generated",
    "newtonsoft", "steamworks", "facepunch", "com.rlabrecque", "dotween", "dg.tweening", "sirenix", "rewired",
    "photon", "mirror", "fishnet", "cinemachine", "purchasing", "firebase", "google", "playfab", "gameanalytics",
    "sentry", "zenject", "unitask", "unirx", "i18n", "nunit", "sharpziplib", "icsharpcode",
];

function assemblyName(a: Il2Cpp.Assembly): string {
    return a.name.replace(/\.dll$/i, "");
}

export function gameAssemblies(): Il2Cpp.Assembly[] {
    return Il2Cpp.domain.assemblies.filter(a => {
        const name = assemblyName(a);
        if (name.startsWith("Assembly-CSharp")) return true;
        const lower = name.toLowerCase();
        return !THIRD_PARTY.some(p => lower.startsWith(p));
    });
}

export function typeName(klass: Il2Cpp.Class): string {
    const outer = klass.declaringClass;
    return outer ? `${typeName(outer)}+${klass.name}` : klass.fullName;
}

export function keyOf(method: Il2Cpp.Method): string {
    return `${typeName(method.class)}.${method.name}`;
}

function normalizedName(method: Il2Cpp.Method): string {
    return method.name.replace(/^get_/, "").replace(/_/g, "");
}

function isPatchable(method: Il2Cpp.Method): boolean {
    try {
        if (method.returnType.name !== "System.Boolean") return false;
        if (method.isGeneric || method.class.isGeneric || method.class.isInflated) return false;
        if (method.name.includes("<") || typeName(method.class).includes("<")) return false;
        if (method.parameters.some(p => p.type.isByReference)) return false; // skipping the original would leave out/ref params unset
        return !method.virtualAddress.isNull(); // abstract/extern methods have no body
    } catch {
        return false;
    }
}

function hasCosmeticContext(method: Il2Cpp.Method): boolean {
    if (COSMETIC_CONTEXT.test(method.name)) return true;
    for (let k: Il2Cpp.Class | null = method.class; k; k = k.declaringClass) {
        if (COSMETIC_CONTEXT.test(k.name) || COSMETIC_CONTEXT.test(k.namespace ?? "")) return true;
    }
    return method.parameters.some(p => COSMETIC_CONTEXT.test(p.name ?? "") || COSMETIC_CONTEXT.test(p.type.name));
}

function classify(method: Il2Cpp.Method): Kind | null {
    if (!isPatchable(method)) return null;
    if (EXCLUDED.test(method.name) || EXCLUDED.test(typeName(method.class))) return null;
    if (!hasCosmeticContext(method)) return null;
    const name = normalizedName(method);
    if (FORCE_FALSE.test(name)) return "false";
    if (FORCE_TRUE.test(name)) return "true";
    return null;
}

function* allClasses(assemblies: Il2Cpp.Assembly[]): Generator<Il2Cpp.Class> {
    for (const assembly of assemblies) {
        let classes: Il2Cpp.Class[] = [];
        try {
            classes = assembly.image.classes;
        } catch {
            continue;
        }
        yield* classes;
    }
}

function methodsOf(klass: Il2Cpp.Class): Il2Cpp.Method[] {
    try {
        return klass.methods;
    } catch {
        return [];
    }
}

/**
 * IL2CPP folds methods with identical machine code into one function, so a skin's `get_IsUnlocked`
 * can be the very same code as, say, `get_IsGrounded`. Map every function address to the methods that
 * use it so nothing outside the cosmetic checks gets hooked by accident.
 */
function addressOwners(wanted: Set<string>): Map<string, string[]> {
    const owners = new Map<string, string[]>();
    if (wanted.size === 0) return owners;
    for (const klass of allClasses(Il2Cpp.domain.assemblies)) {
        for (const method of methodsOf(klass)) {
            let address: NativePointer;
            try {
                address = method.virtualAddress;
            } catch {
                continue;
            }
            if (address.isNull()) continue;
            const id = address.toString();
            if (!wanted.has(id)) continue;
            const list = owners.get(id);
            if (!list) owners.set(id, [keyOf(method)]);
            else if (list.length < 6) list.push(keyOf(method));
        }
    }
    return owners;
}

export interface ScanOptions {
    extra: string[]; // "Namespace.Type.Method" or "Namespace.Type.Method:false"
    ignored: string[];
    forceShared: string[]; // hook these even though other methods share their code
}

export interface ScanResult {
    targets: Target[];
    skipped: Skipped[];
    classesScanned: number;
    ms: number;
}

export function scan(options: ScanOptions): ScanResult {
    const started = Date.now();
    const extra = new Map<string, Kind>();
    for (const entry of options.extra) {
        const [key, kind] = entry.split(":").map(s => s.trim());
        if (key) extra.set(key, kind?.toLowerCase() === "false" ? "false" : "true");
    }
    const ignored = new Set(options.ignored);
    const forceShared = new Set(options.forceShared);

    const candidates: Target[] = [];
    const skipped: Skipped[] = [];
    let classesScanned = 0;

    for (const klass of allClasses(gameAssemblies())) {
        classesScanned++;
        for (const method of methodsOf(klass)) {
            const key = keyOf(method);
            if (ignored.has(key)) continue;

            const forced = extra.get(key);
            if (forced) {
                if (isPatchable(method)) candidates.push({ key, kind: forced, source: "config", address: method.virtualAddress });
                else skipped.push({ key, reason: "listed in extraMethods but isn't a hookable bool method" });
                continue;
            }

            const kind = classify(method);
            if (kind) candidates.push({ key, kind, source: "auto", address: method.virtualAddress });
        }
    }

    const owners = addressOwners(new Set(candidates.map(t => t.address.toString())));
    const candidateKeys = new Set(candidates.map(t => t.key));
    const byAddress = new Map<string, Target[]>();
    for (const t of candidates) {
        const id = t.address.toString();
        byAddress.set(id, [...(byAddress.get(id) ?? []), t]);
    }

    const targets: Target[] = [];
    for (const [id, group] of byAddress) {
        const kinds = new Set(group.map(t => t.kind));
        if (kinds.size > 1) {
            for (const t of group) skipped.push({ key: t.key, reason: "shares code with a check that needs the opposite answer" });
            continue;
        }
        const others = (owners.get(id) ?? []).filter(k => !candidateKeys.has(k));
        const forced = group.some(t => forceShared.has(t.key));
        if (others.length > 0 && !forced) {
            for (const t of group) skipped.push({ key: t.key, reason: `shares compiled code with ${others.slice(0, 3).join(", ")}` });
            continue;
        }
        targets.push(group[0]);
        for (const t of group.slice(1)) targets.push({ ...t }); // same address; listed for the UI, hooked once
    }

    return { targets, skipped, classesScanned, ms: Date.now() - started };
}

/** Everything that looks cosmetic-related, so the rules can be tuned without guessing. */
export function dump(result: ScanResult | null): string {
    const lines: string[] = [];
    lines.push("# ExoMenu cosmetic dump (IL2CPP)");
    lines.push(`# Unity ${safe(() => Il2Cpp.unityVersion)} · Exoracer ${safe(() => Il2Cpp.application.version ?? "?")} · ${new Date().toISOString()}`);
    lines.push("# Names only, no save data. Send this over if Unlock All misses something.");
    lines.push("");
    lines.push("## Assemblies scanned");
    for (const a of gameAssemblies()) lines.push(`  ${assemblyName(a)}`);
    lines.push("");

    if (result) {
        lines.push(`## Hooked (${result.targets.length})`);
        for (const t of [...result.targets].sort((a, b) => a.key.localeCompare(b.key))) lines.push(`  [${t.kind.padEnd(5)}] ${t.key}  <${t.source}>`);
        lines.push("");
        lines.push(`## Skipped for safety (${result.skipped.length})`);
        for (const s of result.skipped) lines.push(`  ${s.key}: ${s.reason}`);
        lines.push("");
    }

    lines.push("## Cosmetic-looking classes");
    let count = 0;
    for (const klass of allClasses(gameAssemblies())) {
        const name = typeName(klass);
        if (name.includes("<") || !COSMETIC_CONTEXT.test(name)) continue;
        if (++count > 600) {
            lines.push("  … truncated");
            break;
        }
        lines.push(`  ${name} : ${safe(() => klass.parent?.name ?? "")}`);
        try {
            for (const f of klass.fields) {
                const t = f.type.name;
                if (t === "System.Boolean" || t === "System.Int32" || f.type.class.isEnum) lines.push(`      field ${t} ${f.name}`);
            }
        } catch {}
        for (const m of methodsOf(klass)) {
            try {
                if (m.returnType.name !== "System.Boolean" || m.name.includes("<")) continue;
                lines.push(`      bool ${m.name}(${m.parameters.map(p => `${p.type.name} ${p.name}`).join(", ")})`);
            } catch {}
        }
    }
    return lines.join("\n") + "\n";
}

// Classes worth reading in full: where the game keeps what you own and where the customize screens ask.
const DEEP_CLASS =
    /inventory|customi[sz]|skin|glider|hook|trail|emote|playericon|cosmetic|equip|loadout|wardrobe|showcase|profile|^user$|userdata|localuser|currentuser|shop|store|reward|unlock|collection|catalog|gamedata/i;

// Methods anywhere in the game that sound like ownership, locking or equipping, whatever they return.
const DEEP_METHOD = /own|unlock|lock|equip|select|purchas|claim|obtain|acquire|^(has|is|can|get)(skin|glider|hook|trail|emote|icon|item|cosmetic)/i;
const DEEP_METHOD_CONTEXT = /skin|glider|hook|trail|emote|icon|cosmetic|item|inventory|reward|customi[sz]/i;

function signature(m: Il2Cpp.Method): string {
    return `${m.isStatic ? "static " : ""}${m.returnType.name} ${m.name}(${m.parameters.map(p => `${p.type.name} ${p.name}`).join(", ")})`;
}

/**
 * Full fields and method signatures of the inventory/skin/customize classes, plus every
 * ownership-sounding method in the game. The first dump only lists bool checks; this one shows
 * where ownership actually lives when the game doesn't have an IsOwned-style check.
 */
export function deepDump(): string {
    const lines: string[] = [];
    lines.push("# ExoMenu deep dump (IL2CPP)");
    lines.push(`# Unity ${safe(() => Il2Cpp.unityVersion)} · Exoracer ${safe(() => Il2Cpp.application.version ?? "?")} · ${new Date().toISOString()}`);
    lines.push("# Names and types only, no save data.");
    lines.push("");

    const game = Il2Cpp.domain.assemblies.filter(a => assemblyName(a).startsWith("Assembly-CSharp"));

    lines.push("## Ownership-sounding methods");
    for (const klass of allClasses(game)) {
        const cls = typeName(klass);
        if (cls.includes("<")) continue;
        for (const m of methodsOf(klass)) {
            try {
                if (m.name.includes("<") || !DEEP_METHOD.test(m.name)) continue;
                const context = `${cls} ${m.name} ${m.parameters.map(p => p.type.name).join(" ")} ${m.returnType.name}`;
                if (!DEEP_METHOD_CONTEXT.test(context)) continue;
                lines.push(`  ${cls} :: ${signature(m)}`);
            } catch {}
        }
    }
    lines.push("");

    lines.push("## Inventory, skin, customize and shop classes");
    let count = 0;
    for (const klass of allClasses(game)) {
        const name = typeName(klass);
        if (name.includes("<") || !DEEP_CLASS.test(klass.name)) continue;
        if (++count > 400) {
            lines.push("  … truncated");
            break;
        }
        lines.push("");
        lines.push(`  class ${name} : ${safe(() => klass.parent?.fullName ?? "")}`);
        try {
            for (const f of klass.fields) {
                if (f.name.includes("<") && !f.name.includes("k__BackingField")) continue;
                lines.push(`      ${f.isStatic ? "static " : ""}${f.type.name} ${f.name}`);
            }
        } catch {}
        for (const m of methodsOf(klass)) {
            try {
                if (!m.name.includes("<")) lines.push(`      ${signature(m)}`);
            } catch {}
        }
    }
    return lines.join("\n") + "\n";
}

function safe(f: () => string): string {
    try {
        return f();
    } catch {
        return "?";
    }
}
