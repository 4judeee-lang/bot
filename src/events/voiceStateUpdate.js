'use strict';

const store = require('../lib/db');
const voicemaster = require('../modules/voicemaster');
const { sendLog, isIgnored } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { formatDuration } = require('../lib/util');

module.exports = {
  name: 'voiceStateUpdate',
  async run(client, oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    if (!guild) return;

    await voicemaster.handleVoiceState(oldState, newState).catch(() => {});

    // Leave an empty voice channel rather than playing to nobody.
    const queue = client.music?.get(guild.id);
    if (queue && store.getSetting(guild.id, 'music.leaveOnEmpty') !== false) {
      const channel = guild.channels.cache.get(queue.voiceChannel.id);
      const listeners = channel?.members.filter((member) => !member.user.bot).size ?? 0;
      if (listeners === 0) {
        setTimeout(() => {
          const still = guild.channels.cache.get(queue.voiceChannel.id);
          const count = still?.members.filter((member) => !member.user.bot).size ?? 0;
          if (count === 0) queue.destroy();
        }, 30_000);
      }
    }

    // Voice session tracking, used by the voice-time leaderboard.
    const key = `${guild.id}:${(newState.member ?? oldState.member)?.id}`;
    const sessionStart = client.caches.voiceSessions.get(key);
    if (!oldState.channelId && newState.channelId) {
      client.caches.voiceSessions.set(key, Date.now());
    } else if (oldState.channelId && !newState.channelId) {
      if (sessionStart) {
        const seconds = Math.floor((Date.now() - sessionStart) / 1000);
        client.caches.voiceSessions.delete(key);
        store.db
          .prepare(
            `INSERT INTO levels (guild_id, user_id, voice_time) VALUES (?, ?, ?)
             ON CONFLICT(guild_id, user_id) DO UPDATE SET voice_time = voice_time + excluded.voice_time`,
          )
          .run(guild.id, oldState.member.id, seconds);
      }
    }

    if (isIgnored(guild, newState.channelId ?? oldState.channelId)) return;

    const theme = themeFor(guild.id);
    const member = newState.member ?? oldState.member;
    if (!member) return;

    let description = null;
    if (!oldState.channelId && newState.channelId) description = `joined ${newState.channel}`;
    else if (oldState.channelId && !newState.channelId) {
      description = `left ${oldState.channel}${
        sessionStart ? ` after ${formatDuration((Date.now() - sessionStart) / 1000)}` : ''
      }`;
    } else if (oldState.channelId !== newState.channelId) {
      description = `moved ${oldState.channel} → ${newState.channel}`;
    }
    if (!description) return;

    await sendLog(guild, 'voice', theme.base({
      author: { name: member.user.tag, iconURL: member.user.displayAvatarURL() },
      description: `${member} ${description}`,
      timestamp: true,
    }));
  },
};
