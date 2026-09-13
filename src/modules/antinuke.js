'use strict';

const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const { manageableRoles } = require('../lib/moderation');
const logger = require('../lib/logger');
const emojis = require('../lib/emojis');

const WINDOW_SECONDS = 60;

function isWhitelisted(guild, userId) {
  if (userId === guild.ownerId) return true;
  if (userId === guild.client.user.id) return true;
  return Boolean(
    store.db.prepare('SELECT 1 FROM antinuke_whitelist WHERE guild_id = ? AND user_id = ?').get(guild.id, userId),
  );
}

function whitelist(guildId, userId) {
  store.db.prepare('INSERT OR IGNORE INTO antinuke_whitelist (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
}

function unwhitelist(guildId, userId) {
  store.db.prepare('DELETE FROM antinuke_whitelist WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

function listWhitelist(guildId) {
  return store.db.prepare('SELECT user_id FROM antinuke_whitelist WHERE guild_id = ?').all(guildId).map((r) => r.user_id);
}

/** Record an action and return how many that user has done in the window. */
function tally(guildId, userId, action) {
  store.db.prepare('INSERT INTO antinuke_actions (guild_id, user_id, action) VALUES (?, ?, ?)').run(guildId, userId, action);
  store.db
    .prepare("DELETE FROM antinuke_actions WHERE created_at < strftime('%s','now') - 600")
    .run();
  return store.db
    .prepare(
      `SELECT COUNT(*) AS total FROM antinuke_actions
       WHERE guild_id = ? AND user_id = ? AND created_at > strftime('%s','now') - ?`,
    )
    .get(guildId, userId, WINDOW_SECONDS).total;
}

/** Strip / kick / ban the offender and shout about it. */
async function respond(guild, userId, action, count) {
  const punishment = store.getSetting(guild.id, 'antinuke.punishment') ?? 'strip';
  const member = await guild.members.fetch(userId).catch(() => null);
  let outcome = 'none';

  try {
    if (member) {
      if (punishment === 'ban' && member.bannable) {
        await member.ban({ reason: `Antinuke: ${count}× ${action}` });
        outcome = 'banned';
      } else if (punishment === 'kick' && member.kickable) {
        await member.kick(`Antinuke: ${count}× ${action}`);
        outcome = 'kicked';
      } else {
        const roles = manageableRoles(guild, [...member.roles.cache.values()]);
        if (roles.length) await member.roles.remove(roles, `Antinuke: ${count}× ${action}`);
        outcome = `stripped of ${roles.length} role(s)`;
      }
    }
  } catch (error) {
    logger.warn(`Antinuke could not punish ${userId} in ${guild.id}: ${error.message}`);
    outcome = 'failed — check my permissions';
  }

  store.db.prepare('DELETE FROM antinuke_actions WHERE guild_id = ? AND user_id = ?').run(guild.id, userId);

  const theme = themeFor(guild.id);
  const embed = theme.base({
    color: theme.errorColor,
    title: `${emojis.strip} Antinuke triggered`,
    description: `<@${userId}> performed **${count}× ${action}** within ${WINDOW_SECONDS} seconds.`,
    fields: [
      { name: 'User', value: `<@${userId}> \`${userId}\``, inline: true },
      { name: 'Response', value: outcome, inline: true },
    ],
    timestamp: true,
  });

  const channelId = store.getSetting(guild.id, 'antinuke.logChannel') ?? store.getSetting(guild.id, 'logs.moderation');
  const channel = channelId ? guild.channels.cache.get(channelId) : null;
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => {});
  else await guild.fetchOwner().then((owner) => owner.send({ embeds: [embed] })).catch(() => {});
}

/** Shared path for every watched action. */
async function register(guild, userId, action, settingKey) {
  if (!store.getSetting(guild.id, 'antinuke.enabled')) return;
  if (settingKey && store.getSetting(guild.id, settingKey) === false) return;
  if (!userId || isWhitelisted(guild, userId)) return;

  const count = tally(guild.id, userId, action);
  const threshold = store.getSetting(guild.id, 'antinuke.threshold') ?? 3;
  if (count >= threshold) await respond(guild, userId, action, count);
}

/** Who did it? The audit log is the only way to know. */
async function findExecutor(guild, type, targetId) {
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) return null;
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  if (!logs) return null;
  const entry = logs.entries.find(
    (item) =>
      (!targetId || item.target?.id === targetId || item.targetId === targetId) &&
      Date.now() - item.createdTimestamp < 15_000,
  );
  return entry?.executor?.id ?? null;
}

/* ── event hooks ─────────────────────────────────────────────────────── */

async function onChannelDelete(channel) {
  if (!channel.guild) return;
  const executor = await findExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
  await register(channel.guild, executor, 'channel delete', 'antinuke.channelDelete');
}

async function onRoleDelete(role) {
  const executor = await findExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
  await register(role.guild, executor, 'role delete', 'antinuke.roleDelete');
}

async function onBanAdd(ban) {
  const executor = await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
  await register(ban.guild, executor, 'ban', 'antinuke.bans');
}

async function onMemberRemove(member) {
  const executor = await findExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
  if (executor) await register(member.guild, executor, 'kick', 'antinuke.kicks');
}

/** Audit-log gateway event — the reliable way to catch webhooks and bot adds. */
async function onAuditLogEntry(entry, guild) {
  if (!store.getSetting(guild.id, 'antinuke.enabled')) return;
  const executorId = entry.executorId;
  if (!executorId) return;

  if (entry.action === AuditLogEvent.WebhookCreate) {
    await register(guild, executorId, 'webhook create', 'antinuke.webhooks');
  }

  if (entry.action === AuditLogEvent.BotAdd && store.getSetting(guild.id, 'antinuke.botAdd')) {
    if (isWhitelisted(guild, executorId)) return;
    const bot = await guild.members.fetch(entry.targetId).catch(() => null);
    if (bot?.kickable) await bot.kick('Antinuke: unauthorised bot').catch(() => {});
    await register(guild, executorId, 'bot add', 'antinuke.botAdd');
  }
}

module.exports = {
  isWhitelisted,
  whitelist,
  unwhitelist,
  listWhitelist,
  onChannelDelete,
  onRoleDelete,
  onBanAdd,
  onMemberRemove,
  onAuditLogEntry,
};
