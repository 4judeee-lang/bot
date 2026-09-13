'use strict';

/**
 * Exercises the logic that does not need a Discord connection: argument
 * parsing, the XP curve, template rendering, settings validation, the
 * economy maths and command resolution.
 *
 * Run with `npm test`.
 */

process.env.DATABASE_PATH = './data/selftest.db';

const fs = require('node:fs');
const assert = require('node:assert/strict');

// Start from a clean database every run.
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(`./data/selftest.db${suffix}`, { force: true });
}

const results = [];
let failures = 0;

function test(name, fn) {
  try {
    fn();
    results.push(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    results.push(`  ✗ ${name}\n      ${error.message.split('\n')[0]}`);
  }
}

/**
 * Async checks are queued rather than fired immediately: several of them
 * share state (cooldowns, guild settings), so they must run one at a time
 * and in the order they were written.
 */
const queue = [];

function testAsync(name, fn) {
  const slot = results.length;
  results.push(`  … ${name}`);
  queue.push(async () => {
    try {
      await fn();
      results[slot] = `  ✓ ${name}`;
    } catch (error) {
      failures += 1;
      results[slot] = `  ✗ ${name}\n      ${error.message.split('\n')[0]}`;
    }
  });
}

function group(name) {
  results.push(`\n${name}`);
}

/* ── util ────────────────────────────────────────────────────────────── */

const util = require('../src/lib/util');

group('util');

test('parseDuration handles single units', () => {
  assert.equal(util.parseDuration('10s'), 10);
  assert.equal(util.parseDuration('5m'), 300);
  assert.equal(util.parseDuration('2h'), 7200);
  assert.equal(util.parseDuration('7d'), 604800);
});

test('parseDuration handles compound and spaced input', () => {
  assert.equal(util.parseDuration('1h30m'), 5400);
  assert.equal(util.parseDuration('2 days'), 172800);
  assert.equal(util.parseDuration('1d 12h'), 129600);
});

test('parseDuration rejects non-durations', () => {
  assert.equal(util.parseDuration('hello'), null);
  assert.equal(util.parseDuration('10'), null, 'a bare number is not a duration');
  assert.equal(util.parseDuration(''), null);
  assert.equal(util.parseDuration('10x'), null, 'unknown unit');
});

test('formatDuration reads naturally', () => {
  assert.equal(util.formatDuration(60), '1 minute');
  assert.equal(util.formatDuration(3661), '1 hour, 1 minute');
  assert.equal(util.formatDuration(0), '0 seconds');
  assert.equal(util.formatDuration(90, { short: true }), '1m 30s');
});

test('formatTimestamp pads correctly', () => {
  assert.equal(util.formatTimestamp(65), '1:05');
  assert.equal(util.formatTimestamp(3725), '1:02:05');
});

test('resolveColor accepts both hex forms', () => {
  assert.equal(util.resolveColor('#ff0000'), 0xff0000);
  assert.equal(util.resolveColor('00ff00'), 0x00ff00);
  assert.equal(util.resolveColor(null, 0x123456), 0x123456);
});

test('progressBar clamps out-of-range input', () => {
  assert.equal(util.progressBar(0, 10, 10), '░'.repeat(10));
  assert.equal(util.progressBar(10, 10, 10), '█'.repeat(10));
  assert.equal(util.progressBar(50, 10, 10), '█'.repeat(10), 'over 100% stays full');
  assert.equal(util.progressBar(5, 0, 10), '░'.repeat(10), 'no divide-by-zero');
});

/* ── levels ──────────────────────────────────────────────────────────── */

const levels = require('../src/modules/levels');

group('levels');

test('the XP curve is consistent in both directions', () => {
  for (const level of [0, 1, 5, 20, 60]) {
    const total = levels.totalXpForLevel(level);
    assert.equal(levels.levelFromXp(total).level, level, `level ${level} round-trips`);
  }
});

test('one XP short of a level does not level up', () => {
  const total = levels.totalXpForLevel(10);
  assert.equal(levels.levelFromXp(total - 1).level, 9);
});

test('progress within a level is reported correctly', () => {
  const base = levels.totalXpForLevel(5);
  const state = levels.levelFromXp(base + 40);
  assert.equal(state.level, 5);
  assert.equal(state.into, 40);
  assert.equal(state.needed, levels.xpForLevel(5));
});

test('XP can be added and read back', () => {
  const result = levels.addXp('guild-test', 'user-test', levels.totalXpForLevel(3));
  assert.equal(result.after, 3);
  assert.equal(result.levelledUp, true);
  assert.equal(levels.getUser('guild-test', 'user-test').level, 3);
});

/* ── template variables ──────────────────────────────────────────────── */

const variables = require('../src/lib/variables');

group('message templates');

const fakeContext = {
  user: {
    id: '111',
    username: 'ada',
    tag: 'ada#0001',
    displayAvatarURL: () => 'https://cdn.example/avatar.png',
    createdTimestamp: 1600000000000,
  },
  guild: { id: '222', name: 'Test Server', memberCount: 42, iconURL: () => 'https://cdn.example/icon.png', premiumSubscriptionCount: 3, premiumTier: 1 },
  channel: { id: '333', name: 'general' },
};

test('plain text substitutes variables', () => {
  const result = variables.render('Hi {user.mention}, welcome to {guild.name}! #{guild.count}', fakeContext);
  assert.equal(result.content, 'Hi <@111>, welcome to Test Server! #42');
  assert.equal(result.embeds, undefined);
});

test('unknown variables are left alone rather than blanked', () => {
  const result = variables.render('{not.a.variable} stays', fakeContext);
  assert.equal(result.content, '{not.a.variable} stays');
});

test('embed scripts build a real embed', () => {
  const result = variables.render(
    '{embed}{color: #ff0000}$v{title: Hello {user.name}}$v{description: Member {guild.count}}',
    fakeContext,
  );
  assert.equal(result.embeds.length, 1);
  const embed = result.embeds[0].toJSON();
  assert.equal(embed.title, 'Hello ada');
  assert.equal(embed.description, 'Member 42');
  assert.equal(embed.color, 0xff0000);
});

test('embed author and footer split on &&', () => {
  const result = variables.render(
    '{embed}{author: Someone && https://cdn.example/i.png}$v{footer: A footer && https://cdn.example/f.png}$v{description: x}',
    fakeContext,
  );
  const embed = result.embeds[0].toJSON();
  assert.equal(embed.author.name, 'Someone');
  assert.equal(embed.author.icon_url, 'https://cdn.example/i.png');
  assert.equal(embed.footer.text, 'A footer');
});

test('a malformed part does not break the whole template', () => {
  const result = variables.render('{embed}{thumbnail: not-a-url}$v{description: still here}', fakeContext);
  assert.equal(result.embeds[0].toJSON().description, 'still here');
});

test('an empty template returns empty content', () => {
  assert.equal(variables.render('', fakeContext).content, '');
});

test('stringify round-trips into a parseable script', () => {
  const script = variables.stringify({ title: 'T', description: 'D', color: '#8b5cf6' });
  const embed = variables.render(script, fakeContext).embeds[0].toJSON();
  assert.equal(embed.title, 'T');
  assert.equal(embed.description, 'D');
});

/* ── settings schema ─────────────────────────────────────────────────── */

const { SETTINGS, coerce, defaultsFor } = require('../src/lib/settingsSchema');

group('settings');

test('booleans accept the forms a human would type', () => {
  assert.equal(coerce('levels.enabled', 'true').value, true);
  assert.equal(coerce('levels.enabled', 'on').value, true);
  assert.equal(coerce('levels.enabled', true).value, true);
  assert.equal(coerce('levels.enabled', 'off').value, false);
  assert.equal(coerce('levels.enabled', 'nonsense').value, false);
});

test('numbers are range-checked', () => {
  assert.equal(coerce('levels.xpPerMessage', '20').value, 20);
  assert.equal(coerce('levels.xpPerMessage', '0').ok, false, 'below the minimum');
  assert.equal(coerce('levels.xpPerMessage', '9999').ok, false, 'above the maximum');
  assert.equal(coerce('levels.xpPerMessage', 'abc').ok, false);
});

test('colours are normalised to #rrggbb', () => {
  assert.equal(coerce('embed.color', '8B5CF6').value, '#8b5cf6');
  assert.equal(coerce('embed.color', '#8b5cf6').value, '#8b5cf6');
  assert.equal(coerce('embed.color', 'red').ok, false);
  assert.equal(coerce('embed.color', '#fff').ok, false, 'short hex is rejected');
});

test('ID fields reject anything that is not a snowflake', () => {
  assert.equal(coerce('logs.channel', '123456789012345678').value, '123456789012345678');
  assert.equal(coerce('logs.channel', '').value, null);
  assert.equal(coerce('logs.channel', 'not-an-id').ok, false);
});

test('list fields deduplicate and validate', () => {
  const result = coerce('levels.ignoredChannels', ['123456789012345678', '123456789012345678']);
  assert.equal(result.value.length, 1);
  assert.equal(coerce('levels.ignoredChannels', ['nope']).ok, false);
});

test('select fields only accept their own options', () => {
  assert.equal(coerce('automod.action', 'ban').value, 'ban');
  assert.equal(coerce('automod.action', 'explode').ok, false);
});

test('unknown keys are rejected outright', () => {
  assert.equal(coerce('made.up.key', 'x').ok, false);
});

test('every default survives its own validator', () => {
  for (const [key, meta] of Object.entries(SETTINGS)) {
    if (meta.default === null) continue;
    assert.equal(coerce(key, meta.default).ok, true, `${key} default is invalid`);
  }
});

test('defaultsFor returns an independent copy each time', () => {
  const a = defaultsFor();
  const b = defaultsFor();
  a['automod.words'].push('mutated');
  assert.equal(b['automod.words'].length, 0, 'defaults must not be shared by reference');
});

/* ── database & settings store ───────────────────────────────────────── */

const store = require('../src/lib/db');

group('storage');

test('settings write, read back and fall back to defaults', () => {
  store.setSetting('g1', 'levels.enabled', true);
  assert.equal(store.getSetting('g1', 'levels.enabled'), true);
  assert.equal(store.getSetting('g2', 'levels.enabled'), false, 'untouched guild gets the default');

  store.setSetting('g1', 'levels.enabled', null);
  assert.equal(store.getSetting('g1', 'levels.enabled'), false, 'clearing restores the default');
});

test('settings are isolated per guild', () => {
  store.setSetting('g1', 'embed.color', '#ff0000');
  store.setSetting('g2', 'embed.color', '#00ff00');
  assert.equal(store.getSetting('g1', 'embed.color'), '#ff0000');
  assert.equal(store.getSetting('g2', 'embed.color'), '#00ff00');
});

test('case numbers increase per guild, independently', () => {
  const first = store.addCase({ guildId: 'gc', type: 'ban', userId: 'u1', moderatorId: 'm1', reason: 'x' });
  const second = store.addCase({ guildId: 'gc', type: 'kick', userId: 'u2', moderatorId: 'm1', reason: 'y' });
  const other = store.addCase({ guildId: 'gd', type: 'ban', userId: 'u1', moderatorId: 'm1', reason: 'z' });
  assert.equal(second, first + 1);
  assert.equal(other, 1, 'a different guild starts at 1');
});

test('prefixes persist and default correctly', () => {
  assert.equal(store.getPrefix('brand-new-guild'), require('../src/config').defaultPrefix);
  store.setPrefix('brand-new-guild', '!');
  assert.equal(store.getPrefix('brand-new-guild'), '!');
});

/* ── economy ─────────────────────────────────────────────────────────── */

const economy = require('../src/modules/economy');

group('economy');

test('new accounts start with the configured balance', () => {
  const wallet = economy.balance('eco', 'user-a');
  assert.equal(wallet.cash, 100);
});

test('transfers move money and refuse overdrafts', () => {
  economy.addCash('eco', 'user-a', 400); // 500 total
  const ok = economy.transfer('eco', 'user-a', 'user-b', 200);
  assert.equal(ok.ok, true);
  assert.equal(economy.balance('eco', 'user-a').cash, 300);
  assert.equal(economy.balance('eco', 'user-b').cash, 300); // 100 starting + 200

  const tooMuch = economy.transfer('eco', 'user-a', 'user-b', 999999);
  assert.equal(tooMuch.ok, false);
  assert.equal(economy.balance('eco', 'user-a').cash, 300, 'a failed transfer changes nothing');
});

test('deposit and withdraw keep the total constant', () => {
  const before = economy.balance('eco', 'user-a').total;
  economy.deposit('eco', 'user-a', 100);
  assert.equal(economy.balance('eco', 'user-a').total, before);
  economy.withdraw('eco', 'user-a', 50);
  assert.equal(economy.balance('eco', 'user-a').total, before);
});

test('balances never go negative', () => {
  economy.addCash('eco', 'user-c', -999999);
  assert.equal(economy.balance('eco', 'user-c').cash, 0);
});

test('daily can only be claimed once', () => {
  const first = economy.daily('eco', 'user-d');
  assert.equal(first.ok, true);
  const second = economy.daily('eco', 'user-d');
  assert.equal(second.ok, false);
  assert.ok(second.remaining > 0);
});

/* ── command registry ────────────────────────────────────────────────── */

const { Registry } = require('../src/lib/registry');

group('command registry');

const registry = new Registry().load();

test('every command loads', () => {
  assert.ok(registry.size > 200, `only ${registry.size} commands loaded`);
});

test('multi-word commands resolve longest-first', () => {
  const resolved = registry.resolve(['antinuke', 'whitelist', '@someone']);
  assert.equal(resolved.command.name, 'antinuke whitelist');
  assert.deepEqual(resolved.rest, ['@someone']);
});

test('a bare parent still resolves to the parent', () => {
  const resolved = registry.resolve(['antinuke']);
  assert.equal(resolved.command.name, 'antinuke');
});

test('aliases resolve to the real command', () => {
  assert.equal(registry.get('b').name, 'ban');
  assert.equal(registry.get('ui').name, 'userinfo');
});

test('unknown input resolves to nothing', () => {
  assert.equal(registry.resolve(['definitelynotacommand']).command, null);
});

test('typos get suggestions', () => {
  assert.ok(registry.closest('bann').includes('ban'));
  assert.ok(registry.closest('purg').includes('purge'));
});

test('no command shadows another as a prefix in a broken way', () => {
  for (const command of registry.all()) {
    const parts = command.name.split(' ');
    if (parts.length > 1) {
      // A subcommand's parent may or may not exist, but if it does it must
      // not swallow the subcommand — resolve() checks longest-first.
      const resolved = registry.resolve(parts);
      assert.equal(resolved.command.name, command.name, `${command.name} is unreachable`);
    }
  }
});

/* ── argument parsing ────────────────────────────────────────────────── */

const { parsePrefixArgs, tokenize } = require('../src/lib/arguments');

group('argument parsing');

const stubContext = { client: { users: { cache: new Map(), fetch: async () => null } }, guild: null };

test('tokenize keeps quoted phrases together', () => {
  assert.deepEqual(tokenize('one "two three" four'), ['one', 'two three', 'four']);
  assert.deepEqual(tokenize("a 'b c'"), ['a', 'b c']);
});

testAsync('a rest argument swallows the remainder', async () => {
  const command = { args: [{ name: 'text', type: 'rest', required: true }] };
  const result = await parsePrefixArgs(command, ['hello', 'there', 'friend'], stubContext);
  assert.equal(result.args.text, 'hello there friend');
});

testAsync('an optional duration is skipped when absent', async () => {
  // This is the `ban @user [duration] [reason]` shape: with no duration the
  // reason must not be eaten by the duration slot.
  const command = {
    args: [
      { name: 'duration', type: 'duration', required: false },
      { name: 'reason', type: 'rest', required: false, default: 'none' },
    ],
  };

  const withDuration = await parsePrefixArgs(command, ['7d', 'being', 'rude'], stubContext);
  assert.equal(withDuration.args.duration, 604800);
  assert.equal(withDuration.args.reason, 'being rude');

  const withoutDuration = await parsePrefixArgs(command, ['being', 'rude'], stubContext);
  assert.equal(withoutDuration.args.duration, null, 'no duration was given');
  assert.equal(withoutDuration.args.reason, 'being rude', 'the reason survives intact');
});

testAsync('a missing required argument is reported', async () => {
  const command = { args: [{ name: 'target', type: 'string', required: true }] };
  const result = await parsePrefixArgs(command, [], stubContext);
  assert.equal(result.ok, false);
  assert.equal(result.missing.name, 'target');
});

testAsync('numbers and booleans coerce from text', async () => {
  const command = {
    args: [
      { name: 'count', type: 'integer', required: true },
      { name: 'flag', type: 'boolean', required: true },
    ],
  };
  const result = await parsePrefixArgs(command, ['42', 'yes'], stubContext);
  assert.equal(result.args.count, 42);
  assert.equal(result.args.flag, true);
});

testAsync('choice arguments only accept their options', async () => {
  const command = { args: [{ name: 'mode', type: 'choice', choices: ['off', 'track'], required: true }] };
  const good = await parsePrefixArgs(command, ['track'], stubContext);
  assert.equal(good.args.mode, 'track');

  const bad = await parsePrefixArgs(command, ['sideways'], stubContext);
  assert.equal(bad.ok, false);
});

/* ── slash command payload ───────────────────────────────────────────── */

const { buildSlashCommands } = require('../src/lib/slash');

group('slash commands');

const slash = buildSlashCommands(registry);

test('the payload stays inside Discord limits', () => {
  assert.ok(slash.length <= 100, `${slash.length} top-level commands (limit 100)`);
  for (const command of slash) {
    assert.ok((command.options?.length ?? 0) <= 25, `/${command.name} has too many options`);
    assert.ok(command.description.length <= 100, `/${command.name} description too long`);
    assert.match(command.name, /^[a-z0-9_-]+$/, `/${command.name} has an illegal name`);
  }
});

test('a root command never mixes options with subcommands', () => {
  const SUBCOMMAND = 1;
  const SUBCOMMAND_GROUP = 2;
  for (const command of slash) {
    const options = command.options ?? [];
    const hasSub = options.some((option) => [SUBCOMMAND, SUBCOMMAND_GROUP].includes(option.type));
    if (hasSub) {
      assert.ok(
        options.every((option) => [SUBCOMMAND, SUBCOMMAND_GROUP].includes(option.type)),
        `/${command.name} mixes plain options with subcommands`,
      );
    }
  }
});

test('required options always precede optional ones', () => {
  const walk = (options, label) => {
    let seenOptional = false;
    for (const option of options ?? []) {
      if (option.options) walk(option.options, `${label} ${option.name}`);
      if (option.type > 2) {
        if (option.required && seenOptional) assert.fail(`${label}: required "${option.name}" follows an optional one`);
        if (!option.required) seenOptional = true;
      }
    }
  };
  for (const command of slash) walk(command.options, `/${command.name}`);
});

/* ── embeds ──────────────────────────────────────────────────────────── */

const { themeFor } = require('../src/lib/embeds');

group('embeds');

test('a guild theme picks up its own colours', () => {
  store.setSetting('theme-guild', 'embed.color', '#123456');
  const theme = themeFor('theme-guild');
  assert.equal(theme.primary, 0x123456);
});

test('status embeds carry the right colour and text', () => {
  const theme = themeFor('theme-guild');
  const success = theme.success('It worked').toJSON();
  assert.ok(success.description.includes('It worked'));
  assert.equal(success.color, theme.successColor);
});

test('over-long content is truncated rather than rejected', () => {
  const theme = themeFor('theme-guild');
  const embed = theme.base({ title: 'x'.repeat(500), description: 'y'.repeat(5000) }).toJSON();
  assert.ok(embed.title.length <= 256);
  assert.ok(embed.description.length <= 4096);
});

test('list embeds number their rows and show the page counter', () => {
  const theme = themeFor('theme-guild');
  const embed = theme.list({ title: 'Things', rows: ['alpha', 'beta'], page: 1, pages: 3 }).toJSON();
  assert.ok(embed.description.includes('alpha'));
  assert.ok(embed.footer.text.includes('Page 1 of 3'));
});

/* ── end to end ──────────────────────────────────────────────────────── */

const { handleMessage } = require('../src/lib/dispatcher');
const { PermissionsBitField, Collection } = require('discord.js');

group('end to end (mocked Discord)');

/** Just enough of a Message for the dispatcher to work with. */
function mockMessage(content, { guildId = 'e2e', userId = 'u-e2e' } = {}) {
  const sent = [];

  const guild = {
    id: guildId,
    name: 'E2E Guild',
    ownerId: 'owner',
    memberCount: 10,
    channels: { cache: new Collection() },
    roles: { cache: new Collection(), everyone: { id: guildId } },
    members: { me: { permissions: new PermissionsBitField(PermissionsBitField.All), roles: { highest: { comparePositionTo: () => 1 } } }, cache: new Collection(), fetch: async () => null },
    iconURL: () => null,
  };

  const author = {
    id: userId,
    bot: false,
    username: 'tester',
    tag: 'tester#0001',
    displayAvatarURL: () => 'https://cdn.example/a.png',
    createdTimestamp: Date.now() - 1e9,
    send: async () => ({}),
  };

  const channel = {
    id: 'c-e2e',
    name: 'general',
    guild,
    isTextBased: () => true,
    sendTyping: async () => {},
    send: async (payload) => {
      sent.push(payload);
      return { id: 'm2', edit: async () => {}, delete: async () => {} };
    },
  };

  const message = {
    id: 'm1',
    content,
    author,
    guild,
    channel,
    member: {
      id: userId,
      user: author,
      displayName: 'tester',
      permissions: new PermissionsBitField(PermissionsBitField.All),
      roles: { cache: new Collection(), highest: { comparePositionTo: () => 1 } },
    },
    mentions: { users: new Collection(), roles: new Collection() },
    reply: async (payload) => {
      sent.push(payload);
      return { id: 'm2', edit: async () => {}, delete: async () => {}, createMessageComponentCollector: () => ({ on: () => {} }) };
    },
    delete: async () => {},
    react: async () => {},
  };

  return { message, sent };
}

/** A resolvable stand-in for any user ID the commands look up. */
const mockUser = (id) => ({
  id,
  bot: false,
  username: `user-${id.slice(-4)}`,
  tag: `user-${id.slice(-4)}#0000`,
  displayAvatarURL: () => 'https://cdn.example/a.png',
  createdTimestamp: Date.now() - 1e9,
  send: async () => ({}),
});

const mockClient = {
  user: { id: 'bot', username: 'Vex', tag: 'Vex#0000', displayAvatarURL: () => '' },
  registry,
  users: { cache: new Collection(), fetch: async (id) => mockUser(id) },
  caches: { snipes: new Collection(), editSnipes: new Collection(), reactionSnipes: new Collection(), spam: new Collection() },
  guilds: { cache: new Collection() },
  ws: { ping: 42 },
};

testAsync('a command runs and replies with an embed', async () => {
  const { message, sent } = mockMessage('.8ball will this work?');
  const handled = await handleMessage(mockClient, message, '.');
  assert.equal(handled, true, 'the dispatcher recognised the command');
  assert.equal(sent.length, 1, 'exactly one reply was sent');
  assert.ok(sent[0].embeds?.[0], 'the reply contains an embed');
  assert.ok(sent[0].embeds[0].toJSON().description.includes('will this work?'));
});

testAsync('a missing required argument shows the usage guide', async () => {
  const { message, sent } = mockMessage('.8ball');
  await handleMessage(mockClient, message, '.');
  const description = sent[0].embeds[0].toJSON().description;
  assert.ok(description.includes('Missing required argument'), 'it says what is missing');
  assert.ok(description.includes('Usage:'), 'it shows the usage line');
  assert.ok(description.includes('help 8ball'), 'it points at the full guide');
});

testAsync('an unknown command is ignored rather than answered', async () => {
  const { message, sent } = mockMessage('.thisisnotacommand');
  const handled = await handleMessage(mockClient, message, '.');
  assert.equal(handled, false);
  assert.equal(sent.length, 0, 'the bot stays quiet');
});

testAsync('permission gates are enforced', async () => {
  const { message, sent } = mockMessage('.ban 123456789012345678 test');
  message.member.permissions = new PermissionsBitField(); // no permissions at all
  await handleMessage(mockClient, message, '.');
  assert.ok(sent[0].embeds[0].toJSON().description.includes('Ban Members'), 'it names the missing permission');
});

testAsync('a disabled category blocks its commands', async () => {
  store.setSetting('e2e', 'general.disabledCategories', ['Fun']);
  const { message, sent } = mockMessage('.8ball hello');
  await handleMessage(mockClient, message, '.');
  assert.ok(sent[0].embeds[0].toJSON().description.includes('disabled'));
  store.setSetting('e2e', 'general.disabledCategories', []);
});

testAsync('cooldowns kick in on repeat use', async () => {
  const { cooldowns } = require('../src/lib/dispatcher');
  cooldowns.clear();

  const first = mockMessage('.roll 1d6', { userId: 'cooldown-user' });
  await handleMessage(mockClient, first.message, '.');
  assert.ok(first.sent[0].embeds[0].toJSON().description.includes('Rolling'));

  const second = mockMessage('.roll 1d6', { userId: 'cooldown-user' });
  await handleMessage(mockClient, second.message, '.');
  assert.ok(second.sent[0].embeds[0].toJSON().description.includes('Slow down'), 'the second call is rate limited');
});

testAsync('the theme applies the guild colour to replies', async () => {
  store.setSetting('e2e', 'embed.success', '#abcdef');
  const { message, sent } = mockMessage('.prefix', { guildId: 'e2e' });
  await handleMessage(mockClient, message, '.');
  assert.ok(sent[0].embeds[0].toJSON().description.includes('prefix'));
});

/* ── report ──────────────────────────────────────────────────────────── */

(async () => {
  for (const run of queue) await run();

  console.log(results.join('\n'));
  const total = results.filter((line) => line.startsWith('  ')).length;
  console.log(`\n${total - failures}/${total} checks passed.`);

  if (failures) {
    console.log(`\n✗ ${failures} failing.\n`);
    process.exit(1);
  }
  console.log('\n✓ All checks passed.\n');
  process.exit(0);
})();
