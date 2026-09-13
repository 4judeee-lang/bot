'use strict';

const store = require('../../lib/db');
const { LOOP_MODES } = require('../../modules/music');
const { formatTimestamp, formatDuration, truncate, progressBar } = require('../../lib/util');
const emojis = require('../../lib/emojis');

/**
 * Shared checks. Nearly every music command needs the same three things:
 * the member is in voice, the bot is in the same channel, and a queue exists.
 */
function requireVoice(ctx) {
  const channel = ctx.member?.voice?.channel;
  if (!channel) return { ok: false, reason: 'Join a voice channel first.' };
  const mine = ctx.guild.members.me.voice.channel;
  if (mine && mine.id !== channel.id) return { ok: false, reason: `I am already playing in **${mine.name}**.` };
  return { ok: true, channel };
}

function requireQueue(ctx) {
  const queue = ctx.client.music?.get(ctx.guild.id);
  if (!queue || !queue.current) return { ok: false, reason: 'Nothing is playing right now.' };
  const voice = requireVoice(ctx);
  if (!voice.ok) return voice;
  return { ok: true, queue };
}

/** DJ role gate: with more than one listener, restrict the disruptive commands. */
function canControl(ctx, queue) {
  const djRole = store.getSetting(ctx.guild.id, 'music.djRole');
  if (!djRole) return true;
  if (ctx.member.permissions.has('ManageGuild')) return true;
  if (ctx.member.roles.cache.has(djRole)) return true;
  if (queue.current?.requestedBy?.id === ctx.user.id) return true;
  const listeners = queue.voiceChannel.members.filter((member) => !member.user.bot).size;
  return listeners <= 1;
}

module.exports = [
  {
    name: 'play',
    aliases: ['p'],
    category: 'Music',
    description: 'Play a track, or add it to the queue.',
    details:
      'Accepts a YouTube link, a YouTube playlist, a Spotify track/album/playlist link, or plain search terms. ' +
      'Spotify links are matched to the closest YouTube result, since Spotify does not allow direct streaming.',
    usage: '<song or link>',
    examples: ['play never gonna give you up', 'play https://youtu.be/dQw4w9WgXcQ'],
    botPermissions: ['Connect', 'Speak'],
    args: [{ name: 'query', type: 'rest', required: true, description: 'search terms or a link' }],
    cooldown: 3,
    slash: true,
    async run(ctx) {
      if (!ctx.client.music?.available) return ctx.error('Music support is not installed on this bot.');

      const voice = requireVoice(ctx);
      if (!voice.ok) return ctx.error(voice.reason);

      const permissions = voice.channel.permissionsFor(ctx.guild.members.me);
      if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return ctx.error(`I cannot join or speak in **${voice.channel.name}**.`);
      }

      await ctx.defer();

      let result;
      try {
        result = await ctx.client.music.resolve(ctx.args.query, ctx.user);
      } catch (error) {
        return ctx.error(error.friendly ? error.message : `Could not find that — ${error.message}`);
      }
      if (!result.tracks.length) return ctx.error('Nothing playable came back from that search.');

      const queue = await ctx.client.music.create(ctx.guild, voice.channel, ctx.channel);
      const wasIdle = !queue.current;

      let added = 0;
      for (const track of result.tracks) {
        try {
          queue.add(track);
          added += 1;
        } catch (error) {
          break; // queue full
        }
      }

      await queue.start();

      if (result.playlist) {
        return ctx.success(`Queued **${added}** track(s) from **${truncate(result.playlist, 60)}**.`);
      }
      if (wasIdle) return undefined; // the now-playing card covers it

      const track = result.tracks[0];
      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: 'Added to queue' },
            title: truncate(track.title, 250),
            description: `by **${track.author}** ${emojis.dot} \`${track.formattedDuration}\` ${emojis.dot} position **${queue.tracks.length}**`,
            thumbnail: track.thumbnail,
          }).setURL(track.url),
        ],
      });
    },
  },

  {
    name: 'search',
    category: 'Music',
    description: 'Search YouTube and pick from the results.',
    usage: '<query>',
    examples: ['search lofi beats'],
    botPermissions: ['Connect', 'Speak'],
    args: [{ name: 'query', type: 'rest', required: true, description: 'what to search for' }],
    cooldown: 5,
    async run(ctx) {
      if (!ctx.client.music?.available) return ctx.error('Music support is not installed on this bot.');
      const voice = requireVoice(ctx);
      if (!voice.ok) return ctx.error(voice.reason);

      await ctx.defer();
      const results = await ctx.client.music.search(ctx.args.query, 10);
      if (!results.length) return ctx.error('No results.');

      const embed = ctx.embed({
        title: `${emojis.search} Results for "${truncate(ctx.args.query, 60)}"`,
        description: results
          .map((track, index) => `\`${index + 1}\` [${truncate(track.title, 60)}](${track.url}) — \`${formatTimestamp(track.durationInSec)}\``)
          .join('\n'),
        footer: { text: 'Reply with a number within 30 seconds, or "cancel"' },
      });
      await ctx.send({ embeds: [embed] });

      const collected = await ctx.channel
        .awaitMessages({
          filter: (message) => message.author.id === ctx.user.id && /^(\d{1,2}|cancel)$/i.test(message.content),
          max: 1,
          time: 30_000,
        })
        .catch(() => null);

      const choice = collected?.first()?.content;
      if (!choice || choice.toLowerCase() === 'cancel') return ctx.info('Search cancelled.');

      const picked = results[Number(choice) - 1];
      if (!picked) return ctx.error('That was not one of the options.');

      const queue = await ctx.client.music.create(ctx.guild, voice.channel, ctx.channel);
      const { Track } = require('../../modules/music');
      queue.add(
        new Track({
          title: picked.title,
          url: picked.url,
          duration: picked.durationInSec,
          thumbnail: picked.thumbnails?.[0]?.url,
          author: picked.channel?.name,
          requestedBy: ctx.user,
        }),
      );
      await queue.start();
      return ctx.success(`Queued **${truncate(picked.title, 80)}**.`);
    },
  },

  {
    name: 'skip',
    aliases: ['sk', 'next'],
    category: 'Music',
    description: 'Skip the current track.',
    examples: ['skip'],
    slash: true,
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (!canControl(ctx, state.queue)) return ctx.error('You need the DJ role to skip while others are listening.');

      const skipped = state.queue.skip();
      return ctx.success(`Skipped **${truncate(skipped?.title ?? 'the track', 80)}**.`);
    },
  },

  {
    name: 'stop',
    aliases: ['disconnect', 'dc'],
    category: 'Music',
    description: 'Stop playing, clear the queue and leave the voice channel.',
    examples: ['stop'],
    slash: true,
    async run(ctx) {
      const queue = ctx.client.music?.get(ctx.guild.id);
      if (!queue) return ctx.error('I am not playing anything.');
      if (!canControl(ctx, queue)) return ctx.error('You need the DJ role to stop playback while others are listening.');

      queue.destroy();
      return ctx.success('Stopped and left the channel.');
    },
  },

  {
    name: 'pause',
    category: 'Music',
    description: 'Pause playback.',
    examples: ['pause'],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (state.queue.paused) return ctx.error('Already paused — use `resume`.');

      state.queue.pause();
      return ctx.success(`${emojis.pause} Paused.`);
    },
  },

  {
    name: 'resume',
    aliases: ['unpause'],
    category: 'Music',
    description: 'Resume playback.',
    examples: ['resume'],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (!state.queue.paused) return ctx.error('Nothing is paused.');

      state.queue.resume();
      return ctx.success(`${emojis.play} Resumed.`);
    },
  },

  {
    name: 'queue',
    aliases: ['q'],
    category: 'Music',
    description: 'Show what is playing and what is coming up.',
    examples: ['queue'],
    slash: true,
    async run(ctx) {
      const queue = ctx.client.music?.get(ctx.guild.id);
      if (!queue?.current) return ctx.error('Nothing is playing right now.');

      const header =
        `${emojis.disc} **${truncate(queue.current.title, 70)}**\n` +
        `${progressBar(queue.position, queue.current.duration)} \`${formatTimestamp(queue.position)} / ${queue.current.formattedDuration}\`\n` +
        `requested by ${queue.current.requestedBy}\n`;

      if (!queue.tracks.length) {
        return ctx.send({
          embeds: [
            ctx.embed({
              title: 'Queue',
              description: `${header}\n*Nothing queued after this.*`,
              thumbnail: queue.current.thumbnail,
              footer: { text: `volume ${queue.volume}% • loop: ${queue.loop}` },
            }),
          ],
        });
      }

      return ctx.paginateRows(
        queue.tracks.map((track) => `[${truncate(track.title, 55)}](${track.url}) \`${track.formattedDuration}\` — ${track.requestedBy}`),
        {
          perPage: 10,
          title: 'Queue',
          description: `${header}\n**Up next — ${queue.tracks.length} track(s), ${formatDuration(queue.totalDuration)}**`,
          thumbnail: queue.current.thumbnail,
        },
      );
    },
  },

  {
    name: 'nowplaying',
    aliases: ['np', 'current'],
    category: 'Music',
    description: 'Show the track that is playing right now.',
    examples: ['nowplaying'],
    slash: true,
    async run(ctx) {
      const queue = ctx.client.music?.get(ctx.guild.id);
      if (!queue?.current) return ctx.error('Nothing is playing right now.');

      const track = queue.current;
      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: 'Now playing' },
            title: truncate(track.title, 250),
            description:
              `by **${track.author}**\n\n` +
              `${progressBar(queue.position, track.duration, 18)}\n` +
              `\`${formatTimestamp(queue.position)} / ${track.formattedDuration}\``,
            thumbnail: track.thumbnail,
            fields: [
              { name: 'Requested by', value: `${track.requestedBy}`, inline: true },
              { name: 'Volume', value: `${queue.volume}%`, inline: true },
              { name: 'Loop', value: queue.loop, inline: true },
            ],
          }).setURL(track.url),
        ],
      });
    },
  },

  {
    name: 'volume',
    aliases: ['vol'],
    category: 'Music',
    description: 'Show or change the playback volume.',
    usage: '[1-150]',
    examples: ['volume', 'volume 80'],
    args: [{ name: 'level', type: 'integer', required: false, description: 'the new volume, 1 to 150' }],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);

      if (ctx.args.level === null || ctx.args.level === undefined) {
        return ctx.info(`Volume is **${state.queue.volume}%**.`);
      }
      if (!canControl(ctx, state.queue)) return ctx.error('You need the DJ role to change the volume.');
      if (ctx.args.level < 1 || ctx.args.level > 150) return ctx.error('Volume must be between **1** and **150**.');

      const level = state.queue.setVolume(ctx.args.level);
      return ctx.success(`${emojis.volume} Volume set to **${level}%**.`);
    },
  },

  {
    name: 'loop',
    aliases: ['repeat'],
    category: 'Music',
    description: 'Loop the current track, the whole queue, or nothing.',
    usage: '<off|track|queue>',
    examples: ['loop track', 'loop queue', 'loop off'],
    args: [{ name: 'mode', type: 'choice', required: true, choices: LOOP_MODES, description: 'off, track or queue' }],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (!canControl(ctx, state.queue)) return ctx.error('You need the DJ role to change the loop mode.');

      const mode = state.queue.setLoop(ctx.args.mode);
      const icon = mode === 'track' ? emojis.repeatOne : mode === 'queue' ? emojis.repeat : emojis.stop;
      return ctx.success(`${icon} Loop set to **${mode}**.`);
    },
  },

  {
    name: 'shuffle',
    category: 'Music',
    description: 'Shuffle the queue.',
    examples: ['shuffle'],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (state.queue.tracks.length < 2) return ctx.error('There is nothing to shuffle.');
      if (!canControl(ctx, state.queue)) return ctx.error('You need the DJ role to shuffle.');

      const count = state.queue.shuffle();
      return ctx.success(`${emojis.shuffle} Shuffled **${count}** track(s).`);
    },
  },

  {
    name: 'remove',
    category: 'Music',
    description: 'Remove one track from the queue by its position.',
    usage: '<position>',
    examples: ['remove 3'],
    args: [{ name: 'position', type: 'integer', required: true, description: 'position shown in `queue`' }],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);

      const track = state.queue.remove(ctx.args.position - 1);
      if (!track) return ctx.error(`There is no track at position **${ctx.args.position}**.`);
      if (track.requestedBy.id !== ctx.user.id && !canControl(ctx, state.queue)) {
        state.queue.tracks.splice(ctx.args.position - 1, 0, track); // put it back
        return ctx.error('You can only remove tracks you added.');
      }
      return ctx.success(`Removed **${truncate(track.title, 80)}**.`);
    },
  },

  {
    name: 'clearqueue',
    aliases: ['cq'],
    category: 'Music',
    description: 'Empty the queue without stopping the current track.',
    examples: ['clearqueue'],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (!canControl(ctx, state.queue)) return ctx.error('You need the DJ role to clear the queue.');

      const count = state.queue.clear();
      return ctx.success(`Cleared **${count}** track(s).`);
    },
  },

  {
    name: 'skipto',
    aliases: ['jump'],
    category: 'Music',
    description: 'Jump straight to a track in the queue.',
    usage: '<position>',
    examples: ['skipto 5'],
    args: [{ name: 'position', type: 'integer', required: true, description: 'position to jump to' }],
    async run(ctx) {
      const state = requireQueue(ctx);
      if (!state.ok) return ctx.error(state.reason);
      if (!canControl(ctx, state.queue)) return ctx.error('You need the DJ role to jump the queue.');

      const index = ctx.args.position - 1;
      if (index < 0 || index >= state.queue.tracks.length) return ctx.error('There is no track at that position.');

      state.queue.tracks.splice(0, index);
      state.queue.skip();
      return ctx.success(`Jumped to position **${ctx.args.position}**.`);
    },
  },

  {
    name: 'grab',
    aliases: ['save'],
    category: 'Music',
    description: 'DM yourself the track that is playing.',
    examples: ['grab'],
    async run(ctx) {
      const queue = ctx.client.music?.get(ctx.guild.id);
      if (!queue?.current) return ctx.error('Nothing is playing right now.');

      const track = queue.current;
      const sent = await ctx.user
        .send({
          embeds: [
            ctx.embed({
              title: truncate(track.title, 250),
              description: `by **${track.author}** ${emojis.dot} \`${track.formattedDuration}\`\nFrom **${ctx.guild.name}**`,
              thumbnail: track.thumbnail,
            }).setURL(track.url),
          ],
        })
        .catch(() => null);

      if (!sent) return ctx.error('I could not DM you — check your privacy settings.');
      return ctx.success('Sent it to your DMs.');
    },
  },

  {
    name: 'join',
    aliases: ['summon'],
    category: 'Music',
    description: 'Make the bot join your voice channel.',
    examples: ['join'],
    botPermissions: ['Connect', 'Speak'],
    async run(ctx) {
      if (!ctx.client.music?.available) return ctx.error('Music support is not installed on this bot.');
      const voice = requireVoice(ctx);
      if (!voice.ok) return ctx.error(voice.reason);

      await ctx.client.music.create(ctx.guild, voice.channel, ctx.channel);
      return ctx.success(`Joined **${voice.channel.name}**.`);
    },
  },

  {
    name: 'musicchannel',
    category: 'Music',
    description: 'Restrict music commands to one channel.',
    usage: '<channel | off>',
    examples: ['musicchannel #music', 'musicchannel off'],
    permissions: ['ManageGuild'],
    args: [{ name: 'channel', type: 'string', required: true, description: 'the channel, or `off`' }],
    async run(ctx) {
      if (ctx.args.channel.toLowerCase() === 'off') {
        store.setSetting(ctx.guild.id, 'music.textChannel', null);
        return ctx.success('Music commands work in every channel again.');
      }
      const channel = require('../../lib/arguments').resolveChannel(ctx.guild, ctx.args.channel);
      if (!channel) return ctx.error('I could not find that channel.');

      store.setSetting(ctx.guild.id, 'music.textChannel', channel.id);
      return ctx.success(`Music commands are now limited to ${channel}.`);
    },
  },

  {
    name: 'dj',
    category: 'Music',
    description: 'Set the DJ role that controls playback when others are listening.',
    usage: '<role | off>',
    examples: ['dj @DJ', 'dj off'],
    permissions: ['ManageGuild'],
    args: [{ name: 'role', type: 'string', required: true, description: 'the role, or `off`' }],
    async run(ctx) {
      if (ctx.args.role.toLowerCase() === 'off') {
        store.setSetting(ctx.guild.id, 'music.djRole', null);
        return ctx.success('DJ role removed — anyone can control playback.');
      }
      const role = require('../../lib/arguments').resolveRole(ctx.guild, ctx.args.role);
      if (!role) return ctx.error('I could not find that role.');

      store.setSetting(ctx.guild.id, 'music.djRole', role.id);
      return ctx.success(`**${role.name}** is now the DJ role.`);
    },
  },
];
