'use strict';

const { ChannelType, ApplicationCommandOptionType } = require('discord.js');
const { parseDuration, isSnowflake } = require('./util');

/** Split on whitespace but keep "quoted phrases" together. */
function tokenize(input) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

const MENTION = {
  user: /^<@!?(\d{15,25})>$/,
  role: /^<@&(\d{15,25})>$/,
  channel: /^<#(\d{15,25})>$/,
  emoji: /^<(a)?:(\w+):(\d{15,25})>$/,
};

async function resolveUser(client, guild, token) {
  const id = token.match(MENTION.user)?.[1] ?? (isSnowflake(token) ? token : null);
  if (id) return client.users.fetch(id).catch(() => null);

  if (guild) {
    const member = await resolveMember(guild, token);
    if (member) return member.user;
  }

  const lower = token.toLowerCase();
  return (
    client.users.cache.find(
      (user) => user.username.toLowerCase() === lower || user.tag.toLowerCase() === lower,
    ) ?? null
  );
}

async function resolveMember(guild, token) {
  if (!guild) return null;
  const id = token.match(MENTION.user)?.[1] ?? (isSnowflake(token) ? token : null);
  if (id) return guild.members.fetch(id).catch(() => null);

  const lower = token.toLowerCase();
  const cached =
    guild.members.cache.find((m) => m.user.tag.toLowerCase() === lower) ??
    guild.members.cache.find((m) => m.user.username.toLowerCase() === lower) ??
    guild.members.cache.find((m) => m.displayName.toLowerCase() === lower);
  if (cached) return cached;

  // Fall back to a server-side search so uncached members still resolve.
  const found = await guild.members.search({ query: token, limit: 1 }).catch(() => null);
  if (found?.size) return found.first();

  const partial = guild.members.cache.find(
    (m) => m.displayName.toLowerCase().startsWith(lower) || m.user.username.toLowerCase().startsWith(lower),
  );
  return partial ?? null;
}

function resolveRole(guild, token) {
  if (!guild) return null;
  const id = token.match(MENTION.role)?.[1] ?? (isSnowflake(token) ? token : null);
  if (id) return guild.roles.cache.get(id) ?? null;
  const lower = token.toLowerCase();
  return (
    guild.roles.cache.find((role) => role.name.toLowerCase() === lower) ??
    guild.roles.cache.find((role) => role.name.toLowerCase().startsWith(lower)) ??
    null
  );
}

function resolveChannel(guild, token, types) {
  if (!guild) return null;
  const id = token.match(MENTION.channel)?.[1] ?? (isSnowflake(token) ? token : null);
  let channel = id ? guild.channels.cache.get(id) : null;
  if (!channel) {
    const lower = token.toLowerCase().replace(/^#/, '');
    channel =
      guild.channels.cache.find((c) => c.name.toLowerCase() === lower) ??
      guild.channels.cache.find((c) => c.name.toLowerCase().startsWith(lower)) ??
      null;
  }
  if (channel && types && !types.includes(channel.type)) return null;
  return channel;
}

const CHANNEL_TYPES = {
  channel: null,
  textchannel: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
  voicechannel: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
  category: [ChannelType.GuildCategory],
};

const TRUE_WORDS = ['true', 'yes', 'on', 'enable', 'enabled', 'y', '1'];
const FALSE_WORDS = ['false', 'no', 'off', 'disable', 'disabled', 'n', '0'];

/**
 * Try to turn one token into the type a command asked for.
 * Returns `undefined` when the token simply is not that type, which lets
 * optional arguments be skipped without consuming the token.
 */
async function resolveToken(spec, token, ctxLike) {
  const { client, guild } = ctxLike;

  switch (spec.type) {
    case 'string':
      return token;

    case 'number': {
      const value = Number(token.replace(/,/g, ''));
      return Number.isFinite(value) ? value : undefined;
    }

    case 'integer': {
      const value = Number.parseInt(token.replace(/,/g, ''), 10);
      return Number.isInteger(value) ? value : undefined;
    }

    case 'boolean': {
      const lower = token.toLowerCase();
      if (TRUE_WORDS.includes(lower)) return true;
      if (FALSE_WORDS.includes(lower)) return false;
      return undefined;
    }

    case 'duration': {
      const seconds = parseDuration(token);
      return seconds === null ? undefined : seconds;
    }

    case 'user':
      return (await resolveUser(client, guild, token)) ?? undefined;

    case 'member':
      return (await resolveMember(guild, token)) ?? undefined;

    case 'role':
      return resolveRole(guild, token) ?? undefined;

    case 'channel':
    case 'textchannel':
    case 'voicechannel':
    case 'category':
      return resolveChannel(guild, token, CHANNEL_TYPES[spec.type]) ?? undefined;

    case 'emoji': {
      const custom = token.match(MENTION.emoji);
      if (custom) return { animated: Boolean(custom[1]), name: custom[2], id: custom[3], toString: () => token };
      // Anything else is treated as unicode; Discord validates on use.
      if (/\p{Extended_Pictographic}/u.test(token)) return { name: token, id: null, toString: () => token };
      return undefined;
    }

    case 'choice': {
      const lower = token.toLowerCase();
      const choice = spec.choices.find((c) => String(c).toLowerCase() === lower);
      return choice ?? undefined;
    }

    default:
      return token;
  }
}

/** Resolve every declared argument from a prefix message. */
async function parsePrefixArgs(command, tokens, ctxLike) {
  const specs = command.args ?? [];
  const result = {};
  let index = 0;

  for (const spec of specs) {
    if (spec.type === 'rest') {
      const rest = tokens.slice(index).join(' ').trim();
      if (rest) {
        result[spec.name] = rest;
        index = tokens.length;
      } else if (spec.required) {
        return { ok: false, missing: spec };
      } else {
        result[spec.name] = spec.default ?? null;
      }
      continue;
    }

    const token = tokens[index];
    if (token === undefined) {
      if (spec.required) return { ok: false, missing: spec };
      result[spec.name] = spec.default ?? null;
      continue;
    }

    const value = await resolveToken(spec, token, ctxLike);
    if (value === undefined) {
      if (spec.required) return { ok: false, invalid: spec, token };
      result[spec.name] = spec.default ?? null;
      continue; // leave the token for the next argument
    }

    result[spec.name] = value;
    index += 1;
  }

  return { ok: true, args: result, leftover: tokens.slice(index) };
}

/** Read every declared argument out of a slash command interaction. */
async function parseSlashArgs(command, interaction) {
  const specs = command.args ?? [];
  const result = {};

  for (const spec of specs) {
    const name = spec.name.toLowerCase();
    let value = null;

    switch (spec.type) {
      case 'user':
        value = interaction.options.getUser(name);
        break;
      case 'member':
        value = interaction.options.getMember(name);
        break;
      case 'role':
        value = interaction.options.getRole(name);
        break;
      case 'channel':
      case 'textchannel':
      case 'voicechannel':
      case 'category':
        value = interaction.options.getChannel(name);
        break;
      case 'boolean':
        value = interaction.options.getBoolean(name);
        break;
      case 'number':
        value = interaction.options.getNumber(name);
        break;
      case 'integer':
        value = interaction.options.getInteger(name);
        break;
      case 'duration': {
        const raw = interaction.options.getString(name);
        value = raw ? parseDuration(raw) : null;
        break;
      }
      case 'emoji': {
        const raw = interaction.options.getString(name);
        value = raw ? await resolveToken(spec, raw, { client: interaction.client, guild: interaction.guild }) : null;
        break;
      }
      default:
        value = interaction.options.getString(name);
        break;
    }

    result[spec.name] = value ?? spec.default ?? null;
  }

  return result;
}

/** Map our argument types onto Discord's option types for slash registration. */
function slashOptionType(type) {
  switch (type) {
    case 'user':
    case 'member':
      return ApplicationCommandOptionType.User;
    case 'role':
      return ApplicationCommandOptionType.Role;
    case 'channel':
    case 'textchannel':
    case 'voicechannel':
    case 'category':
      return ApplicationCommandOptionType.Channel;
    case 'boolean':
      return ApplicationCommandOptionType.Boolean;
    case 'number':
      return ApplicationCommandOptionType.Number;
    case 'integer':
      return ApplicationCommandOptionType.Integer;
    default:
      return ApplicationCommandOptionType.String;
  }
}

function slashChannelTypes(type) {
  return CHANNEL_TYPES[type] ?? undefined;
}

module.exports = {
  tokenize,
  parsePrefixArgs,
  parseSlashArgs,
  resolveToken,
  resolveMember,
  resolveUser,
  resolveRole,
  resolveChannel,
  slashOptionType,
  slashChannelTypes,
};
