'use strict';

const { respond } = require('./reply');
const { PermissionsBitField } = require('discord.js');
const { Context } = require('./context');
const { parsePrefixArgs, parseSlashArgs, tokenize } = require('./arguments');
const store = require('./db');
const config = require('../config');
const logger = require('./logger');
const emojis = require('./emojis');
const { titleCase } = require('./util');

const cooldowns = new Map(); // `${commandName}:${userId}` -> expiry ms

function isOwner(userId) {
  return config.ownerIds.includes(userId);
}

function prettyPermissions(list) {
  return list.map((permission) => `\`${titleCase(String(permission).replace(/([A-Z])/g, ' $1').trim())}\``).join(', ');
}

function isBlacklisted(id) {
  return Boolean(store.db.prepare('SELECT 1 FROM blacklist WHERE id = ?').get(id));
}

function isDisabled(guildId, command, channelId) {
  if (!guildId) return false;
  const row = store.db
    .prepare('SELECT 1 FROM disabled_commands WHERE guild_id = ? AND command = ? AND channel_id IN (?, ?)')
    .get(guildId, command.name, 'all', channelId);
  if (row) return true;
  const disabledCategories = store.getSetting(guildId, 'general.disabledCategories') ?? [];
  return disabledCategories.includes(command.category);
}

/** Module switches: a command in a disabled module should not run at all. */
const MODULE_TOGGLES = {
  Music: 'music.enabled',
  Economy: 'economy.enabled',
  Fun: 'fun.enabled',
};

/**
 * Shared gatekeeping for both prefix and slash invocations.
 * Returns an error string, or null when the command may run.
 */
function check(ctx) {
  const { command, guild, member, user, channel } = ctx;

  if (isBlacklisted(user.id)) return 'You are blacklisted from using this bot.';
  if (guild && isBlacklisted(guild.id)) return 'This server is blacklisted from using this bot.';

  if (command.ownerOnly && !isOwner(user.id)) return 'This command is limited to the bot owners.';
  if (command.guildOnly && !guild) return 'This command only works inside a server.';

  if (guild) {
    if (isDisabled(guild.id, command, channel.id)) {
      return 'That command is disabled here.';
    }
    const toggle = MODULE_TOGGLES[command.category];
    if (toggle && store.getSetting(guild.id, toggle) === false) {
      return `The **${command.category}** module is switched off in this server.`;
    }
    if (command.category === 'Music') {
      const musicChannel = store.getSetting(guild.id, 'music.textChannel');
      if (musicChannel && musicChannel !== channel.id && !member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return `Music commands can only be used in <#${musicChannel}>.`;
      }
    }
  }

  if (command.permissions.length && guild && !isOwner(user.id)) {
    const missing = command.permissions.filter((permission) => !member?.permissions?.has(PermissionsBitField.Flags[permission]));
    if (missing.length) return `You need ${prettyPermissions(missing)} to run this command.`;
  }

  if (command.botPermissions.length && guild) {
    const me = guild.members.me;
    const missing = command.botPermissions.filter((permission) => !me?.permissions?.has(PermissionsBitField.Flags[permission]));
    if (missing.length) return `I need ${prettyPermissions(missing)} to do that.`;
  }

  if (command.serverOwnerOnly && guild && guild.ownerId !== user.id && !isOwner(user.id)) {
    return 'Only the server owner can run this command.';
  }

  if (!isOwner(user.id) && command.cooldown) {
    const key = `${command.name}:${user.id}`;
    const expires = cooldowns.get(key) ?? 0;
    const remaining = expires - Date.now();
    if (remaining > 0) {
      return `Slow down — try again in **${(remaining / 1000).toFixed(1)}s**.`;
    }
    cooldowns.set(key, Date.now() + command.cooldown * 1000);
  }

  return null;
}

function trackUsage(commandName) {
  store.db
    .prepare(
      `INSERT INTO command_stats (command, uses) VALUES (?, 1)
       ON CONFLICT(command) DO UPDATE SET uses = uses + 1`,
    )
    .run(commandName);
}

async function fail(ctx, text) {
  if (ctx.guild && store.getSetting(ctx.guild.id, 'general.silentErrors') && ctx.message) {
    return ctx.message.react(emojis.error).catch(() => {});
  }
  return ctx.error(text).catch(() => {});
}

async function run(ctx) {
  const problem = check(ctx);
  if (problem) return fail(ctx, problem);

  try {
    if (ctx.guild && ctx.message && store.getSetting(ctx.guild.id, 'general.deleteInvocation')) {
      ctx.message.delete().catch(() => {});
    }
    await ctx.command.run(ctx);
    trackUsage(ctx.command.name);
  } catch (error) {
    logger.error(`Command "${ctx.command.name}" threw`, error);
    const message =
      error?.friendly === true
        ? error.message
        : 'Something went wrong running that command. The error has been logged.';
    await fail(ctx, message);
  }
  return undefined;
}

/** Entry point for prefix commands. */
async function handleMessage(client, message, prefix) {
  const withoutPrefix = message.content.slice(prefix.length).trim();
  if (!withoutPrefix) return false;

  const tokens = tokenize(withoutPrefix);
  let { command, rest } = client.registry.resolve(tokens);

  // Server-defined aliases, e.g. `.yeet` → `ban`.
  if (!command && message.guild) {
    const alias = store.db
      .prepare('SELECT command FROM command_aliases WHERE guild_id = ? AND alias = ?')
      .get(message.guild.id, tokens[0]?.toLowerCase());
    if (alias) {
      const resolved = client.registry.resolve([...alias.command.split(' '), ...tokens.slice(1)]);
      command = resolved.command;
      rest = resolved.rest;
    }
  }

  if (!command) return false;

  const ctx = new Context({ client, message, command, prefix });
  const parsed = await parsePrefixArgs(command, rest, { client, guild: message.guild });

  if (!parsed.ok) {
    const spec = parsed.missing ?? parsed.invalid;
    const note = parsed.missing
      ? `Missing required argument **${spec.name}**.`
      : `\`${parsed.token}\` is not a valid **${spec.name}**.`;
    await ctx.usage(note);
    return true;
  }

  ctx.args = parsed.args;
  ctx.rawArgs = rest;
  await run(ctx);
  return true;
}

/** Entry point for slash commands. */
async function handleInteraction(client, interaction) {
  const parts = [interaction.commandName];
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);
  if (group) parts.push(group);
  if (sub) parts.push(sub);

  const command = client.registry.get(parts.join(' ')) ?? client.registry.get(interaction.commandName);
  if (!command) {
    return respond(interaction, { content: `${emojis.error} That command no longer exists.`, ephemeral: true });
  }

  const ctx = new Context({ client, interaction, command });
  ctx.args = await parseSlashArgs(command, interaction);
  return run(ctx);
}

module.exports = { handleMessage, handleInteraction, isOwner, check, cooldowns };
