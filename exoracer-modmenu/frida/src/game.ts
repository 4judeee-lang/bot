import "frida-il2cpp-bridge";

// Shared lookups into Exoracer's code.

export function gameClass(name: string): Il2Cpp.Class | null {
    return Il2Cpp.domain.tryAssembly("Assembly-CSharp")?.image.tryClass(name) ?? null;
}

let cachedController: Il2Cpp.Object | null = null;

/** The live DataController singleton (holds your user, inventory and equipped cosmetics). */
export function dataController(): Il2Cpp.Object | null {
    if (cachedController) return cachedController;
    const klass = gameClass("NyanStudio.DataController");
    if (!klass) return null;
    cachedController = Il2Cpp.gc.choose(klass)[0] ?? null;
    return cachedController;
}

/** What you're really wearing, from a DataController getter such as "get_Skin". */
export function equipped(getter: string): string | null {
    try {
        const s = dataController()?.method<Il2Cpp.String>(getter).invoke();
        return s && !s.isNull() ? s.content : null;
    } catch {
        return null;
    }
}

export function readString(p: NativePointer): string | null {
    if (p.isNull()) return null;
    try {
        return new Il2Cpp.String(p).content;
    } catch {
        return null;
    }
}
