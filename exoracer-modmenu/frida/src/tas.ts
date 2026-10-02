import "frida-il2cpp-bridge";
import { gameClass } from "./game.js";
import { replaceWithConstant, revertTarget } from "./native.js";
import { sharedWith } from "./scanner.js";

// Practice TAS, built on Exoracer's own Autorun editor (the level editor's input scripting:
// steps of N frames with jump / left / right, load-from-run, checkpoints, frame stepping).
//
// Turning TAS mode on first blocks everything that could carry a TAS run or TAS movement off this
// Mac: run and replay uploads, level uploads, race/practice/cup run messages, and the live position
// snapshots other players see. If any of those can't be blocked safely, TAS mode stays off. The
// blocks then stay in place until the game restarts, so a run made with the TAS can't be sent later
// either. Only after that is GameScreen.CanUseAutorun() made to say yes.

type Log = (message: string) => void;

const UPLOADS: [string, string][] = [
    ["NyanStudio.RunService", "AddRun"],
    ["NyanStudio.RunService", "AddTeamSurvivalReplay"],
    ["NyanStudio.RunService", "AddBotRun"],
    ["NyanStudio.LevelService", "UploadLevel"],
    ["NyanStudio.LevelService", "UploadRankedLevel"],
    ["NyanStudio.GameScreen", "SendPracticeRunMessage"],
    ["NyanStudio.GameScreen", "SendRaceRunMessage"],
    ["NyanStudio.GameScreen", "SendTeamRaceRunMessage"],
    ["NyanStudio.GameScreen", "SendRoundsRaceRunMessage"],
    ["NyanStudio.GameScreen", "SendCupQualificationRunMessage"],
    ["NyanStudio.GameScreen", "SendCupRoundRunMessage"],
    ["NyanStudio.GameScreen", "UploadBotRun"],
    ["NyanStudio.GameScreen", "AddSnapshot"], // live position updates other players see
];

let uploadsBlocked = false;
let unlockTarget: NativePointer | null = null;
let message = "Off.";

function target(className: string, methodName: string): { address: NativePointer | null; problem?: string } {
    const method = gameClass(className)?.tryMethod(methodName);
    const label = `${className.replace("NyanStudio.", "")}.${methodName}`;
    if (!method || method.virtualAddress.isNull()) return { address: null, problem: `${label} not found` };
    const shared = sharedWith(method);
    if (shared.length > 0) return { address: null, problem: `${label} shares code with ${shared.slice(0, 2).join(", ")}` };
    return { address: method.virtualAddress };
}

/** All-or-nothing: either every upload path is blocked, or none is and the reason is returned. */
function blockUploads(log: Log): string | null {
    if (uploadsBlocked) return null;
    const found: NativePointer[] = [];
    for (const [cls, name] of UPLOADS) {
        const t = target(cls, name);
        if (!t.address) return `Can't block uploads safely (${t.problem}), so TAS mode stays off.`;
        found.push(t.address);
    }
    const done: NativePointer[] = [];
    try {
        for (const address of found) {
            replaceWithConstant(address, ptr(0)); // a no-op: nothing is sent
            done.push(address);
        }
    } catch (e) {
        for (const address of done) revertTarget(address);
        return `Couldn't block uploads (${(e as Error).message}), so TAS mode stays off.`;
    }
    uploadsBlocked = true;
    log(`TAS: blocked ${found.length} upload paths until the game restarts`);
    return null;
}

let cachedScreen: Il2Cpp.Object | null = null;
function gameScreen(): Il2Cpp.Object | null {
    if (cachedScreen) return cachedScreen;
    const klass = gameClass("NyanStudio.GameScreen");
    cachedScreen = klass ? (Il2Cpp.gc.choose(klass)[0] ?? null) : null;
    return cachedScreen;
}

function instance(className: string): Il2Cpp.Object | null {
    const klass = gameClass(className);
    return klass ? (Il2Cpp.gc.choose(klass)[0] ?? null) : null;
}

export function tasEnabled(): boolean {
    return unlockTarget !== null;
}

/** Runs on Unity's main thread (it touches game objects). */
export function setTas(on: boolean, log: Log): string {
    if (on) {
        if (unlockTarget) return message;
        const problem = blockUploads(log);
        if (problem) {
            log(`TAS: ${problem}`);
            return (message = problem);
        }
        const unlock = target("NyanStudio.GameScreen", "CanUseAutorun");
        if (!unlock.address) {
            log(`TAS: ${unlock.problem}`);
            return (message = `Can't unlock the Autorun editor (${unlock.problem}). Uploads stay blocked until you restart the game.`);
        }
        replaceWithConstant(unlock.address, ptr(1));
        unlockTarget = unlock.address;
        log("TAS: on, Autorun editor unlocked");
        return (message = "On. Nothing you do is uploaded or shown to other players until you restart the game.");
    }
    if (unlockTarget) {
        try {
            gameScreen()?.method("UnloadAutorun").invoke();
        } catch {}
        revertTarget(unlockTarget);
        unlockTarget = null;
    }
    log("TAS: off (uploads stay blocked until the game restarts)");
    return (message = uploadsBlocked ? "Off. Uploads stay blocked until you restart the game." : "Off.");
}

/** One TAS control action, on Unity's main thread. */
export function tasAction(action: string, value: number, log: Log): void {
    if (!unlockTarget) throw new Error("Turn on TAS mode first.");
    const gs = gameScreen();
    if (!gs) throw new Error("Start a level first.");
    switch (action) {
        case "open": {
            const list = instance("NyanStudio.AutorunListUI");
            if (!list) throw new Error("The Autorun editor isn't loaded; start a level first.");
            list.method("Open").invoke();
            break;
        }
        case "loadFromRun": {
            const list = instance("NyanStudio.AutorunListUI");
            if (!list) throw new Error("The Autorun editor isn't loaded; start a level first.");
            list.method("OnClickLoadFromRun").invoke();
            break;
        }
        case "prev":
            gs.method("AutorunPrevFrame").invoke();
            break;
        case "next":
            gs.method("AutorunNextFrame").invoke();
            break;
        case "seek":
            gs.method("AutorunSeek").invoke(Math.max(0, Math.round(value)));
            break;
        case "speed":
            gs.method("set_AutorunTimeScale").invoke(Math.min(4, Math.max(0.05, value)));
            break;
        case "unload":
            gs.method("UnloadAutorun").invoke();
            break;
        default:
            throw new Error(`unknown TAS action ${action}`);
    }
    log(`TAS: ${action}${action === "seek" || action === "speed" ? ` ${value}` : ""}`);
}

export interface TasStatus {
    on: boolean;
    uploadsBlocked: boolean;
    message: string;
    inLevel: boolean;
    online?: boolean;
    loaded?: boolean;
    playing?: boolean;
    frame?: number;
    step?: number;
    steps?: number;
    speed?: number;
    gameFrame?: number;
    jump?: boolean;
    direction?: number;
}

/** Read-only snapshot for the menu. */
export function tasStatus(): TasStatus {
    const base: TasStatus = { on: tasEnabled(), uploadsBlocked, message, inLevel: false };
    const gs = gameScreen();
    if (!gs) return base;
    try {
        const autorun = gs.method<Il2Cpp.Object>("get_Autorun").invoke();
        const loaded = !autorun.isNull();
        const game = gs.field<Il2Cpp.Object>("game").value;
        const input = game.isNull() ? null : game.field<Il2Cpp.Object>("inputState").value;
        return {
            ...base,
            inLevel: true,
            online: gs.method<boolean>("IsOnline").invoke(),
            loaded,
            playing: gs.field<boolean>("AutorunPlaying").value,
            frame: gs.field<number>("autorunFrame").value,
            step: gs.field<number>("autorunIndex").value,
            steps: loaded ? autorun.field<Il2Cpp.Object>("steps").value.method<number>("get_Count").invoke() : 0,
            speed: gs.method<number>("get_AutorunTimeScale").invoke(),
            gameFrame: game.isNull() ? undefined : game.field<number>("frame").value,
            jump: input && !input.isNull() ? input.field<boolean>("jump").value : undefined,
            direction: input && !input.isNull() ? input.field<number>("direction").value : undefined,
        };
    } catch {
        cachedScreen = null; // the level was probably closed; look it up again next time
        return base;
    }
}
