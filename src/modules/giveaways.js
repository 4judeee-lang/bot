'use strict';

const { respond } = require('../lib/reply');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const { shuffle, now, formatNumber } = require('../lib/util');
const emojis = require('../lib/emojis');
const logger = require('../lib/logger');

function components(disabled = false, count = 0) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway:enter')
        .setLabel(count ? `Enter (${formatNumber(count)})` : 'Enter')
        .setEmoji(emojis.gift)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    ),
  ];
}

function entryCount(giveawayId) {
  return store.db.prepare('SELECT COUNT(*) AS total FROM giveaway_entries WHERE giveaway_id = ?').get(giveawayId).total;
}

function buildEmbed(guild, giveaway, { ended = false, winners = [] } = {}) {
  const theme = themeFor(guild.id);
  const fields = [
    { name: 'Winners', value: String(giveaway.winners), inline: true },
    { name: 'Entries', value: formatNumber(entryCount(giveaway.id)), inline: true },
    { name: 'Hosted by', value: `<@${giveaway.host_id}>`, inline: true },
  ];
  if (giveaway.required_role) {
    fields.push({ name: 'Requirement', value: `<@&${giveaway.required_role}>`, inline: true });
  }

  return theme.base({
    color: ended ? theme.errorColor : theme.primary,
    title: `${emojis.gift} ${giveaway.prize}`,
    description: ended
      ? winners.length
        ? `Ended ${`<t:${giveaway.ends_at}:R>`}\n\n**Winners:** ${winners.map((id) => `<@${id}>`).join(', ')}`
        : `Ended ${`<t:${giveaway.ends_at}:R>`}\n\nNobody entered. 😔`
      : `Ends <t:${giveaway.ends_at}:R> — <t:${giveaway.ends_at}:f>\nPress the button below to enter.`,
    fields,
    timestamp: true,
  });
}

async function create(ctx, { prize, seconds, winners = 1, requiredRole = null, channel }) {
  const endsAt = now() + seconds;
  const target = channel ?? ctx.channel;

  const info = store.db
    .prepare(
      `INSERT INTO giveaways (guild_id, channel_id, prize, winners, host_id, ends_at, required_role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ctx.guild.id, target.id, prize, winners, ctx.user.id, endsAt, requiredRole);

  const giveaway = store.db.prepare('SELECT * FROM giveaways WHERE id = ?').get(info.lastInsertRowid);
  const message = await target.send({
    embeds: [buildEmbed(ctx.guild, giveaway)],
    components: components(false, 0),
  });

  store.db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(message.id, giveaway.id);
  return { giveaway, message };
}

async function enter(interaction) {
  const theme = themeFor(interaction.guild.id);
  const giveaway = store.db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(interaction.message.id);
  if (!giveaway || giveaway.ended) {
    return respond(interaction, { embeds: [theme.error('This giveaway has ended.')], ephemeral: true });
  }

  if (giveaway.required_role && !interaction.member.roles.cache.has(giveaway.required_role)) {
    return respond(interaction, {
      embeds: [theme.error(`You need <@&${giveaway.required_role}> to enter this giveaway.`)],
      ephemeral: true,
    });
  }

  const existing = store.db
    .prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?')
    .get(giveaway.id, interaction.user.id);

  if (existing) {
    store.db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveaway.id, interaction.user.id);
    await refresh(interaction.guild, giveaway);
    return respond(interaction, { embeds: [theme.warn('Your entry has been removed.')], ephemeral: true });
  }

  store.db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveaway.id, interaction.user.id);
  await refresh(interaction.guild, giveaway);
  return respond(interaction, {
    embeds: [theme.success(`You are entered into **${giveaway.prize}**. Good luck!`)],
    ephemeral: true,
  });
}

async function refresh(guild, giveaway) {
  const channel = guild.channels.cache.get(giveaway.channel_id);
  const message = await channel?.messages.fetch(giveaway.message_id).catch(() => null);
  if (!message) return;
  await message
    .edit({ embeds: [buildEmbed(guild, giveaway)], components: components(false, entryCount(giveaway.id)) })
    .catch(() => {});
}

function pickWinners(giveawayId, count, exclude = []) {
  const entries = store.db
    .prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?')
    .all(giveawayId)
    .map((row) => row.user_id)
    .filter((id) => !exclude.includes(id));
  return shuffle(entries).slice(0, count);
}

async function end(client, giveaway, { rerollBy = null } = {}) {
  const guild = client.guilds.cache.get(giveaway.guild_id);
  if (!guild) return [];

  const winners = pickWinners(giveaway.id, giveaway.winners);
  store.db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);

  const channel = guild.channels.cache.get(giveaway.channel_id);
  if (!channel?.isTextBased()) return winners;

  const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  if (message) {
    await message
      .edit({ embeds: [buildEmbed(guild, giveaway, { ended: true, winners })], components: components(true, entryCount(giveaway.id)) })
      .catch(() => {});
  }

  const theme = themeFor(guild.id);
  await channel
    .send({
      content: winners.length ? winners.map((id) => `<@${id}>`).join(' ') : undefined,
      embeds: [
        theme.base({
          color: winners.length ? theme.successColor : theme.errorColor,
          description: winners.length
            ? `${emojis.gift} ${rerollBy ? 'Rerolled' : 'Congratulations'}! You won **${giveaway.prize}**.${
                message ? `\n[Jump to giveaway](${message.url})` : ''
              }`
            : `${emojis.gift} Nobody entered **${giveaway.prize}**.`,
        }),
      ],
      allowedMentions: { users: winners },
    })
    .catch(() => {});

  return winners;
}

/** Called by the scheduler once a minute. */
async function tick(client) {
  const due = store.db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?').all(now());
  for (const giveaway of due) {
    try {
      await end(client, giveaway);
    } catch (error) {
      logger.debug(`Giveaway ${giveaway.id} failed to end: ${error.message}`);
      store.db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);
    }
  }
}

module.exports = { create, enter, end, tick, pickWinners, entryCount, buildEmbed, components };
