'use strict';

/**
 * Writes docs/COMMANDS.md from the command definitions themselves, so the
 * documentation can never drift from the code. Run with `npm run docs`.
 */

process.env.DATABASE_PATH = process.env.DATABASE_PATH || './data/docs.db';

const fs = require('node:fs');
const path = require('node:path');
const { Registry } = require('../src/lib/registry');
const { SETTINGS, CATEGORIES } = require('../src/lib/settingsSchema');
const { VARIABLES } = require('../src/lib/variables');
const config = require('../src/config');

const registry = new Registry().load();
const prefix = config.defaultPrefix;

function anchor(text) {
  return text.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
}

const lines = [];

lines.push('# Command guide');
lines.push('');
lines.push(`Every command, what it does, and how to use it. **${registry.size}** commands in total.`);
lines.push('');
lines.push(`The default prefix is \`${prefix}\`; change it with \`${prefix}prefix <new>\`. Mentioning the bot always works too.`);
lines.push('');
lines.push('In the usage lines, `<angle brackets>` are required and `[square brackets]` are optional.');
lines.push('');
lines.push('## Contents');
lines.push('');
for (const category of [...registry.categories.keys()].sort()) {
  lines.push(`- [${category}](#${anchor(category)}) — ${registry.categories.get(category).length} commands`);
}
lines.push('- [Settings reference](#settings-reference)');
lines.push('- [Message variables](#message-variables)');
lines.push('');

for (const category of [...registry.categories.keys()].sort()) {
  lines.push(`## ${category}`);
  lines.push('');

  for (const command of registry.categories.get(category)) {
    lines.push(`### \`${prefix}${command.name}\``);
    lines.push('');
    lines.push(command.details || command.description);
    lines.push('');
    lines.push(`**Usage:** \`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\``);
    lines.push('');

    if (command.aliases.length) {
      lines.push(`**Aliases:** ${command.aliases.map((alias) => `\`${prefix}${alias}\``).join(', ')}`);
      lines.push('');
    }

    if (command.args.length) {
      lines.push('| Argument | Required | What it is |');
      lines.push('| --- | --- | --- |');
      for (const arg of command.args) {
        lines.push(`| \`${arg.name}\` | ${arg.required ? 'yes' : 'no'} | ${arg.description ?? arg.type} |`);
      }
      lines.push('');
    }

    if (command.examples.length) {
      lines.push('**Examples:**');
      lines.push('');
      lines.push('```');
      for (const example of command.examples) lines.push(`${prefix}${example}`);
      lines.push('```');
      lines.push('');
    }

    const requirements = [];
    if (command.permissions.length) requirements.push(`You need: ${command.permissions.map((p) => `\`${p}\``).join(', ')}`);
    if (command.botPermissions.length) requirements.push(`Bot needs: ${command.botPermissions.map((p) => `\`${p}\``).join(', ')}`);
    if (command.ownerOnly) requirements.push('Bot owners only');
    if (command.serverOwnerOnly) requirements.push('Server owner only');
    if (requirements.length) {
      lines.push(`> ${requirements.join(' · ')}`);
      lines.push('');
    }
  }
}

lines.push('## Settings reference');
lines.push('');
lines.push(`Change any of these with \`${prefix}set <key> <value>\`, or from the dashboard where each one is a form field.`);
lines.push('');

for (const category of CATEGORIES) {
  const keys = Object.keys(SETTINGS).filter((key) => SETTINGS[key].category === category);
  if (!keys.length) continue;

  lines.push(`### ${category}`);
  lines.push('');
  lines.push('| Key | Type | Default | What it does |');
  lines.push('| --- | --- | --- | --- |');
  for (const key of keys) {
    const meta = SETTINGS[key];
    const value =
      meta.default === null || meta.default === '' || (Array.isArray(meta.default) && !meta.default.length)
        ? '—'
        : `\`${JSON.stringify(meta.default).replace(/\|/g, '\\|').slice(0, 60)}\``;
    lines.push(`| \`${key}\` | ${meta.type} | ${value} | ${meta.description.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
}

lines.push('## Message variables');
lines.push('');
lines.push('These work in welcome, leave, boost, level-up, autoresponder, ticket and sticky messages.');
lines.push('');
lines.push('| Variable | Value |');
lines.push('| --- | --- |');
for (const variable of VARIABLES) lines.push(`| \`{${variable.name}}\` | ${variable.description} |`);
lines.push('');
lines.push('### Embed scripts');
lines.push('');
lines.push('Start a message with `{embed}` and separate parts with `$v`:');
lines.push('');
lines.push('```');
lines.push('{embed}{color: #8b5cf6}$v{title: Welcome!}$v{description: Hi {user.mention}}$v{thumbnail: {user.avatar}}');
lines.push('```');
lines.push('');
lines.push('Available parts: `content` `color` `title` `url` `description` `thumbnail` `image` `author` `footer` `field` `timestamp` `button`.');
lines.push('');
lines.push('`author`, `footer` and `field` take several values separated by `&&`:');
lines.push('');
lines.push('```');
lines.push('{footer: Some text && https://example.com/icon.png}');
lines.push('{field: Name && Value && true}');
lines.push('```');
lines.push('');

const target = path.join(__dirname, '..', 'docs', 'COMMANDS.md');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${lines.join('\n')}\n`);

console.log(`Wrote ${target} — ${registry.size} commands, ${Object.keys(SETTINGS).length} settings.`);
