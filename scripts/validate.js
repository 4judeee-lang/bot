'use strict';

/**
 * Loads every command and checks it would actually work before the bot is
 * ever started: metadata present, no duplicate names or aliases, argument
 * specs valid, slash-command names legal, and Discord's limits respected.
 *
 * Run with `npm run check`.
 */

process.env.DATABASE_PATH = process.env.DATABASE_PATH || './data/validate.db';

const { Registry } = require('../src/lib/registry');
const { SETTINGS, CATEGORIES, coerce } = require('../src/lib/settingsSchema');
const { buildSlashCommands } = require('../src/lib/slash');

const VALID_ARG_TYPES = new Set([
  'string', 'rest', 'number', 'integer', 'boolean', 'duration',
  'user', 'member', 'role', 'channel', 'textchannel', 'voicechannel',
  'category', 'emoji', 'choice',
]);

const { PermissionsBitField } = require('discord.js');
const VALID_PERMISSIONS = new Set(Object.keys(PermissionsBitField.Flags));

const problems = [];
const warnings = [];

function fail(message) {
  problems.push(message);
}

function warn(message) {
  warnings.push(message);
}

/* ── commands ────────────────────────────────────────────────────────── */

let registry;
try {
  registry = new Registry().load();
} catch (error) {
  console.error('✗ Commands failed to load:\n');
  for (const problem of error.problems ?? [error.message]) console.error(`  • ${problem}`);
  process.exit(1);
}

for (const command of registry.all()) {
  const where = `${command.name}`;

  if (command.description.length > 100) fail(`${where}: description is longer than 100 characters (slash limit)`);
  if (!/^[a-z0-9 -]+$/.test(command.name)) fail(`${where}: name may only contain lowercase letters, numbers, spaces and dashes`);
  if (command.name.split(' ').length > 3) fail(`${where}: command names are limited to three words`);

  for (const permission of [...command.permissions, ...command.botPermissions]) {
    if (!VALID_PERMISSIONS.has(permission)) fail(`${where}: "${permission}" is not a Discord permission flag`);
  }

  let seenOptional = false;
  const seenArgs = new Set();
  for (const arg of command.args) {
    if (!arg.name) fail(`${where}: an argument is missing a name`);
    if (seenArgs.has(arg.name)) fail(`${where}: duplicate argument "${arg.name}"`);
    seenArgs.add(arg.name);

    if (!VALID_ARG_TYPES.has(arg.type)) fail(`${where}: argument "${arg.name}" has unknown type "${arg.type}"`);
    if (arg.type === 'choice' && !Array.isArray(arg.choices)) fail(`${where}: choice argument "${arg.name}" needs a choices array`);
    if (!/^[a-z0-9_]+$/.test(arg.name)) fail(`${where}: argument "${arg.name}" must be lowercase (slash requirement)`);
    if (!arg.description) warn(`${where}: argument "${arg.name}" has no description — it will read poorly in help`);

    if (arg.required && seenOptional) fail(`${where}: required argument "${arg.name}" comes after an optional one`);
    if (!arg.required) seenOptional = true;
  }

  if (command.args.some((arg) => arg.type === 'rest') && command.args.at(-1).type !== 'rest') {
    fail(`${where}: a "rest" argument must be the last one`);
  }

  if (!command.examples.length) warn(`${where}: no examples given`);
  for (const example of command.examples) {
    const base = example.split(' ').slice(0, command.words).join(' ').toLowerCase();
    if (base !== command.name && !command.aliases.includes(base.split(' ')[0])) {
      warn(`${where}: example "${example}" does not start with the command name`);
    }
  }
}

/* ── slash command payload ───────────────────────────────────────────── */

let slash = [];
try {
  slash = buildSlashCommands(registry);
} catch (error) {
  fail(`Slash command build failed: ${error.message}`);
}

if (slash.length > 100) fail(`${slash.length} top-level slash commands — Discord allows 100`);
for (const command of slash) {
  if (command.options?.length > 25) fail(`/${command.name}: more than 25 options or subcommands`);
  for (const option of command.options ?? []) {
    if (option.description?.length > 100) fail(`/${command.name} ${option.name}: description too long`);
  }
}

/* ── settings schema ─────────────────────────────────────────────────── */

for (const [key, meta] of Object.entries(SETTINGS)) {
  if (!meta.label) fail(`setting ${key}: missing label`);
  if (!meta.description) fail(`setting ${key}: missing description`);
  if (!CATEGORIES.includes(meta.category)) fail(`setting ${key}: category "${meta.category}" is not in CATEGORIES`);
  if (meta.type === 'select' && !meta.options?.length) fail(`setting ${key}: select needs options`);

  // The default must survive its own validator.
  if (meta.default !== null && meta.default !== undefined) {
    const result = coerce(key, meta.default);
    if (!result.ok) fail(`setting ${key}: default value is rejected by its own validator (${result.error})`);
  }
}

/* ── report ──────────────────────────────────────────────────────────── */

const categories = [...registry.categories.entries()]
  .map(([name, list]) => `${name} (${list.length})`)
  .sort()
  .join(', ');

console.log(`\nLoaded ${registry.size} commands: ${categories}`);
console.log(`Slash commands to register: ${slash.length}`);
console.log(`Settings defined: ${Object.keys(SETTINGS).length} across ${CATEGORIES.length} categories`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const warning of warnings.slice(0, 40)) console.log(`  ! ${warning}`);
  if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  • ${problem}`);
  process.exit(1);
}

console.log('\n✓ Everything checks out.\n');
