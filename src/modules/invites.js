'use strict';

const { Collection, PermissionsBitField } = require('discord.js');
const store = require('../lib/db');
const logger = require('../lib/logger');

/** Snapshot every invite so we can diff them on join. */
async function cacheGuild(client, guild) {
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return;
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return;
  client.caches.invites.set(guild.id, new Collection(invites.map((invite) => [invite.code, invite.uses ?? 0])));
}

async function cacheAll(client) {
  for (const guild of client.guilds.cache.values()) {
    await cacheGuild(client, guild).catch(() => {});
  }
  logger.debug(`Cached invites for ${client.caches.invites.size} guild(s)`);
}

/** Work out which invite gained a use, and credit the inviter. */
async function trackJoin(client, member) {
  const guild = member.guild;
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return null;

  const before = client.caches.invites.get(guild.id) ?? new Collection();
  const current = await guild.invites.fetch().catch(() => null);
  if (!current) return null;

  const used = current.find((invite) => (invite.uses ?? 0) > (before.get(invite.code) ?? 0));
  client.caches.invites.set(guild.id, new Collection(current.map((invite) => [invite.code, invite.uses ?? 0])));
  if (!used?.inviter) return null;

  store.db
    .prepare('INSERT OR REPLACE INTO invite_joins (guild_id, user_id, inviter_id, code) VALUES (?, ?, ?, ?)')
    .run(guild.id, member.id, used.inviter.id, used.code);

  store.db
    .prepare(
      `INSERT INTO invite_uses (guild_id, user_id, invites) VALUES (?, ?, 1)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET invites = invites + 1`,
    )
    .run(guild.id, used.inviter.id);

  return { inviter: used.inviter, code: used.code };
}

/** Count the leave against whoever invited them. */
function trackLeave(guild, userId) {
  const record = store.db.prepare('SELECT inviter_id FROM invite_joins WHERE guild_id = ? AND user_id = ?').get(guild.id, userId);
  if (!record?.inviter_id) return null;
  store.db
    .prepare(
      `INSERT INTO invite_uses (guild_id, user_id, leaves) VALUES (?, ?, 1)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET leaves = leaves + 1`,
    )
    .run(guild.id, record.inviter_id);
  return record.inviter_id;
}

function stats(guildId, userId) {
  const row = store.db.prepare('SELECT * FROM invite_uses WHERE guild_id = ? AND user_id = ?').get(guildId, userId) ?? {
    invites: 0,
    leaves: 0,
    bonus: 0,
  };
  return { ...row, total: (row.invites ?? 0) + (row.bonus ?? 0) - (row.leaves ?? 0) };
}

function leaderboard(guildId, limit = 100) {
  return store.db
    .prepare(
      `SELECT *, (invites + bonus - leaves) AS total FROM invite_uses
       WHERE guild_id = ? ORDER BY total DESC LIMIT ?`,
    )
    .all(guildId, limit);
}

function whoInvited(guildId, userId) {
  return store.db.prepare('SELECT * FROM invite_joins WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function addBonus(guildId, userId, amount) {
  store.db
    .prepare(
      `INSERT INTO invite_uses (guild_id, user_id, bonus) VALUES (?, ?, ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET bonus = bonus + excluded.bonus`,
    )
    .run(guildId, userId, amount);
  return stats(guildId, userId);
}

module.exports = { cacheGuild, cacheAll, trackJoin, trackLeave, stats, leaderboard, whoInvited, addBonus };
