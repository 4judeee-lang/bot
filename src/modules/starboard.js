'use strict';

const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const { truncate } = require('../lib/util');
const logger = require('../lib/logger');

/** How the star count is shown — more stars, bigger emoji. */
function badge(count, emoji) {
  if (count >= 20) return `🌟 **${count}**`;
  if (count >= 10) return `✨ **${count}**`;
  return `${emoji} **${count}**`;
}

function buildEmbed(message, count, emoji) {
  const theme = themeFor(message.guild.id);
  const embed = theme.base({
    color: 0xfacc15,
    author: {
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    },
    description: truncate(message.content || '', 3000),
    fields: [{ name: '​', value: `[Jump to message](${message.url})` }],
    timestamp: message.createdAt,
    footer: { text: `${badge(count, emoji).replace(/\*\*/g, '')} • #${message.channel.name}` },
  });

  const image = message.attachments.find((attachment) => attachment.contentType?.startsWith('image/'));
  if (image) embed.setImage(image.url);
  else if (message.embeds[0]?.image?.url) embed.setImage(message.embeds[0].image.url);

  return embed;
}

/**
 * Recount stars on a message and create, update or delete its starboard post.
 * Called from both reaction add and remove.
 */
async function sync(client, reaction) {
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch {
    return;
  }

  const message = reaction.message;
  const guild = message.guild;
  if (!guild || message.author?.bot) return;
  if (!store.getSetting(guild.id, 'starboard.enabled')) return;

  const emoji = store.getSetting(guild.id, 'starboard.emoji') ?? '⭐';
  const reactionEmoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
  if (reactionEmoji !== emoji && reaction.emoji.name !== emoji) return;

  const ignored = store.getSetting(guild.id, 'starboard.ignoredChannels') ?? [];
  if (ignored.includes(message.channel.id) || ignored.includes(message.channel.parentId)) return;

  const boardId = store.getSetting(guild.id, 'starboard.channel');
  const board = boardId ? guild.channels.cache.get(boardId) : null;
  if (!board?.isTextBased()) return;
  if (message.channel.id === board.id) return;

  let count = reaction.count ?? 0;
  if (!store.getSetting(guild.id, 'starboard.selfStar')) {
    const users = await reaction.users.fetch().catch(() => null);
    if (users?.has(message.author.id)) count -= 1;
  }

  const threshold = store.getSetting(guild.id, 'starboard.threshold') ?? 3;
  const entry = store.db.prepare('SELECT * FROM starboard_entries WHERE message_id = ?').get(message.id);

  if (count < threshold) {
    // Dropped below the bar — remove the post so the board stays honest.
    if (entry?.star_message_id) {
      await board.messages.fetch(entry.star_message_id).then((m) => m.delete()).catch(() => {});
      store.db.prepare('DELETE FROM starboard_entries WHERE message_id = ?').run(message.id);
    }
    return;
  }

  const payload = {
    content: `${badge(count, emoji)} ${message.channel}`,
    embeds: [buildEmbed(message, count, emoji)],
  };

  try {
    if (entry?.star_message_id) {
      const existing = await board.messages.fetch(entry.star_message_id).catch(() => null);
      if (existing) {
        await existing.edit(payload);
        store.db.prepare('UPDATE starboard_entries SET stars = ? WHERE message_id = ?').run(count, message.id);
        return;
      }
    }
    const posted = await board.send(payload);
    store.db
      .prepare(
        `INSERT INTO starboard_entries (guild_id, message_id, channel_id, star_message_id, stars)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(message_id) DO UPDATE SET star_message_id = excluded.star_message_id, stars = excluded.stars`,
      )
      .run(guild.id, message.id, message.channel.id, posted.id, count);
  } catch (error) {
    logger.debug(`Starboard sync failed in ${guild.id}: ${error.message}`);
  }
}

module.exports = { sync };
