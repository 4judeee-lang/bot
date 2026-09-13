'use strict';

/**
 * Print the message templates this bot has actually stored, straight from the
 * database — no Discord connection, and independent of whatever the running
 * bot has in memory.
 *
 * When a welcome embed comes out wrong, this answers the only question that
 * matters first: is the template stored correctly and rendering wrong, or was
 * it already mangled before it was saved?
 *
 *   node scripts/check-template.js
 */

const store = require('../src/lib/db');
const variables = require('../src/lib/variables');

const KINDS = ['welcome.message', 'goodbye.message', 'boost.message', 'levels.message'];

const rows = store.db
  .prepare(`SELECT guild_id, key, value FROM settings WHERE key IN (${KINDS.map(() => '?').join(', ')})`)
  .all(...KINDS);

if (!rows.length) {
  console.log('Nothing stored yet — no template has been saved for any server.');
  console.log('Set one with `.welcome message <template>` or on the dashboard, then run this again.');
  process.exit(0);
}

for (const row of rows) {
  let template;
  try {
    template = JSON.parse(row.value);
  } catch {
    template = row.value;
  }

  const lines = String(template).split('\n');
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`server ${row.guild_id} · ${row.key}`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`stored as ${lines.length} line(s), ${String(template).length} characters\n`);

  lines.forEach((line, index) => console.log(`  ${String(index + 1).padStart(2)} │ ${line}`));

  // The two mistakes that make a template look broken rather than fail loudly.
  const problems = [];
  if (lines.length === 1 && String(template).includes('-#')) {
    problems.push(
      'FLATTENED — this is one line but uses `-#`, which only works at the start of a line.\n'
      + '     Save the template again; the stored copy is the mangled one.',
    );
  }
  const placeholders = String(template).match(/\b[A-Z][A-Z_]*_(?:LINK|ID)\b/g);
  if (placeholders) {
    problems.push(`PLACEHOLDERS LEFT — ${[...new Set(placeholders)].join(', ')} are not real values.`);
  }

  if (problems.length) {
    console.log('');
    for (const problem of problems) console.log(`  !! ${problem}`);
  }

  // Show what Discord would actually be handed.
  const fake = {
    guild: { name: 'Your Server', id: row.guild_id, memberCount: 100, iconURL: () => 'https://example.invalid/i.png' },
    user: { id: '1', username: 'newmember', toString: () => '@newmember', displayAvatarURL: () => 'https://example.invalid/a.png' },
  };
  const payload = variables.render(template, fake);
  console.log('\n  renders to:');
  if (payload.content) console.log(`    above embed: ${payload.content}`);
  const embed = payload.embeds?.[0]?.data;
  if (embed?.description) {
    console.log('    description:');
    for (const line of embed.description.split('\n')) console.log(`      ${line}`);
  } else if (!embed) {
    console.log('    (plain text, no embed)');
  }
}

console.log('');
