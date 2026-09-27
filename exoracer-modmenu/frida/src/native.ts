// Tiny machine-code stubs that return a constant. Hooks built from these never enter JavaScript,
// so a game thread can't end up waiting on the agent's script thread (which froze the game in 0.3.0
// when JS hooks on per-frame getters met a scan running on the script thread).

const pages: NativePointer[] = [];
let cursor = 0;
const STUB_SIZE = 32;

function allocStub(): NativePointer {
    if (pages.length === 0 || cursor + STUB_SIZE > Process.pageSize) {
        pages.push(Memory.alloc(Process.pageSize));
        cursor = 0;
    }
    const at = pages[pages.length - 1].add(cursor);
    cursor += STUB_SIZE;
    return at;
}

/** Native code equivalent to `return value;` for the current architecture. */
export function constantStub(value: NativePointer): NativePointer {
    const stub = allocStub();
    Memory.patchCode(stub, STUB_SIZE, code => {
        if (Process.arch === "arm64") {
            const w = new Arm64Writer(code, { pc: stub });
            w.putLdrRegAddress("x0", value);
            w.putRet();
            w.flush();
        } else if (Process.arch === "x64") {
            const w = new X86Writer(code, { pc: stub });
            w.putMovRegAddress("rax", value);
            w.putRet();
            w.flush();
        } else {
            throw new Error(`unsupported architecture ${Process.arch}`);
        }
    });
    return stub;
}

const replaced = new Set<string>();

/** Makes `target` return `value` without running its body. Replaces any earlier stub on it. */
export function replaceWithConstant(target: NativePointer, value: NativePointer): void {
    revertTarget(target);
    Interceptor.replace(target, constantStub(value));
    replaced.add(target.toString());
    Interceptor.flush();
}

export function revertTarget(target: NativePointer): void {
    if (!replaced.delete(target.toString())) return;
    Interceptor.revert(target);
    Interceptor.flush();
}
