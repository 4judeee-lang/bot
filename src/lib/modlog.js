'use strict';

const store = require('./db');
const logger = require('./logger');

/**
 * Route a log embed to the right channel.
 * `type` is one of: moderation, messages, members, server, voice.
 * Falls back to the default log channel, then does nothing at all.
 */
async function sendLog(guild, type, payload) {
  if (!guild) return null;
  if (!store.getSetting(guild.id, 'logs.enabled')) return null;

  const specific = store.getSetting(guild.id, `logs.${type}`);
  const fallback = store.getSetting(guild.id, 'logs.channel');
  const channelId = specific || fallback;
  if (!channelId) return null;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased?.()) return null;

  const me = guild.members.me;
  if (me && !channel.permissionsFor(me)?.has('SendMessages')) return null;

  const options = payload?.embeds || payload?.content ? payload : { embeds: [payload] };
  return channel.send({ ...options, allowedMentions: { parse: [] } }).catch((error) => {
    logger.debug(`Failed to write ${type} log in ${guild.id}: ${error.message}`);
    return null;
  });
}

/** True when a channel should be excluded from message/voice logging. */
function isIgnored(guild, channelId) {
  if (!guild || !channelId) return false;
  const ignored = store.getSetting(guild.id, 'logs.ignoredChannels') ?? [];
  if (ignored.includes(channelId)) return true;
  const channel = guild.channels.cache.get(channelId);
  return Boolean(channel?.parentId && ignored.includes(channel.parentId));
}

module.exports = { sendLog, isIgnored };
