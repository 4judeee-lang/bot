'use strict';

/**
 * The small per-message features: autoresponders, sticky messages,
 * highlights and AFK handling. They all hang off `messageCreate`, so they
 * live together and each one bails out fast when it is not configured.
 */

const store = require('../lib/db');
const variables = require('../lib/variables');
const { themeFor } = require('../lib/embeds');
const { truncate, now, formatDuration } = require('../lib/util');
const logger = require('../lib/logger');

/* ── autoresponders ──────────────────────────────────────────────────── */

async function autorespond(message) {
  const rows = store.db.prepare('SELECT * FROM autoresponders WHERE guild_id = ?').all(message.guild.id);
  if (!rows.length) return false;

  const content = message.content.toLowerCase();
  const match = rows.find((row) => {
    const trigger = row.trigger.toLowerCase();
    return row.strict ? content === trigger : content.includes(trigger);
  });
  if (!match) return false;

  const payload = variables.render(match.response, {
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
  });

  try {
    if (match.delete_trigger) await message.delete().catch(() => {});
    if (match.reply && !match.delete_trigger) await message.reply({ ...payload, allowedMentions: { repliedUser: false } });
    else await message.channel.send(payload);
    return true;
  } catch (error) {
    logger.debug(`Autoresponder failed: ${error.message}`);
    return false;
  }
}

/* ── sticky messages ─────────────────────────────────────────────────── */

const stickyCooldown = new Map();

async function sticky(message) {
  const row = store.db.prepare('SELECT * FROM sticky_messages WHERE channel_id = ?').get(message.channel.id);
  if (!row) return;

  // Do not repost on every single message in a busy channel.
  const last = stickyCooldown.get(message.channel.id) ?? 0;
  if (Date.now() - last < 5000) return;
  stickyCooldown.set(message.channel.id, Date.now());

  try {
    if (row.last_message_id) {
      await message.channel.messages.fetch(row.last_message_id).then((m) => m.delete()).catch(() => {});
    }
    const payload = variables.render(row.content, { guild: message.guild, channel: message.channel });
    const posted = await message.channel.send(payload);
    store.db.prepare('UPDATE sticky_messages SET last_message_id = ? WHERE channel_id = ?').run(posted.id, message.channel.id);
  } catch (error) {
    logger.debug(`Sticky message failed: ${error.message}`);
  }
}

/* ── highlights ──────────────────────────────────────────────────────── */

async function highlights(message) {
  const rows = store.db.prepare('SELECT user_id, word FROM highlights WHERE guild_id = ?').all(message.guild.id);
  if (!rows.length) return;

  const content = message.content.toLowerCase();
  const notified = new Set();

  for (const row of rows) {
    if (row.user_id === message.author.id) continue;
    if (notified.has(row.user_id)) continue;
    if (!content.includes(row.word.toLowerCase())) continue;

    const member = await message.guild.members.fetch(row.user_id).catch(() => null);
    if (!member) continue;
    // Respect channel permissions — never leak a private channel.
    if (!message.channel.permissionsFor(member)?.has('ViewChannel')) continue;

    notified.add(row.user_id);
    const theme = themeFor(message.guild.id);
    member
      .send({
        embeds: [
          theme.base({
            author: { name: `${message.author.tag} in #${message.channel.name}`, iconURL: message.author.displayAvatarURL() },
            description: `${truncate(message.content, 500)}\n\n[Jump to message](${message.url})`,
            footer: { text: `Highlight: ${row.word}` },
            timestamp: true,
          }),
        ],
      })
      .catch(() => {});
  }
}

/* ── AFK ─────────────────────────────────────────────────────────────── */

function setAfk(guildId, userId, reason) {
  store.db
    .prepare(
      `INSERT INTO afk (guild_id, user_id, reason, since) VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = excluded.reason, since = excluded.since`,
    )
    .run(guildId, userId, reason, now());
}

function getAfk(guildId, userId) {
  return store.db.prepare('SELECT * FROM afk WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function clearAfk(guildId, userId) {
  store.db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

async function afk(message) {
  if (!store.getSetting(message.guild.id, 'fun.afkEnabled')) return;
  const theme = themeFor(message.guild.id);

  // Coming back.
  const own = getAfk(message.guild.id, message.author.id);
  if (own) {
    clearAfk(message.guild.id, message.author.id);
    const away = now() - own.since;
    const reply = await message.reply({
      embeds: [theme.success(`Welcome back — you were away for **${formatDuration(away)}**.`)],
      allowedMentions: { repliedUser: false },
    }).catch(() => null);
    if (reply) setTimeout(() => reply.delete().catch(() => {}), 8000);
  }

  // Mentioning someone who is away.
  for (const user of message.mentions.users.values()) {
    const record = getAfk(message.guild.id, user.id);
    if (!record) continue;
    await message
      .reply({
        embeds: [theme.info(`**${user.username}** is AFK: ${record.reason} — <t:${record.since}:R>`)],
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    break; // one notice per message is enough
  }
}

/* ── snipe cache ─────────────────────────────────────────────────────── */

function remember(cache, channelId, entry, limit = 10) {
  const list = cache.get(channelId) ?? [];
  list.unshift(entry);
  cache.set(channelId, list.slice(0, limit));
}

module.exports = { autorespond, sticky, highlights, afk, setAfk, getAfk, clearAfk, remember };
