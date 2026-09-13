'use strict';

const { PermissionsBitField } = require('discord.js');
const store = require('./db');
const { sendLog } = require('./modlog');
const { themeFor } = require('./embeds');
const { formatDuration, now } = require('./util');
const emojis = require('./emojis');
const logger = require('./logger');

const ACTION_META = {
  ban: { emoji: emojis.ban, past: 'banned', color: 'error' },
  unban: { emoji: emojis.success, past: 'unbanned', color: 'success' },
  softban: { emoji: emojis.ban, past: 'softbanned', color: 'error' },
  hardban: { emoji: emojis.ban, past: 'hardbanned', color: 'error' },
  kick: { emoji: emojis.kick, past: 'kicked', color: 'warn' },
  timeout: { emoji: emojis.mute, past: 'timed out', color: 'warn' },
  untimeout: { emoji: emojis.unmute, past: 'untimed out', color: 'success' },
  mute: { emoji: emojis.mute, past: 'muted', color: 'warn' },
  unmute: { emoji: emojis.unmute, past: 'unmuted', color: 'success' },
  warn: { emoji: emojis.warn_, past: 'warned', color: 'warn' },
  jail: { emoji: emojis.jail, past: 'jailed', color: 'warn' },
  unjail: { emoji: emojis.success, past: 'released', color: 'success' },
  strip: { emoji: emojis.strip, past: 'stripped of roles', color: 'error' },
  purge: { emoji: emojis.purge, past: 'purged', color: 'warn' },
  imute: { emoji: emojis.mute, past: 'image muted', color: 'warn' },
  rmute: { emoji: emojis.mute, past: 'reaction muted', color: 'warn' },
  nickname: { emoji: '📝', past: 'renamed', color: 'warn' },
};

/**
 * Can `moderator` act on `target`?
 *
 * Checks role hierarchy for both the moderator and the bot, plus the
 * server's protected-roles list. Returns null when the action is allowed.
 */
function checkHierarchy(ctx, target, { action = 'moderate' } = {}) {
  const { guild, member: moderator } = ctx;
  if (!guild || !target) return null;

  if (target.id === ctx.user.id) return `You cannot ${action} yourself.`;
  if (target.id === guild.ownerId) return `You cannot ${action} the server owner.`;
  if (target.id === ctx.client.user.id) return `I am not going to ${action} myself.`;

  const protectedRoles = store.getSetting(guild.id, 'moderation.protectedRoles') ?? [];
  if (target.roles?.cache?.some((role) => protectedRoles.includes(role.id))) {
    return `**${target.user?.username ?? target.displayName}** has a protected role.`;
  }

  const isOwner = guild.ownerId === ctx.user.id;
  if (!isOwner && target.roles && moderator?.roles) {
    if (moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
      return `**${target.user.username}** has a role equal to or above yours.`;
    }
  }

  const me = guild.members.me;
  if (target.roles && me && me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return `**${target.user.username}**'s highest role is above mine — move my role higher to fix this.`;
  }

  if (action === 'ban' && target.bannable === false) return 'I do not have permission to ban that member.';
  if (action === 'kick' && target.kickable === false) return 'I do not have permission to kick that member.';
  if (action === 'timeout' && target.moderatable === false) return 'I cannot time that member out.';

  return null;
}

/** Tell the punished member what happened, if the server wants us to. */
async function notify(guild, user, action, { reason, duration, moderator } = {}) {
  if (!store.getSetting(guild.id, 'general.dmOnPunish')) return false;
  const meta = ACTION_META[action] ?? { emoji: emojis.info, past: action };
  const theme = themeFor(guild.id);

  const fields = [{ name: 'Reason', value: reason || 'No reason provided', inline: false }];
  if (duration) fields.push({ name: 'Duration', value: formatDuration(duration), inline: true });
  if (moderator) fields.push({ name: 'Moderator', value: moderator.username, inline: true });

  const embed = theme.base({
    color: theme[`${meta.color ?? 'warn'}Color`] ?? theme.warnColor,
    title: `${meta.emoji} You were ${meta.past} in ${guild.name}`,
    fields,
    timestamp: true,
  });

  return user.send({ embeds: [embed] }).then(
    () => true,
    () => false,
  );
}

/**
 * Record a moderation action: writes the case, posts the mod log and
 * (optionally) DMs the member. Returns the case number.
 */
async function record(ctx, {
  action,
  target,
  reason = 'No reason provided',
  duration = null,
  dm = true,
  extra = [],
}) {
  const guild = ctx.guild;
  const user = target.user ?? target;
  const expiresAt = duration ? now() + duration : null;

  const caseNumber = store.addCase({
    guildId: guild.id,
    type: action,
    userId: user.id,
    moderatorId: ctx.user.id,
    reason,
    duration,
    expiresAt,
  });

  let delivered = false;
  if (dm && user.bot !== true) {
    delivered = await notify(guild, user, action, { reason, duration, moderator: ctx.user });
  }

  const meta = ACTION_META[action] ?? { emoji: emojis.info, past: action, color: 'warn' };
  const theme = themeFor(guild.id);
  const fields = [
    { name: 'Member', value: `${user} \`${user.id}\``, inline: true },
    { name: 'Moderator', value: `${ctx.user} \`${ctx.user.id}\``, inline: true },
  ];
  if (duration) fields.push({ name: 'Duration', value: formatDuration(duration), inline: true });
  fields.push({ name: 'Reason', value: reason, inline: false });
  if (extra.length) fields.push(...extra);
  if (dm && user.bot !== true) {
    fields.push({ name: 'Notified', value: delivered ? 'Yes' : 'DMs closed', inline: true });
  }

  await sendLog(guild, 'moderation', theme.base({
    color: theme[`${meta.color}Color`] ?? theme.warnColor,
    author: { name: `Case #${caseNumber} • ${meta.past}`, iconURL: user.displayAvatarURL() },
    fields,
    timestamp: true,
  }));

  return { caseNumber, delivered };
}

/** Find (or create) the role used by the mute command. */
async function ensureMuteRole(guild) {
  const configured = store.getSetting(guild.id, 'moderation.muteRole');
  const existing = configured && guild.roles.cache.get(configured);
  if (existing) return existing;

  const byName = guild.roles.cache.find((role) => role.name.toLowerCase() === 'muted');
  if (byName) {
    store.setSetting(guild.id, 'moderation.muteRole', byName.id);
    return byName;
  }

  const role = await guild.roles.create({
    name: 'Muted',
    color: 0x818386,
    permissions: [],
    reason: 'Mute role created automatically',
  });

  // Deny talking everywhere. Best effort — a missing channel should not abort.
  await Promise.all(
    guild.channels.cache.map((channel) =>
      channel
        .permissionOverwrites?.edit(role, {
          SendMessages: false,
          SendMessagesInThreads: false,
          AddReactions: false,
          Speak: false,
          Connect: channel.isVoiceBased?.() ? false : null,
        })
        .catch(() => null),
    ),
  );

  store.setSetting(guild.id, 'moderation.muteRole', role.id);
  return role;
}

/** Find (or create) the jail role plus its channel overrides. */
async function ensureJailRole(guild) {
  const configured = store.getSetting(guild.id, 'moderation.jailRole');
  const existing = configured && guild.roles.cache.get(configured);
  if (existing) return existing;

  const role = await guild.roles.create({
    name: 'Jailed',
    color: 0x2b2d31,
    permissions: [],
    reason: 'Jail role created automatically',
  });

  const jailChannel = store.getSetting(guild.id, 'moderation.jailChannel');
  await Promise.all(
    guild.channels.cache.map((channel) => {
      if (channel.id === jailChannel) {
        return channel.permissionOverwrites?.edit(role, { ViewChannel: true, SendMessages: true }).catch(() => null);
      }
      return channel.permissionOverwrites?.edit(role, { ViewChannel: false }).catch(() => null);
    }),
  );

  store.setSetting(guild.id, 'moderation.jailRole', role.id);
  return role;
}

/** Apply the configured punishment once someone hits the warn threshold. */
async function escalate(ctx, member) {
  const guild = ctx.guild;
  const threshold = store.getSetting(guild.id, 'moderation.warnThreshold') ?? 0;
  if (!threshold) return null;

  const count = store.db
    .prepare("SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1")
    .get(guild.id, member.id).total;

  if (count < threshold) return null;

  const punishment = store.getSetting(guild.id, 'moderation.warnPunishment') ?? 'timeout';
  const reason = `Reached ${count} warnings`;

  try {
    if (punishment === 'ban') await member.ban({ reason });
    else if (punishment === 'kick') await member.kick(reason);
    else await member.timeout(60 * 60 * 1000, reason);
    await record(ctx, { action: punishment === 'timeout' ? 'timeout' : punishment, target: member, reason, duration: punishment === 'timeout' ? 3600 : null });
    return punishment;
  } catch (error) {
    logger.debug(`Warn escalation failed in ${guild.id}: ${error.message}`);
    return null;
  }
}

/** Store a member's roles so they can be handed back later (strip/jail). */
function stashRoles(guildId, userId, kind, roleIds) {
  store.db
    .prepare(
      `INSERT INTO stored_roles (guild_id, user_id, kind, roles) VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, user_id, kind) DO UPDATE SET roles = excluded.roles`,
    )
    .run(guildId, userId, kind, JSON.stringify(roleIds));
}

function popRoles(guildId, userId, kind) {
  const row = store.db
    .prepare('SELECT roles FROM stored_roles WHERE guild_id = ? AND user_id = ? AND kind = ?')
    .get(guildId, userId, kind);
  if (!row) return [];
  store.db.prepare('DELETE FROM stored_roles WHERE guild_id = ? AND user_id = ? AND kind = ?').run(guildId, userId, kind);
  try {
    return JSON.parse(row.roles);
  } catch {
    return [];
  }
}

/** Roles the bot is actually able to add or remove. */
function manageableRoles(guild, roles) {
  const me = guild.members.me;
  return roles.filter(
    (role) =>
      role.id !== guild.id &&
      !role.managed &&
      me.roles.highest.comparePositionTo(role) > 0,
  );
}

const Permissions = PermissionsBitField.Flags;

module.exports = {
  ACTION_META,
  checkHierarchy,
  record,
  notify,
  ensureMuteRole,
  ensureJailRole,
  escalate,
  stashRoles,
  popRoles,
  manageableRoles,
  Permissions,
};
