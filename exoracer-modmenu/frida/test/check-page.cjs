// Fails the build if the menu page's inline script doesn't parse (an unescaped quote in ui.ts breaks the whole menu).
const fs = require("fs");
const ts = require("typescript");
// A backtick or dollar-brace inside the page ends or splices the template literal it lives in.
const source = fs.readFileSync(__dirname + "/../src/ui.ts", "utf8");
const body = source.slice(source.indexOf("export const PAGE = `") + "export const PAGE = `".length, source.lastIndexOf("`;"));
const bad = body.split("\n").map((l, i) => [l, i]).filter(([l]) => l.includes("`") || l.includes("${"));
if (bad.length) {
    for (const [l, i] of bad) console.error(`ui.ts page line ${i + 1}: backtick or dollar-brace: ${l.trim()}`);
    process.exit(1);
}
const out = ts.transpileModule(fs.readFileSync(__dirname + "/../src/ui.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("exports", "module", out)(mod.exports, mod);
const script = mod.exports.PAGE.split("<script>")[1].split("</script>")[0];
new Function(script);
console.log("menu page script parses");
