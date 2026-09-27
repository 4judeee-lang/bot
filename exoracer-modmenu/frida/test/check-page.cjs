// Fails the build if the menu page's inline script doesn't parse (an unescaped quote in ui.ts breaks the whole menu).
const fs = require("fs");
const ts = require("typescript");
const out = ts.transpileModule(fs.readFileSync(__dirname + "/../src/ui.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("exports", "module", out)(mod.exports, mod);
const script = mod.exports.PAGE.split("<script>")[1].split("</script>")[0];
new Function(script);
console.log("menu page script parses");
