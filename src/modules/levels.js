'use strict';

const store = require('../lib/db');
const variables = require('../lib/variables');
const { randomInt, now } = require('../lib/util');
const logger = require('../lib/logger');

/**
 * XP curve: level N needs 5·N² + 50·N + 100 XP *for that level*.
 * Cumulative totals are what we store, so the maths below converts between
 * the two. Same curve MEE6 popularised — familiar numbers for server owners.
 */
function xpForLevel(level) {
  return 5 * level ** 2 + 50 * level + 100;
}

function totalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForLevel(i);
  return total;
}

function levelFromXp(xp) {
  let level = 0;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, into: remaining, needed: xpForLevel(level) };
}

const getRow = () => store.db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?');

function getUser(guildId, userId) {
  return (
    getRow().get(guildId, userId) ?? {
      guild_id: guildId,
      user_id: userId,
      xp: 0,
      level: 0,
      messages: 0,
      voice_time: 0,
      last_xp: 0,
    }
  );
}

function setXp(guildId, userId, xp) {
  const { level } = levelFromXp(xp);
  store.db
    .prepare(
      `INSERT INTO levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = excluded.xp, level = excluded.level`,
    )
    .run(guildId, userId, Math.max(0, Math.floor(xp)), level);
  return level;
}

function addXp(guildId, userId, amount) {
  const row = getUser(guildId, userId);
  const xp = Math.max(0, row.xp + amount);
  const before = row.level;
  const after = levelFromXp(xp).level;
  store.db
    .prepare(
      `INSERT INTO levels (guild_id, user_id, xp, level, messages, last_xp)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET
         xp = excluded.xp, level = excluded.level,
         messages = levels.messages + 1, last_xp = excluded.last_xp`,
    )
    .run(guildId, userId, xp, after, now());
  return { xp, before, after, levelledUp: after > before };
}

function rank(guildId, userId) {
  const row = store.db
    .prepare(
      `SELECT COUNT(*) + 1 AS position FROM levels
       WHERE guild_id = ? AND xp > (SELECT COALESCE(xp, 0) FROM levels WHERE guild_id = ? AND user_id = ?)`,
    )
    .get(guildId, guildId, userId);
  return row.position;
}

function leaderboard(guildId, limit = 100) {
  return store.db
    .prepare('SELECT * FROM levels WHERE guild_id = ? AND xp > 0 ORDER BY xp DESC LIMIT ?')
    .all(guildId, limit);
}

function rewardsFor(guildId, level) {
  return store.db
    .prepare('SELECT role_id, level FROM level_rewards WHERE guild_id = ? AND level <= ? ORDER BY level ASC')
    .all(guildId, level);
}

/** Hand out (and optionally take away) level roles. */
async function syncRoles(member, level) {
  const guildId = member.guild.id;
  const stack = store.getSetting(guildId, 'levels.stackRoles') !== false;
  const all = store.db.prepare('SELECT role_id, level FROM level_rewards WHERE guild_id = ?').all(guildId);
  if (!all.length) return [];

  const earned = all.filter((reward) => reward.level <= level).sort((a, b) => b.level - a.level);
  const keep = stack ? earned : earned.slice(0, 1);
  const keepIds = new Set(keep.map((reward) => reward.role_id));

  const toAdd = keep
    .map((reward) => member.guild.roles.cache.get(reward.role_id))
    .filter((role) => role && !member.roles.cache.has(role.id));

  const toRemove = all
    .filter((reward) => !keepIds.has(reward.role_id))
    .map((reward) => member.guild.roles.cache.get(reward.role_id))
    .filter((role) => role && member.roles.cache.has(role.id));

  try {
    if (toAdd.length) await member.roles.add(toAdd, 'Level reward');
    if (toRemove.length) await member.roles.remove(toRemove, 'Level reward replaced');
  } catch (error) {
    logger.debug(`Level role sync failed in ${guildId}: ${error.message}`);
  }
  return toAdd;
}

/** Called on every message. Returns quickly when levelling is off. */
async function handleMessage(message) {
  const guild = message.guild;
  if (!guild || message.author.bot) return;
  if (!store.getSetting(guild.id, 'levels.enabled')) return;

  const ignoredChannels = store.getSetting(guild.id, 'levels.ignoredChannels') ?? [];
  if (ignoredChannels.includes(message.channel.id) || ignoredChannels.includes(message.channel.parentId)) return;

  const ignoredRoles = store.getSetting(guild.id, 'levels.ignoredRoles') ?? [];
  if (message.member?.roles.cache.some((role) => ignoredRoles.includes(role.id))) return;

  const cooldown = store.getSetting(guild.id, 'levels.cooldown') ?? 60;
  const existing = getUser(guild.id, message.author.id);
  if (cooldown && now() - existing.last_xp < cooldown) return;

  const base = store.getSetting(guild.id, 'levels.xpPerMessage') ?? 15;
  const multiplier = store.getSetting(guild.id, 'levels.multiplier') ?? 1;
  const gained = Math.round((base + randomInt(0, Math.ceil(base * 0.4))) * multiplier);

  const result = addXp(guild.id, message.author.id, gained);
  if (!result.levelledUp) return;

  const granted = message.member ? await syncRoles(message.member, result.after) : [];

  const announce = store.getSetting(guild.id, 'levels.announce') ?? 'channel';
  if (announce === 'off') return;

  const template = store.getSetting(guild.id, 'levels.message') ?? '{user.mention} reached level **{level}**!';
  const payload = variables.render(template, {
    user: message.author,
    member: message.member,
    guild,
    channel: message.channel,
    extra: {
      level: result.after,
      xp: result.xp,
      'reward.roles': granted.map((role) => role.name).join(', ') || 'none',
    },
  });

  try {
    if (announce === 'dm') {
      await message.author.send(payload);
      return;
    }
    const targetId = store.getSetting(guild.id, 'levels.channel');
    const channel = targetId ? guild.channels.cache.get(targetId) : message.channel;
    if (channel?.isTextBased()) await channel.send({ ...payload, allowedMentions: { users: [message.author.id] } });
  } catch (error) {
    logger.debug(`Level-up announcement failed: ${error.message}`);
  }
}

module.exports = {
  xpForLevel,
  totalXpForLevel,
  levelFromXp,
  getUser,
  setXp,
  addXp,
  rank,
  leaderboard,
  rewardsFor,
  syncRoles,
  handleMessage,
};
