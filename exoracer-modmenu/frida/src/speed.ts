import "frida-il2cpp-bridge";
import { gameClass } from "./game.js";
import { replaceWithConstant, revertTarget } from "./native.js";
import { sharedWith } from "./scanner.js";
import { uclass } from "./unity.js";

// Speed multiplier for practice (like Geode's speedhack): Unity's Time.timeScale.
//
// Exoracer sends runs to leaderboards, ranked and live races, so the first time the speed leaves
// 1× every path that could carry a run or live movement off this Mac is replaced with a no-op, and
// those blocks stay until the game restarts (a slowed run can't be sent later either). It's
// all-or-nothing: if any path can't be blocked safely, the speed stays at 1×.

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

export const MIN_SPEED = 0.1;
export const MAX_SPEED = 4;

let log: Log = () => {};
let multiplier = 1;
let uploadsBlocked = false;
let message = "Normal speed.";
let timer: ReturnType<typeof setInterval> | null = null;

const time = () => uclass("UnityEngine.CoreModule", "UnityEngine.Time");

function target(className: string, methodName: string): { address: NativePointer | null; problem?: string } {
    const method = gameClass(className)?.tryMethod(methodName);
    const label = `${className.replace("NyanStudio.", "")}.${methodName}`;
    if (!method || method.virtualAddress.isNull()) return { address: null, problem: `${label} wasn't found` };
    const shared = sharedWith(method);
    if (shared.length > 0) return { address: null, problem: `${label} shares code with ${shared.slice(0, 2).join(", ")}` };
    return { address: method.virtualAddress };
}

/** Main thread. Null when every upload path is blocked; otherwise why it couldn't be done. */
function blockUploads(): string | null {
    if (uploadsBlocked) return null;
    const found: NativePointer[] = [];
    for (const [cls, name] of UPLOADS) {
        const t = target(cls, name);
        if (!t.address) return `Can't block run uploads safely (${t.problem}), so the speed stays at 1×.`;
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
        return `Couldn't block run uploads (${(e as Error).message}), so the speed stays at 1×.`;
    }
    uploadsBlocked = true;
    log(`Speed: blocked ${found.length} run/race upload paths until the game restarts`);
    return null;
}

function apply(): void {
    const t = time();
    if (!t) return;
    const current = t.method<number>("get_timeScale").invoke();
    if (current === 0) return; // the game is paused; leave it
    if (Math.abs(current - multiplier) > 1e-4) t.method("set_timeScale").invoke(multiplier);
}

/** Sets the speed multiplier (1 = normal). */
export async function setSpeed(value: number): Promise<void> {
    const next = Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(value) || 1)) * 100) / 100;
    const problem = await Il2Cpp.perform(() => {
        if (Math.abs(next - 1) > 1e-4) {
            const p = blockUploads();
            if (p) return p;
        }
        multiplier = next;
        apply();
        return null;
    }, "main");
    if (problem) {
        message = problem;
        log(`Speed: ${problem}`);
        throw new Error(problem);
    }
    if (timer) clearInterval(timer);
    timer = null;
    if (multiplier !== 1) {
        // Levels, menus and pauses set the time scale themselves; keep ours applied.
        timer = setInterval(() => Il2Cpp.perform(apply, "main").catch(() => {}), 500);
        message = `${multiplier}× speed. Run uploads and live races are off until you restart the game.`;
    } else {
        message = uploadsBlocked ? "Normal speed. Run uploads stay off until you restart the game." : "Normal speed.";
    }
    log(`Speed: ${multiplier}×`);
}

export function speedStatus() {
    return { multiplier, uploadsBlocked, message, min: MIN_SPEED, max: MAX_SPEED };
}

export function startSpeed(logger: Log): void {
    log = logger;
}
