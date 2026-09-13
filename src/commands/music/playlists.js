'use strict';

const store = require('../../lib/db');
const { Track } = require('../../modules/music');
const { truncate, formatDuration, formatTimestamp } = require('../../lib/util');
const emojis = require('../../lib/emojis');

const MAX_PLAYLISTS = 25;
const MAX_TRACKS = 200;

function playlistFor(userId, name) {
  return store.db
    .prepare('SELECT * FROM playlists WHERE user_id = ? AND LOWER(name) = LOWER(?)')
    .get(userId, name);
}

function parseTracks(row) {
  try {
    return JSON.parse(row.tracks);
  } catch {
    return [];
  }
}

module.exports = [
  {
    name: 'playlist save',
    category: 'Music',
    description: 'Save the current queue as a playlist you can load later.',
    details:
      'Saves the track that is playing plus everything queued behind it. Playlists belong to you, not to the ' +
      'server, so you can load them anywhere the bot is.',
    usage: '<name>',
    examples: ['playlist save focus', 'playlist save "friday night"'],
    args: [{ name: 'name', type: 'rest', required: true, description: 'a name for the playlist' }],
    async run(ctx) {
      const queue = ctx.client.music?.get(ctx.guild.id);
      if (!queue?.current) return ctx.error('Nothing is playing, so there is nothing to save.');

      const name = truncate(ctx.args.name.trim(), 60);
      const count = store.db.prepare('SELECT COUNT(*) AS total FROM playlists WHERE user_id = ?').get(ctx.user.id).total;
      const existing = playlistFor(ctx.user.id, name);
      if (!existing && count >= MAX_PLAYLISTS) return ctx.error(`You can keep at most **${MAX_PLAYLISTS}** playlists.`);

      const tracks = [queue.current, ...queue.tracks].slice(0, MAX_TRACKS).map((track) => ({
        title: track.title,
        url: track.url,
        duration: track.duration,
        author: track.author,
        thumbnail: track.thumbnail,
      }));

      if (existing) {
        store.db.prepare('UPDATE playlists SET tracks = ? WHERE id = ?').run(JSON.stringify(tracks), existing.id);
        return ctx.success(`Updated **${name}** — **${tracks.length}** track(s).`);
      }

      store.db
        .prepare('INSERT INTO playlists (user_id, name, tracks) VALUES (?, ?, ?)')
        .run(ctx.user.id, name, JSON.stringify(tracks));
      return ctx.success(`Saved **${name}** with **${tracks.length}** track(s). Load it with \`${ctx.prefix}playlist load ${name}\`.`);
    },
  },

  {
    name: 'playlist load',
    aliases: ['playlist play'],
    category: 'Music',
    description: 'Queue everything in one of your playlists.',
    usage: '<name>',
    examples: ['playlist load focus'],
    botPermissions: ['Connect', 'Speak'],
    args: [{ name: 'name', type: 'rest', required: true, description: 'which playlist' }],
    async run(ctx) {
      if (!ctx.client.music?.available) return ctx.error('Music support is not installed on this bot.');

      const row = playlistFor(ctx.user.id, ctx.args.name.trim());
      if (!row) return ctx.error(`You have no playlist called **${truncate(ctx.args.name, 40)}**.`);

      const saved = parseTracks(row);
      if (!saved.length) return ctx.error(`**${row.name}** is empty.`);

      const voiceChannel = ctx.member?.voice?.channel;
      if (!voiceChannel) return ctx.error('Join a voice channel first.');

      await ctx.defer();
      const queue = await ctx.client.music.create(ctx.guild, voiceChannel, ctx.channel);

      let added = 0;
      for (const entry of saved) {
        try {
          queue.add(new Track({ ...entry, requestedBy: ctx.user }));
          added += 1;
        } catch {
          break; // queue full
        }
      }

      await queue.start();
      return ctx.success(`Queued **${added}** track(s) from **${row.name}**.`);
    },
  },

  {
    name: 'playlist list',
    aliases: ['playlists'],
    category: 'Music',
    description: 'Show the playlists you have saved.',
    examples: ['playlist list'],
    guildOnly: false,
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM playlists WHERE user_id = ? ORDER BY name ASC').all(ctx.user.id);
      if (!rows.length) return ctx.info(`You have no playlists. Save one with \`${ctx.prefix}playlist save <name>\`.`);

      return ctx.paginateRows(
        rows.map((row) => {
          const tracks = parseTracks(row);
          const length = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
          return `**${row.name}** ${emojis.dot} ${tracks.length} track(s) ${emojis.dot} ${formatDuration(length)}`;
        }),
        { perPage: 10, title: `${emojis.queue} Your playlists` },
      );
    },
  },

  {
    name: 'playlist show',
    aliases: ['playlist view'],
    category: 'Music',
    description: 'List the tracks inside one of your playlists.',
    usage: '<name>',
    examples: ['playlist show focus'],
    guildOnly: false,
    args: [{ name: 'name', type: 'rest', required: true, description: 'which playlist' }],
    async run(ctx) {
      const row = playlistFor(ctx.user.id, ctx.args.name.trim());
      if (!row) return ctx.error(`You have no playlist called **${truncate(ctx.args.name, 40)}**.`);

      const tracks = parseTracks(row);
      if (!tracks.length) return ctx.info(`**${row.name}** is empty.`);

      return ctx.paginateRows(
        tracks.map((track) => `[${truncate(track.title, 55)}](${track.url}) \`${formatTimestamp(track.duration)}\``),
        { perPage: 10, title: row.name },
      );
    },
  },

  {
    name: 'playlist delete',
    aliases: ['playlist remove'],
    category: 'Music',
    description: 'Delete one of your playlists.',
    usage: '<name>',
    examples: ['playlist delete focus'],
    guildOnly: false,
    args: [{ name: 'name', type: 'rest', required: true, description: 'which playlist' }],
    async run(ctx) {
      const row = playlistFor(ctx.user.id, ctx.args.name.trim());
      if (!row) return ctx.error(`You have no playlist called **${truncate(ctx.args.name, 40)}**.`);

      store.db.prepare('DELETE FROM playlists WHERE id = ?').run(row.id);
      return ctx.success(`Deleted **${row.name}**.`);
    },
  },
];
