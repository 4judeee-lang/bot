import "frida-il2cpp-bridge";

// Crash shield for every call ExoMenu makes into the game.
//
// frida-il2cpp-bridge calls a C# method's machine code directly. If that method throws (a
// NullReferenceException in the game's code, say), the C++ exception unwinds into Frida's frames,
// which it can't cross, and the whole game aborts. Here every invoke goes through
// il2cpp_runtime_invoke instead: the runtime's own entry point, which catches the exception and
// hands it back. We turn it into a normal JS error, so a failing call becomes a log line.
//
// Methods declared on structs keep the bridge's own path (their `this` is laid out differently);
// ExoMenu barely calls those.

interface Plan {
    params: Il2Cpp.Type[];
    ret: Il2Cpp.Type;
    retVoid: boolean;
    retValue: boolean; // value type (primitive, enum or struct): comes back boxed
    retSize: number;
}

let installed = false;

export function installSafeCalls(log: (m: string) => void): void {
    if (installed) return;
    installed = true;
    const address = Il2Cpp.module.findExportByName("il2cpp_runtime_invoke");
    if (!address) return log("Safe calls: il2cpp_runtime_invoke not found; game calls are unguarded");
    const runtimeInvoke = new NativeFunction(address, "pointer", ["pointer", "pointer", "pointer", "pointer"]);
    const proto = Il2Cpp.Method.prototype as any;
    const original = proto.invokeRaw as (this: Il2Cpp.Method, instance: NativePointer, ...p: unknown[]) => unknown;
    const plans = new Map<string, Plan | null>();
    const VOID = Il2Cpp.Type.Enum.VOID;

    function planFor(m: Il2Cpp.Method): Plan | null {
        const key = m.handle.toString();
        if (plans.has(key)) return plans.get(key)!;
        let plan: Plan | null = null;
        try {
            if (!m.class.isValueType) {
                const params = m.parameters.map(p => p.type);
                if (!params.some(t => t.isByReference)) {
                    const ret = m.returnType;
                    const retVoid = ret.enumValue === VOID;
                    const retValue = !retVoid && ret.class.isValueType;
                    plan = { params, ret, retVoid, retValue, retSize: retValue ? ret.class.valueTypeSize : 0 };
                }
            }
        } catch {
            plan = null;
        }
        plans.set(key, plan);
        return plan;
    }

    function argument(value: unknown, type: Il2Cpp.Type): NativePointer {
        if (!type.class.isValueType) {
            if (value === null || value === undefined) return NULL;
            if (value instanceof NativePointer) return value;
            if (typeof value === "object" && value !== null && "handle" in value) return (value as { handle: NativePointer }).handle;
            throw new Error("unsupported reference argument");
        }
        // Value types are passed as a pointer to their raw data.
        if (value instanceof Il2Cpp.ValueType) return value.handle;
        if (value instanceof Il2Cpp.Object) return value.handle.add(Il2Cpp.Object.headerSize); // boxed
        const size = Math.max(8, type.class.valueTypeSize);
        const slot = Memory.alloc(size);
        if (type.class.isEnum) (Il2Cpp as any).write(slot, value, type.class.field("value__").type);
        else (Il2Cpp as any).write(slot, value, type);
        return slot;
    }

    function describe(exception: NativePointer): string {
        try {
            const obj = new Il2Cpp.Object(exception);
            const message = obj.tryMethod<Il2Cpp.String>("get_Message")?.invoke();
            return `${obj.class.type.name}: ${message && !message.isNull() ? message.content : ""}`;
        } catch {
            return "a C# exception";
        }
    }

    proto.invokeRaw = function (this: Il2Cpp.Method, instance: NativePointer, ...parameters: unknown[]): unknown {
        const plan = planFor(this);
        if (!plan || parameters.length !== plan.params.length) return original.call(this, instance, ...parameters);
        // `args` and `slots` stay referenced until after the call, so their memory can't be freed early.
        const args = Memory.alloc(Math.max(1, plan.params.length) * Process.pointerSize);
        let slots: NativePointer[];
        try {
            slots = plan.params.map((t, i) => argument(parameters[i], t));
        } catch {
            return original.call(this, instance, ...parameters);
        }
        slots.forEach((p, i) => args.add(i * Process.pointerSize).writePointer(p));
        const exception = Memory.alloc(Process.pointerSize);
        exception.writePointer(NULL);
        const result = runtimeInvoke(this.handle, instance ?? NULL, args, exception) as NativePointer;
        void slots.length;
        const thrown = exception.readPointer();
        if (!thrown.isNull()) throw new Error(`${this.class.type.name}.${this.name} threw ${describe(thrown)}`);
        if (plan.retVoid) return undefined;
        if (plan.retValue) {
            if (result.isNull()) return (Il2Cpp as any).fromFridaValue(0 as any, plan.ret);
            const data = result.add(Il2Cpp.Object.headerSize);
            if (plan.ret.isPrimitive) return (Il2Cpp as any).read(data, plan.ret);
            const copy = Memory.alloc(Math.max(8, plan.retSize)); // the box may be collected later
            Memory.copy(copy, data, plan.retSize);
            return new Il2Cpp.ValueType(copy, plan.ret);
        }
        return (Il2Cpp as any).fromFridaValue(result, plan.ret);
    };
    log("Safe calls: game errors are caught instead of crashing the game");
}
