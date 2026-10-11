#!/usr/bin/env node
// Bundles the Rojo source tree + the engine mock into one Luau file that the
// Luau CLI can run headlessly:  node tools/bundle.js out.luau [run-script.luau]
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const project = JSON.parse(fs.readFileSync(path.join(root, 'default.project.json'), 'utf8'));
const out = process.argv[2] || path.join(root, 'tools', 'out', 'bundle.luau');
const runScript = process.argv[3] || path.join(root, 'tools', 'run_build.luau');

const modules = []; // [instancePath, file]
function walk(node, instPath) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    const p = instPath ? `${instPath}/${key}` : key;
    if (child.$path) addPath(path.join(root, child.$path), p);
    walk(child, p);
  }
}
function addPath(fsPath, instPath) {
  const st = fs.statSync(fsPath);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(fsPath).sort()) {
      const full = path.join(fsPath, f);
      if (fs.statSync(full).isDirectory()) addPath(full, `${instPath}/${f}`);
      else if (f === 'init.luau') modules.unshift([instPath, full]);
      else if (f.endsWith('.luau') && !f.includes('.client.') && !f.includes('.server.')) modules.push([`${instPath}/${f.replace(/\.luau$/, '')}`, full]);
    }
  } else if (fsPath.endsWith('.luau') && !fsPath.includes('.client.') && !fsPath.includes('.server.')) {
    modules.push([instPath, fsPath]);
  }
}
walk(project.tree, '');
// init modules must register before their children so the folder->module conversion is cheap
modules.sort((a, b) => a[0].split('/').length - b[0].split('/').length);

let src = '';
src += 'local __MOCK = (function()\n' + fs.readFileSync(path.join(root, 'tools/mock/roblox.luau'), 'utf8') + '\nend)()\n';
src += 'do\n' + fs.readFileSync(path.join(root, 'tools/mock/harness.luau'), 'utf8') + '\nend\n';
for (const [inst, file] of modules) {
  const body = fs.readFileSync(file, 'utf8');
  src += `__register(${JSON.stringify(inst)}, function(script)\n${body}\nend)\n`;
}
src += fs.readFileSync(runScript, 'utf8');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, src);
console.error(`bundled ${modules.length} modules -> ${out}`);
