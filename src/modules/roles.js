'use strict';

const { respond } = require('../lib/reply');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const logger = require('../lib/logger');

/** Normalise an emoji into the key we store in the database. */
function emojiKey(emoji) {
  if (typeof emoji === 'string') return emoji;
  return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

function addReactionRole({ guildId, channelId, messageId, emoji, roleId, mode = 'toggle' }) {
  store.db
    .prepare(
      `INSERT INTO reaction_roles (guild_id, message_id, channel_id, emoji, role_id, mode)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(message_id, emoji) DO UPDATE SET role_id = excluded.role_id, mode = excluded.mode`,
    )
    .run(guildId, messageId, channelId, emojiKey(emoji), roleId, mode);
}

function removeReactionRole(messageId, emoji) {
  return (
    store.db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?').run(messageId, emojiKey(emoji))
      .changes > 0
  );
}

function listReactionRoles(guildId) {
  return store.db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(guildId);
}

/** Shared handler for reaction add/remove. */
async function handleReaction(reaction, user, added) {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
  } catch {
    return;
  }

  const message = reaction.message;
  if (!message.guild) return;

  const key = emojiKey(reaction.emoji);
  const record =
    store.db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(message.id, key) ??
    store.db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(message.id, reaction.emoji.name);
  if (!record) return;

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  const role = message.guild.roles.cache.get(record.role_id);
  if (!member || !role) return;

  const me = message.guild.members.me;
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    logger.debug(`Reaction role ${role.id} is above the bot in ${message.guild.id}`);
    return;
  }

  try {
    if (record.mode === 'add' && !added) return;
    if (record.mode === 'remove' && !added) return;

    if (added) {
      if (record.mode === 'remove') await member.roles.remove(role, 'Reaction role');
      else await member.roles.add(role, 'Reaction role');
    } else if (record.mode === 'toggle') {
      await member.roles.remove(role, 'Reaction role removed');
    }
  } catch (error) {
    logger.debug(`Reaction role failed: ${error.message}`);
  }
}

/* ── button roles ────────────────────────────────────────────────────── */

async function handleButton(interaction) {
  const roleId = interaction.customId.slice('role:'.length);
  const theme = themeFor(interaction.guild.id);
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return respond(interaction, { embeds: [theme.error('That role no longer exists.')], ephemeral: true });

  const me = interaction.guild.members.me;
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return respond(interaction, {
      embeds: [theme.error(`I cannot assign **${role.name}** — my highest role is below it.`)],
      ephemeral: true,
    });
  }

  const member = interaction.member;
  try {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Button role');
      return respond(interaction, { embeds: [theme.success(`Removed **${role.name}**.`)], ephemeral: true });
    }
    await member.roles.add(role, 'Button role');
    return respond(interaction, { embeds: [theme.success(`Added **${role.name}**.`)], ephemeral: true });
  } catch (error) {
    return respond(interaction, { embeds: [theme.error(`That failed: ${error.message}`)], ephemeral: true });
  }
}

module.exports = { addReactionRole, removeReactionRole, listReactionRoles, handleReaction, handleButton, emojiKey };
