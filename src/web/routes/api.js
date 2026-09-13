'use strict';

const express = require('express');
const { ChannelType } = require('discord.js');
const store = require('../../lib/db');
const { SETTINGS, coerce } = require('../../lib/settingsSchema');
const variables = require('../../lib/variables');
const logger = require('../../lib/logger');

const router = express.Router();

/* ── guards ──────────────────────────────────────────────────────────── */

function requireAuth(request, response, next) {
  if (!request.session.user) return response.status(401).json({ error: 'Not signed in' });
  return next();
}

/** Reject anything without the session's CSRF token. */
function requireCsrf(request, response, next) {
  if (request.method === 'GET') return next();
  const token = request.get('x-csrf-token');
  if (!token || token !== request.session.csrf) return response.status(403).json({ error: 'Invalid CSRF token' });
  return next();
}

/**
 * The user must have Manage Server, and the bot must actually be in the guild.
 * Both checks matter: the OAuth guild list is not proof the bot can see it.
 */
function requireGuild(request, response, next) {
  const guildId = request.params.guildId;
  const allowed = (request.session.guilds ?? []).some((guild) => guild.id === guildId);
  if (!allowed) return response.status(403).json({ error: 'You do not manage that server' });

  const guild = request.app.locals.bot?.guilds.cache.get(guildId);
  if (!guild) return response.status(404).json({ error: 'The bot is not in that server' });

  request.guild = guild;
  return next();
}

const simpleRateLimit = (() => {
  const hits = new Map();
  return (limit, windowMs) => (request, response, next) => {
    const key = `${request.session.user?.id ?? request.ip}:${request.baseUrl}`;
    const record = hits.get(key) ?? { count: 0, reset: Date.now() + windowMs };
    if (Date.now() > record.reset) {
      record.count = 0;
      record.reset = Date.now() + windowMs;
    }
    record.count += 1;
    hits.set(key, record);
    if (record.count > limit) {
      return response.status(429).json({ error: 'Slow down — too many requests.' });
    }
    return next();
  };
})();

router.use(requireCsrf);
router.use(simpleRateLimit(240, 60_000));

/* ── guild data ──────────────────────────────────────────────────────── */

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const VOICE_TYPES = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

function serialiseGuild(guild) {
  const me = guild.members.me;

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 128 }),
    memberCount: guild.memberCount,
    prefix: store.getPrefix(guild.id),
    channels: [...guild.channels.cache.values()]
      .filter((channel) => [...TEXT_TYPES, ...VOICE_TYPES, ChannelType.GuildCategory].includes(channel.type))
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: VOICE_TYPES.includes(channel.type) ? 'voice' : channel.type === ChannelType.GuildCategory ? 'category' : 'text',
        parent: channel.parent?.name ?? null,
      })),
    roles: [...guild.roles.cache.values()]
      .filter((role) => role.id !== guild.id && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor === '#000000' ? null : role.hexColor,
        // Roles above the bot cannot be assigned — the UI greys these out.
        assignable: me ? me.roles.highest.comparePositionTo(role) > 0 : false,
      })),
  };
}

router.get('/guilds/:guildId', requireAuth, requireGuild, (request, response) => {
  response.json({
    guild: serialiseGuild(request.guild),
    settings: store.getSettings(request.guild.id),
  });
});

/* ── settings ────────────────────────────────────────────────────────── */

router.get('/guilds/:guildId/settings', requireAuth, requireGuild, (request, response) => {
  response.json({ settings: store.getSettings(request.guild.id) });
});

router.patch('/guilds/:guildId/settings', requireAuth, requireGuild, (request, response) => {
  const patch = request.body ?? {};
  if (typeof patch !== 'object' || Array.isArray(patch)) return response.status(400).json({ error: 'Expected an object' });

  const accepted = {};
  const errors = {};

  for (const [key, raw] of Object.entries(patch)) {
    if (!SETTINGS[key]) {
      errors[key] = 'Unknown setting';
      continue;
    }
    const result = coerce(key, raw);
    if (!result.ok) {
      errors[key] = result.error;
      continue;
    }

    // A channel or role that no longer exists would silently break a module.
    const meta = SETTINGS[key];
    if (['channel', 'category'].includes(meta.type) && result.value && !request.guild.channels.cache.has(result.value)) {
      errors[key] = 'That channel no longer exists';
      continue;
    }
    if (meta.type === 'role' && result.value && !request.guild.roles.cache.has(result.value)) {
      errors[key] = 'That role no longer exists';
      continue;
    }
    if (meta.type === 'channels') {
      result.value = result.value.filter((id) => request.guild.channels.cache.has(id));
    }
    if (meta.type === 'roles') {
      result.value = result.value.filter((id) => request.guild.roles.cache.has(id));
    }

    accepted[key] = result.value;
  }

  if (Object.keys(accepted).length) {
    store.setSettings(request.guild.id, accepted);
    logger.web(`${request.session.user.username} updated ${Object.keys(accepted).length} setting(s) in ${request.guild.name}`);
  }

  response.json({
    saved: Object.keys(accepted),
    errors,
    settings: store.getSettings(request.guild.id),
  });
});

router.post('/guilds/:guildId/prefix', requireAuth, requireGuild, (request, response) => {
  const prefix = String(request.body?.prefix ?? '').trim();
  if (!prefix || prefix.length > 5) return response.status(400).json({ error: 'Prefix must be 1-5 characters' });

  store.setPrefix(request.guild.id, prefix);
  response.json({ prefix });
});

router.post('/guilds/:guildId/reset', requireAuth, requireGuild, (request, response) => {
  const category = request.body?.category;

  if (category) {
    const keys = Object.keys(SETTINGS).filter((key) => SETTINGS[key].category === category);
    if (!keys.length) return response.status(400).json({ error: 'Unknown category' });
    store.setSettings(request.guild.id, Object.fromEntries(keys.map((key) => [key, null])));
  } else {
    store.resetSettings(request.guild.id);
  }

  response.json({ settings: store.getSettings(request.guild.id) });
});

/* ── stats & extras ──────────────────────────────────────────────────── */

router.get('/guilds/:guildId/stats', requireAuth, requireGuild, (request, response) => {
  const guildId = request.guild.id;
  const count = (sql, ...params) => store.db.prepare(sql).get(guildId, ...params).total;

  response.json({
    members: request.guild.memberCount,
    cases: count('SELECT COUNT(*) AS total FROM cases WHERE guild_id = ?'),
    activeCases: count('SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND active = 1'),
    rankedMembers: count('SELECT COUNT(*) AS total FROM levels WHERE guild_id = ? AND xp > 0'),
    economyAccounts: count('SELECT COUNT(*) AS total FROM economy WHERE guild_id = ?'),
    tags: count('SELECT COUNT(*) AS total FROM tags WHERE guild_id = ?'),
    giveaways: count('SELECT COUNT(*) AS total FROM giveaways WHERE guild_id = ? AND ended = 0'),
    openTickets: count('SELECT COUNT(*) AS total FROM tickets WHERE guild_id = ? AND open = 1'),
    autoresponders: count('SELECT COUNT(*) AS total FROM autoresponders WHERE guild_id = ?'),
    levelRewards: store.db.prepare('SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC').all(guildId),
    topMembers: store.db
      .prepare('SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 5')
      .all(guildId)
      .map((row) => {
        const member = request.guild.members.cache.get(row.user_id);
        return { ...row, name: member?.user.username ?? row.user_id, avatar: member?.user.displayAvatarURL({ size: 64 }) ?? null };
      }),
    recentCases: store.db
      .prepare('SELECT case_number, type, user_id, reason, created_at FROM cases WHERE guild_id = ? ORDER BY created_at DESC LIMIT 5')
      .all(guildId)
      .map((row) => {
        const member = request.guild.members.cache.get(row.user_id);
        return { ...row, name: member?.user.username ?? row.user_id };
      }),
  });
});

/* ── level rewards ───────────────────────────────────────────────────── */

router.post('/guilds/:guildId/level-rewards', requireAuth, requireGuild, (request, response) => {
  const level = Number(request.body?.level);
  const roleId = String(request.body?.roleId ?? '');

  if (!Number.isInteger(level) || level < 1 || level > 1000) return response.status(400).json({ error: 'Level must be 1-1000' });
  const role = request.guild.roles.cache.get(roleId);
  if (!role) return response.status(400).json({ error: 'That role does not exist' });

  const me = request.guild.members.me;
  if (me && me.roles.highest.comparePositionTo(role) <= 0) {
    return response.status(400).json({ error: `I cannot assign ${role.name} — it is above my highest role` });
  }

  store.db.prepare('INSERT OR REPLACE INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)').run(request.guild.id, level, roleId);
  response.json({ rewards: store.db.prepare('SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC').all(request.guild.id) });
});

router.delete('/guilds/:guildId/level-rewards/:level', requireAuth, requireGuild, (request, response) => {
  store.db.prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?').run(request.guild.id, Number(request.params.level));
  response.json({ rewards: store.db.prepare('SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC').all(request.guild.id) });
});

/* ── autoresponders ──────────────────────────────────────────────────── */

router.get('/guilds/:guildId/autoresponders', requireAuth, requireGuild, (request, response) => {
  response.json({ items: store.db.prepare('SELECT * FROM autoresponders WHERE guild_id = ?').all(request.guild.id) });
});

router.post('/guilds/:guildId/autoresponders', requireAuth, requireGuild, (request, response) => {
  const trigger = String(request.body?.trigger ?? '').trim().toLowerCase();
  const reply = String(request.body?.response ?? '').trim();
  if (!trigger || !reply) return response.status(400).json({ error: 'Both a trigger and a response are required' });
  if (trigger.length > 200 || reply.length > 2000) return response.status(400).json({ error: 'That is too long' });

  store.db
    .prepare('INSERT INTO autoresponders (guild_id, trigger, response, strict) VALUES (?, ?, ?, ?)')
    .run(request.guild.id, trigger, reply, request.body?.strict ? 1 : 0);

  response.json({ items: store.db.prepare('SELECT * FROM autoresponders WHERE guild_id = ?').all(request.guild.id) });
});

router.delete('/guilds/:guildId/autoresponders/:id', requireAuth, requireGuild, (request, response) => {
  store.db.prepare('DELETE FROM autoresponders WHERE guild_id = ? AND id = ?').run(request.guild.id, Number(request.params.id));
  response.json({ items: store.db.prepare('SELECT * FROM autoresponders WHERE guild_id = ?').all(request.guild.id) });
});

/* ── embed preview ───────────────────────────────────────────────────── */

/**
 * Renders a template exactly as the bot would, so the dashboard preview is
 * never a lookalike — it is the same code path.
 */
router.post('/guilds/:guildId/preview', requireAuth, requireGuild, (request, response) => {
  const template = String(request.body?.template ?? '');
  if (template.length > 4000) return response.status(400).json({ error: 'Template is too long' });

  const member = request.guild.members.cache.get(request.session.user.id);
  const payload = variables.render(template, {
    user: member?.user ?? {
      id: request.session.user.id,
      username: request.session.user.username,
      tag: request.session.user.username,
      displayAvatarURL: () => request.session.user.avatar,
      createdTimestamp: Date.now(),
    },
    member,
    guild: request.guild,
    channel: request.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText),
    extra: { level: 5, xp: 1234, 'inviter.name': 'someone' },
  });

  response.json({
    content: payload.content ?? '',
    embed: payload.embeds?.[0]?.toJSON?.() ?? payload.embeds?.[0] ?? null,
  });
});

module.exports = router;
