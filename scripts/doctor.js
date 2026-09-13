'use strict';

/**
 * One command that answers "why does my embed still look wrong".
 *
 * Everything here is read from disk and from the database — no Discord
 * connection — so it reports the truth about this copy of the bot regardless
 * of what a running process has in memory.
 *
 *   npm run doctor
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const line = (char = '─') => console.log(char.repeat(64));

console.log('');
line('━');
console.log(' VEX DOCTOR');
line('━');

/* ── 1. which copy of the code is this ──────────────────────────────── */

console.log('\n1. THIS COPY OF THE CODE');
console.log(`   folder     ${root}`);
console.log(`   node       ${process.version}`);

try {
  const commit = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim();
  const subject = execSync('git log -1 --pretty=%s', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim();
  console.log(`   commit     ${commit} — ${subject}`);
} catch {
  console.log('   commit     (not a git clone — this is a ZIP download)');
}

/* ── 2. are the fixes actually present in these files ───────────────── */

console.log('\n2. FIXES PRESENT IN THESE FILES');

const FIXES = [
  ['newlines survive a command argument', 'src/lib/arguments.js', 'tokens.source'],
  ['padding is not trimmed away', 'src/lib/variables.js', 'function trimOuter'],
  ['/emojiname aliases resolve', 'src/lib/variables.js', 'applyEmojiAliases'],
  ['{message:} works like {content:}', 'src/lib/variables.js', "case 'message':"],
  ['literal \\n becomes a line break', 'src/lib/variables.js', 'replace(/\\\\n/g'],
  ['buttons parse in any order', 'src/lib/variables.js', 'const urlAt ='],
];

let missing = 0;
for (const [label, file, marker] of FIXES) {
  let present = false;
  try {
    present = fs.readFileSync(path.join(root, file), 'utf8').includes(marker);
  } catch { /* file missing counts as absent */ }
  if (!present) missing += 1;
  console.log(`   ${present ? '✓' : '✗ MISSING'}  ${label}`);
}

if (missing) {
  console.log(`\n   ${missing} fix(es) are NOT in this folder. This copy of the code is out of date.`);
  console.log('   Run:  git pull  (then npm install), or download the newest ZIP.');
} else {
  console.log('\n   All fixes present. If the bot still behaves as before, it was not');
  console.log('   restarted — stop it with Control+C and run npm start again.');
}

/* ── 3. what is actually stored ─────────────────────────────────────── */

console.log('\n3. STORED TEMPLATES');

let store;
let variables;
try {
  store = require('../src/lib/db');
  variables = require('../src/lib/variables');
} catch (error) {
  console.log(`   Could not open the database: ${error.message}`);
  console.log('');
  process.exit(0);
}

const KEYS = ['welcome.message', 'goodbye.message', 'boost.message', 'levels.message'];
const rows = store.db
  .prepare(`SELECT guild_id, key, value FROM settings WHERE key IN (${KEYS.map(() => '?').join(', ')})`)
  .all(...KEYS);

if (!rows.length) {
  console.log('   Nothing saved yet for any server.');
  console.log('   Set one on the dashboard, or with `.welcome message <template>`.');
} else {
  for (const row of rows) {
    let template;
    try { template = JSON.parse(row.value); } catch { template = row.value; }
    const text = String(template);
    const lines = text.split('\n');

    console.log('');
    line();
    console.log(`   ${row.key} · server ${row.guild_id}`);
    console.log(`   stored as ${lines.length} line(s), ${text.length} characters`);
    line();
    lines.forEach((content, index) => console.log(`   ${String(index + 1).padStart(2)} │ ${content}`));

    const problems = [];
    if (lines.length === 1 && text.includes('-#')) {
      problems.push('FLATTENED — one line, but `-#` only works at the start of a line.');
      problems.push('   Save the template again now that the code is fixed, or use \\n between lines.');
    }
    const placeholders = text.match(/\b[A-Z][A-Z_]*_(?:LINK|ID)\b/g);
    if (placeholders) {
      problems.push(`PLACEHOLDERS — ${[...new Set(placeholders)].join(', ')} are not real values.`);
      problems.push('   Right-click each channel in Discord → Copy Link, and paste those in.');
    }
    const aliases = text.match(/\/[a-z0-9_]+/gi);
    if (aliases) {
      const names = [...new Set(aliases.map((a) => a.slice(1).replace(/x\d+$/, '')))];
      problems.push(`EMOJI ALIASES USED — ${names.map((n) => `/${n}`).join(', ')}`);
      problems.push('   Each needs a custom emoji of that exact name in your server, or it prints as text.');
    }

    if (problems.length) {
      console.log('');
      for (const problem of problems) console.log(`   !! ${problem}`);
    }
  }
}

console.log('');
line('━');
console.log(' Paste everything above when asking for help.');
line('━');
console.log('');
