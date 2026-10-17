import "frida-il2cpp-bridge";
import { ensureDir, listFiles } from "./fsutil.js";
import { dataController, gameClass } from "./game.js";
import { sharedWith } from "./scanner.js";
import { uclass } from "./unity.js";

// Copy a custom level you've played into your own level editor.
//
// Everything goes through the game's own level code: the level you last loaded is read from the
// game's download cache (LevelDataSerializer.LoadDownloadedLevelData), wrapped in the game's
// share-file format (LevelShareData) and saved to ExoMenu/levels. "Open in editor" then runs the
// editor's own Import Level on that file (EditorMenuUI.DoImportLevel).
//
// Copies of other people's levels are for learning and practice: uploading one is blocked here
// (LevelService.UploadLevel / UploadRankedLevel answer NOT_THE_AUTHOR), because Exoracer has no
// "allow copying" setting for creators. Copies of your own levels upload normally.

type Log = (message: string) => void;

export interface CopiedLevel {
    file: string; // in ExoMenu/levels
    name: string;
    sourceId: string;
    sourceVersion: number;
    author: string;
    authorId: string | null;
    mine: boolean;
    copyId: string; // the id we gave the copy
    fingerprint: string; // tile/object counts, to recognise the copy after the editor re-saves it
    date: string;
}

export interface LevelsHost {
    copies: () => CopiedLevel[];
    saveCopies: (copies: CopiedLevel[]) => void;
}

interface LastLevel {
    id: string;
    version: number;
    name: string;
    author: string;
    nova: boolean;
}

let dir = "";
let log: Log = () => {};
let host: LevelsHost;
let last: LastLevel | null = null;
let guardStatus = "not set up";
const blocked: string[] = [];

const serializer = () => gameClass("NyanStudio.LevelDataSerializer");

function str(obj: Il2Cpp.Object, field: string): string | null {
    try {
        const s = obj.tryField<Il2Cpp.String>(field)?.value;
        return s && !s.isNull() ? s.content : null;
    } catch {
        return null;
    }
}

function setStr(obj: Il2Cpp.Object, field: string, value: string | null): void {
    const f = obj.tryField(field);
    if (f) f.value = value === null ? (NULL as any) : Il2Cpp.string(value);
}

function count(obj: Il2Cpp.Object, field: string): number {
    try {
        const d = obj.tryField<Il2Cpp.Object>(field)?.value;
        return d && !d.isNull() ? d.method<number>("get_Count").invoke() : 0;
    } catch {
        return 0;
    }
}

function fingerprint(levelData: Il2Cpp.Object): string {
    return ["terrainTiles", "objectTiles", "objects", "backgroundDecorationTiles", "foregroundDecorationTiles"].map(f => count(levelData, f)).join("/");
}

function myUser(): { id: string | null; name: string | null } {
    try {
        const user = dataController()?.method<Il2Cpp.Object>("get_User").invoke();
        if (!user || user.isNull()) return { id: null, name: null };
        return { id: str(user, "id"), name: str(user, "displayName") };
    } catch {
        return { id: null, name: null };
    }
}

interface LevelInfo {
    name: string;
    author: string;
    authorId: string | null;
}
const infoCache = new Map<string, LevelInfo>();
const infoMisses = new Map<string, number>(); // level id → when we last looked and didn't find it

/**
 * A level's real name and author. Downloaded level files often leave these empty; the game keeps
 * them on its Level objects (the lists you browse). One heap scan per level, cached.
 */
function levelInfo(levelId: string): LevelInfo | null {
    if (infoCache.has(levelId)) return infoCache.get(levelId)!;
    if (Date.now() - (infoMisses.get(levelId) ?? 0) < 15000) return null;
    let info: LevelInfo | null = null;
    const klass = gameClass("NyanStudio.Level");
    try {
        for (const level of klass ? Il2Cpp.gc.choose(klass) : []) {
            if (str(level, "id") !== levelId) continue;
            const author = level.tryField<Il2Cpp.Object>("author")?.value;
            const hasAuthor = !!author && !author.isNull();
            info = { name: str(level, "name") ?? "", author: hasAuthor ? str(author!, "displayName") ?? "" : "", authorId: hasAuthor ? str(author!, "id") : null };
            break;
        }
    } catch {}
    if (info) infoCache.set(levelId, info);
    else infoMisses.set(levelId, Date.now());
    return info;
}

function exists(path: string): boolean {
    try {
        new File(path, "rb").close();
        return true;
    } catch {
        return false;
    }
}

function describe(exceptionSlot: NativePointer): string {
    const p = exceptionSlot.readPointer();
    if (p.isNull()) return "";
    try {
        const e = new Il2Cpp.Object(p);
        const m = e.tryMethod<Il2Cpp.String>("get_Message")?.invoke();
        return `${e.class.name}: ${m && !m.isNull() ? m.content : ""}`;
    } catch {
        return "an error";
    }
}

function uuid(): string {
    const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${h(8)}-${h(4)}-4${h(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${h(3)}-${h(12)}`;
}

function safeName(name: string): string {
    return (name.replace(/[^A-Za-z0-9 _-]+/g, "").trim() || "level").slice(0, 60);
}

// ── watching what you play ─────────────────────────────────────────────────────────────

function watchLevelLoads(): void {
    const klass = gameClass("NyanStudio.LevelLoaderController");
    const method = klass?.tryMethod("ContinueLoadLevel", 2);
    if (!method || method.virtualAddress.isNull() || sharedWith(method).length > 0) {
        log("Levels: can't watch level loading; Copy level is off");
        return;
    }
    Interceptor.attach(method.virtualAddress, {
        onEnter(args) {
            try {
                const data = new Il2Cpp.Object(args[1]);
                if (data.isNull()) return;
                const id = str(data, "id");
                if (!id) return;
                last = {
                    id,
                    version: data.field<number>("version").value,
                    name: str(data, "levelName") || "",
                    author: str(data, "authorDisplayName") || "",
                    nova: !!data.field<boolean>("novaLevel").value,
                };
            } catch {}
        },
    });
}

// ── upload guard ────────────────────────────────────────────────────────────────────────

function isCopyOfSomeoneElse(localLevel: Il2Cpp.Object, levelData: Il2Cpp.Object | null): CopiedLevel | null {
    const others = host.copies().filter(c => !c.mine);
    if (others.length === 0) return null;
    const id = str(localLevel, "id");
    const print = levelData && !levelData.isNull() ? fingerprint(levelData) : null;
    return others.find(c => c.copyId === id || (print !== null && print === c.fingerprint && print !== "0/0/0/0/0")) ?? null;
}

function guardUpload(methodName: string, callbackOffset: number): boolean {
    const klass = gameClass("NyanStudio.LevelService");
    const method = klass?.tryMethod(methodName);
    const localLevelClass = gameClass("NyanStudio.LocalLevel");
    const resultClass = gameClass("NyanStudio.LevelServiceResult");
    if (!method || !localLevelClass || !resultClass || method.virtualAddress.isNull() || sharedWith(method).length > 0) {
        log(`Levels: can't guard LevelService.${methodName}`);
        return false;
    }
    const n = 8; // more than either method takes; extra registers are passed through untouched
    const types = Array(n).fill("pointer") as "pointer"[];
    const original = new NativeFunction(method.virtualAddress, "void", types);
    Interceptor.replace(
        method.virtualAddress,
        new NativeCallback(
            (...raw: any[]) => {
                const args = raw as NativePointer[];
                try {
                    // Static methods may or may not get an unused first slot, depending on the Unity version.
                    const at = [0, 1].find(i => !args[i].isNull() && new Il2Cpp.Object(args[i]).class.handle.equals(localLevelClass.handle));
                    if (at !== undefined) {
                        const localLevel = new Il2Cpp.Object(args[at]);
                        const copy = isCopyOfSomeoneElse(localLevel, args[at + 1].isNull() ? null : new Il2Cpp.Object(args[at + 1]));
                        if (copy) {
                            const message = `Blocked uploading "${str(localLevel, "name") ?? copy.name}": it's a copy of ${copy.author || "someone else"}'s level "${copy.name}". Copies are for learning and practice.`;
                            log(`Levels: ${message}`);
                            blocked.unshift(message);
                            blocked.length = Math.min(blocked.length, 5);
                            const callback = new Il2Cpp.Object(args[at + callbackOffset]);
                            if (!callback.isNull()) callback.method("Invoke", 1).invoke(resultClass.field<Il2Cpp.ValueType>("NOT_THE_AUTHOR").value);
                            return;
                        }
                    }
                } catch (e) {
                    log(`Levels: upload check failed (${e}); letting the upload through`);
                }
                (original as any)(...args);
            },
            "void",
            types,
        ),
    );
    return true;
}

// ── copying ─────────────────────────────────────────────────────────────────────────────

/** Main thread. Saves the last loaded level as a share file in ExoMenu/levels. */
export function copyLastLevel(): CopiedLevel {
    if (!last) throw new Error("Play a custom level first (start it once), then come back and copy it.");
    const S = serializer();
    const localLevelClass = gameClass("NyanStudio.LocalLevel");
    const shareClass = gameClass("NyanStudio.LevelShareData");
    if (!S || !localLevelClass || !shareClass) throw new Error("this version of the game doesn't have the level code ExoMenu expects");

    const exception = Memory.alloc(Process.pointerSize);
    exception.writePointer(NULL);
    const levelData = S.method<Il2Cpp.Object>("LoadDownloadedLevelData", 3).invoke(Il2Cpp.string(last.id), last.version, exception);
    if (!exception.readPointer().isNull() || !levelData || levelData.isNull()) {
        throw new Error(`"${last.name}" isn't a downloaded custom level (official and editor levels can't be copied this way)`);
    }

    const me = myUser();
    const info = levelInfo(last.id);
    const authorId = info?.authorId ?? null;
    const levelName = info?.name || last.name || "Untitled level";
    const authorName = info?.author || last.author;
    const mine = (!!authorId && authorId === me.id) || (!authorId && !!me.name && me.name === authorName);
    const name = mine ? levelName : `Copy of ${levelName}`;
    const copyId = uuid();

    const localLevel = localLevelClass.alloc();
    localLevel.method(".ctor", 0).invoke();
    setStr(localLevel, "id", copyId);
    localLevel.field("version").value = 1;
    setStr(localLevel, "name", name);
    const date = Il2Cpp.corlib.class("System.DateTime").method<Il2Cpp.ValueType>("get_Now").invoke();
    localLevel.field("creationDate").value = date;
    localLevel.field("updateDate").value = date;
    for (const f of ["authorTime", "silverMedalTime", "goldMedalTime"]) {
        const v = levelData.tryField<number>(f)?.value;
        if (v !== undefined) localLevel.field(f).value = v;
    }
    localLevel.field("laps").value = levelData.field<number>("laps").value;
    localLevel.field("novaLevel").value = levelData.field<boolean>("novaLevel").value;
    localLevel.field("privateLevel").value = true;
    // Credit the original author, so the game itself also knows this isn't your level.
    setStr(localLevel, "authorId", authorId);
    setStr(localLevel, "authorDisplayName", authorName || null);
    setStr(levelData, "id", copyId);
    levelData.field("version").value = 1;

    const share = shareClass.alloc();
    share.method(".ctor", 0).invoke();
    share.field("localLevel").value = localLevel;
    share.field("levelData").value = levelData;

    // Same file type the game's own Share Level writes.
    const sample = (S.method<Il2Cpp.String>("GetShareFilePath", 1).invoke(Il2Cpp.string("x")).content ?? "x.exolevel").split("/").pop()!;
    const ext = sample.startsWith("x") && sample.length > 1 ? sample.slice(1) : ".exolevel";
    let file = `${safeName(name)}${ext}`;
    for (let i = 2; listFiles(dir).includes(file); i++) file = `${safeName(name)} ${i}${ext}`;
    const save = S.method<boolean>("Save", 3).overload("NyanStudio.LevelShareData", "System.String", "System.Exception&");
    const target = `${dir}/${file}`;
    const before = new Set(listFiles(dir));
    exception.writePointer(NULL);
    const ok = save.invoke(share, Il2Cpp.string(target), exception);
    log(`Levels: Save(${target}) → ${ok}${describe(exception) ? " " + describe(exception) : ""} (share files look like ${sample})`);
    if (!exists(target)) {
        // The game may write somewhere of its own (or add its own extension): find the file and move it here.
        const appeared = listFiles(dir).filter(n => !before.has(n));
        if (appeared.length) {
            file = appeared[0];
        } else {
            const gamePath = S.method<Il2Cpp.String>("GetShareFilePath", 1).invoke(Il2Cpp.string(safeName(name))).content ?? "";
            exception.writePointer(NULL);
            const ok2 = gamePath ? save.invoke(share, Il2Cpp.string(gamePath), exception) : false;
            log(`Levels: retry Save(${gamePath}) → ${ok2}${describe(exception) ? " " + describe(exception) : ""}`);
            if (!gamePath || !exists(gamePath)) throw new Error(`the game didn't write the level file (${describe(exception) || "no error given"}). Please send exomenu.log`);
            const out = new File(target, "wb");
            out.write(File.readAllBytes(gamePath));
            out.close();
        }
    }

    const copy: CopiedLevel = {
        file,
        name,
        sourceId: last.id,
        sourceVersion: last.version,
        author: authorName,
        authorId,
        mine,
        copyId,
        fingerprint: fingerprint(levelData),
        date: new Date().toISOString(),
    };
    host.saveCopies([copy, ...host.copies()]);
    log(`Levels: copied "${levelName}" (${last.id} v${last.version}) to ${file}${mine ? " (your own level)" : ""}`);
    return copy;
}

/** Main thread. Runs the editor's own Import Level on a copied file. */
export function openInEditor(file: string): void {
    if (!host.copies().some(c => c.file === file)) throw new Error("that copy isn't in the list anymore");
    const menuClass = gameClass("NyanStudio.EditorMenuUI");
    const resources = uclass("UnityEngine.CoreModule", "UnityEngine.Resources");
    if (!menuClass || !resources) throw new Error("the level editor wasn't found");
    const all = [...resources.method<Il2Cpp.Array<Il2Cpp.Object>>("FindObjectsOfTypeAll", 1).overload("System.Type").invoke(menuClass.type.object)];
    // Only menus that belong to an open editor (not prefabs or a closed editor).
    const live = all.filter(m => {
        try {
            const go = m.method<Il2Cpp.Object>("get_gameObject").invoke();
            const scene = go.method<Il2Cpp.ValueType>("get_scene").invoke();
            return scene.method<boolean>("IsValid").invoke();
        } catch {
            return false;
        }
    });
    const menu =
        live.find(m => {
            try {
                return m.method<Il2Cpp.Object>("get_gameObject").invoke().method<boolean>("get_activeInHierarchy").invoke();
            } catch {
                return false;
            }
        }) ?? live[0];
    if (!menu) throw new Error("Open the level editor first, then click Open in editor again.");
    menu.method("DoImportLevel", 1).invoke(Il2Cpp.string(`${dir}/${file}`));
    log(`Levels: imported ${file} into the editor`);
}

export function deleteCopy(file: string): void {
    host.saveCopies(host.copies().filter(c => c.file !== file));
    try {
        const unlink = new NativeFunction(Module.getGlobalExportByName("unlink"), "int", ["pointer"]);
        unlink(Memory.allocUtf8String(`${dir}/${file}`));
    } catch {}
}

export function levelsStatus() {
    const present = new Set(listFiles(dir));
    const info = last && (!last.name || !last.author) ? levelInfo(last.id) : null;
    return {
        last: last ? { ...last, name: last.name || info?.name || "Untitled level", author: last.author || info?.author || "" } : null,
        copies: host.copies().map(c => ({ ...c, missing: !present.has(c.file) })),
        guard: guardStatus,
        blocked,
        dir,
    };
}

export function startLevels(folder: string, h: LevelsHost, logger: Log): void {
    dir = folder;
    host = h;
    log = logger;
    ensureDir(dir);
    watchLevelLoads();
    const a = guardUpload("UploadLevel", 5);
    const b = guardUpload("UploadRankedLevel", 3);
    guardStatus = a && b ? "on" : a || b ? "partly on" : "off";
    log(`Levels: ready (upload guard ${guardStatus})`);
}
