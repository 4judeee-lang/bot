'use strict';

const { PermissionsBitField } = require('discord.js');
const store = require('../lib/db');
const { sendLog } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { truncate } = require('../lib/util');
const logger = require('../lib/logger');

const INVITE_PATTERN = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-z0-9-_]+/i;
const LINK_PATTERN = /https?:\/\/[^\s]+/i;
const EMOJI_PATTERN = /<a?:\w+:\d+>|\p{Extended_Pictographic}/gu;

/** Members who can moderate are never filtered. */
function isExempt(message) {
  const guild = message.guild;
  if (message.author.bot) return true;
  if (message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;

  const exemptRoles = store.getSetting(guild.id, 'automod.exemptRoles') ?? [];
  if (message.member?.roles.cache.some((role) => exemptRoles.includes(role.id))) return true;

  const exemptChannels = store.getSetting(guild.id, 'automod.exemptChannels') ?? [];
  return exemptChannels.includes(message.channel.id) || exemptChannels.includes(message.channel.parentId);
}

/** Returns the name of the first rule the message breaks, or null. */
function inspect(message, client) {
  const guild = message.guild;
  const content = message.content ?? '';
  const setting = (key) => store.getSetting(guild.id, key);

  if (setting('automod.invites') && INVITE_PATTERN.test(content)) return 'advertising';
  if (setting('automod.links') && LINK_PATTERN.test(content)) return 'links';

  const maxMentions = setting('automod.mentions') ?? 0;
  if (maxMentions > 0) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions > maxMentions) return 'mass mentions';
  }

  const maxEmojis = setting('automod.emojis') ?? 0;
  if (maxEmojis > 0) {
    const count = (content.match(EMOJI_PATTERN) ?? []).length;
    if (count > maxEmojis) return 'emoji spam';
  }

  if (setting('automod.caps')) {
    const letters = content.replace(/[^a-z]/gi, '');
    if (letters.length >= 8) {
      const upper = (content.match(/[A-Z]/g) ?? []).length;
      const percent = (upper / letters.length) * 100;
      if (percent >= (setting('automod.capsThreshold') ?? 70)) return 'excessive caps';
    }
  }

  const words = setting('automod.words') ?? [];
  if (words.length) {
    const haystack = content.toLowerCase();
    const hit = words.find((word) => haystack.includes(String(word).toLowerCase()));
    if (hit) return 'blocked word';
  }

  if (setting('automod.spam')) {
    const key = `${guild.id}:${message.author.id}`;
    const stamps = (client.caches.spam.get(key) ?? []).filter((time) => Date.now() - time < 5000);
    stamps.push(Date.now());
    client.caches.spam.set(key, stamps);
    if (stamps.length >= (setting('automod.spamThreshold') ?? 5)) {
      client.caches.spam.delete(key);
      return 'spam';
    }
  }

  return null;
}

async function punish(message, rule) {
  const guild = message.guild;
  const action = store.getSetting(guild.id, 'automod.action') ?? 'delete';
  const member = message.member;
  const reason = `Automod: ${rule}`;

  await message.delete().catch(() => {});

  try {
    switch (action) {
      case 'warn':
        store.addCase({
          guildId: guild.id,
          type: 'warn',
          userId: message.author.id,
          moderatorId: message.client.user.id,
          reason,
        });
        break;
      case 'timeout': {
        const seconds = store.getSetting(guild.id, 'automod.timeoutDuration') ?? 300;
        if (member?.moderatable) await member.timeout(seconds * 1000, reason);
        store.addCase({
          guildId: guild.id,
          type: 'timeout',
          userId: message.author.id,
          moderatorId: message.client.user.id,
          reason,
          duration: seconds,
        });
        break;
      }
      case 'kick':
        if (member?.kickable) await member.kick(reason);
        break;
      case 'ban':
        if (member?.bannable) await member.ban({ reason, deleteMessageSeconds: 3600 });
        break;
      default:
        break;
    }
  } catch (error) {
    logger.debug(`Automod punishment failed in ${guild.id}: ${error.message}`);
  }

  const theme = themeFor(guild.id);
  await sendLog(guild, 'moderation', theme.base({
    color: theme.warnColor,
    author: { name: `Automod • ${rule}`, iconURL: message.author.displayAvatarURL() },
    description: truncate(message.content || '*no text content*', 1000),
    fields: [
      { name: 'Member', value: `${message.author} \`${message.author.id}\``, inline: true },
      { name: 'Channel', value: `${message.channel}`, inline: true },
      { name: 'Action', value: action, inline: true },
    ],
    timestamp: true,
  }));

  // A short-lived notice so the member knows why their message vanished.
  const notice = await message.channel
    .send({ embeds: [theme.warn(`${message.author}, your message was removed — **${rule}**.`)] })
    .catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), 6000);
}

async function handleMessage(client, message) {
  if (!message.guild || !message.content) return false;
  if (!store.getSetting(message.guild.id, 'automod.enabled')) return false;
  if (isExempt(message)) return false;

  const me = message.guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return false;

  const rule = inspect(message, client);
  if (!rule) return false;

  await punish(message, rule);
  return true;
}

module.exports = { handleMessage, inspect, isExempt };
