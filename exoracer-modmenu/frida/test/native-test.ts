// Checks the constant stubs: replace a real function, call it, revert it.
import { constantStub, replaceWithConstant, revertTarget } from "../src/native.js";
const direct = new NativeFunction(constantStub(ptr(42)), "int", []);
const getpid = Process.getModuleByName("libc.so.6").getExportByName("getpid");
const call = new NativeFunction(getpid, "int", []);
const real = call();
replaceWithConstant(getpid, ptr(7));
const replaced = call();
revertTarget(getpid);
send({ arch: Process.arch, direct: direct(), real, replaced, reverted: call() === real });
