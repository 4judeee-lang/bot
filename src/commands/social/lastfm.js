'use strict';

const store = require('../../lib/db');
const { fetchJson } = require('../../lib/http');
const { truncate, formatNumber } = require('../../lib/util');
const emojis = require('../../lib/emojis');
const config = require('../../config');

const API = 'https://ws.audioscrobbler.com/2.0/';

function endpoint(method, params) {
  const url = new URL(API);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', config.api.lastfm);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function requireKey(ctx) {
  if (config.api.lastfm) return null;
  return ctx.error('Last.fm is not set up on this bot — the owner needs to add `LASTFM_API_KEY` to the environment.');
}

/** The username saved for a Discord user, or null. */
function savedUsername(userId) {
  return store.db.prepare('SELECT lastfm FROM user_profiles WHERE user_id = ?').get(userId)?.lastfm ?? null;
}

/** Resolve whose account to look at: an argument, or the caller's saved name. */
function resolveTarget(ctx) {
  const given = ctx.args.username;
  if (given) return { username: given, own: false };

  const saved = savedUsername(ctx.user.id);
  if (saved) return { username: saved, own: true };

  return { username: null, own: true };
}

const USERNAME_ARG = {
  name: 'username',
  type: 'string',
  required: false,
  description: 'a Last.fm username — omit to use your saved one',
};

module.exports = [
  {
    name: 'lastfm set',
    aliases: ['fm set'],
    category: 'Social',
    description: 'Save your Last.fm username so you can leave it off other commands.',
    usage: '<username>',
    examples: ['lastfm set rj'],
    guildOnly: false,
    args: [{ name: 'username', type: 'string', required: true, description: 'your Last.fm username' }],
    async run(ctx) {
      const missing = requireKey(ctx);
      if (missing) return missing;

      const username = ctx.args.username.trim();
      const result = await fetchJson(endpoint('user.getinfo', { user: username }));
      if (!result.ok || result.data?.error) return ctx.error(`Last.fm does not know a user called **${truncate(username, 40)}**.`);

      store.db
        .prepare(
          `INSERT INTO user_profiles (user_id, lastfm) VALUES (?, ?)
           ON CONFLICT(user_id) DO UPDATE SET lastfm = excluded.lastfm`,
        )
        .run(ctx.user.id, username);

      return ctx.success(`Saved **${username}** — now just run \`${ctx.prefix}lastfm\`.`);
    },
  },

  {
    name: 'lastfm clear',
    category: 'Social',
    description: 'Forget your saved Last.fm username.',
    examples: ['lastfm clear'],
    guildOnly: false,
    async run(ctx) {
      store.db.prepare('UPDATE user_profiles SET lastfm = NULL WHERE user_id = ?').run(ctx.user.id);
      return ctx.success('Your Last.fm username has been cleared.');
    },
  },

  {
    name: 'lastfm',
    aliases: ['fm'],
    category: 'Social',
    description: 'Show what you are listening to on Last.fm.',
    details: 'Save your username once with `lastfm set <name>` and then this works on its own.',
    usage: '[username]',
    examples: ['lastfm', 'lastfm rj'],
    guildOnly: false,
    args: [USERNAME_ARG],
    cooldown: 4,
    async run(ctx) {
      const missing = requireKey(ctx);
      if (missing) return missing;

      const { username, own } = resolveTarget(ctx);
      if (!username) return ctx.error(`Save your username first: \`${ctx.prefix}lastfm set <username>\`.`);

      await ctx.defer();
      const result = await fetchJson(endpoint('user.getrecenttracks', { user: username, limit: 1 }));
      if (!result.ok || result.data?.error) return ctx.error(`Could not read **${truncate(username, 40)}**'s Last.fm.`);

      const track = result.data.recenttracks?.track?.[0];
      if (!track) return ctx.info(`**${username}** has not scrobbled anything yet.`);

      const playing = track['@attr']?.nowplaying === 'true';
      const image = track.image?.find((entry) => entry.size === 'extralarge')?.['#text'] || null;

      const embed = ctx.embed({
        author: {
          name: `${playing ? 'Now playing' : 'Last played'} — ${username}`,
          url: `https://www.last.fm/user/${encodeURIComponent(username)}`,
        },
        title: truncate(track.name, 250),
        description: `by **${truncate(track.artist?.['#text'] ?? 'unknown', 100)}**${track.album?.['#text'] ? `\non *${truncate(track.album['#text'], 100)}*` : ''}`,
        thumbnail: image,
        footer: {
          text: `${emojis.music} ${own ? 'your account' : `@${username}`}${result.data.recenttracks['@attr']?.total ? ` • ${formatNumber(result.data.recenttracks['@attr'].total)} scrobbles` : ''}`,
        },
      });
      if (track.url) embed.setURL(track.url);

      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'lastfm topartists',
    aliases: ['fm topartists'],
    category: 'Social',
    description: 'Your most played artists on Last.fm.',
    usage: '[username]',
    examples: ['lastfm topartists'],
    guildOnly: false,
    args: [USERNAME_ARG],
    cooldown: 4,
    async run(ctx) {
      const missing = requireKey(ctx);
      if (missing) return missing;

      const { username } = resolveTarget(ctx);
      if (!username) return ctx.error(`Save your username first: \`${ctx.prefix}lastfm set <username>\`.`);

      await ctx.defer();
      const result = await fetchJson(endpoint('user.gettopartists', { user: username, limit: 50 }));
      if (!result.ok || result.data?.error) return ctx.error(`Could not read **${truncate(username, 40)}**'s Last.fm.`);

      const artists = result.data.topartists?.artist ?? [];
      if (!artists.length) return ctx.info(`**${username}** has no top artists yet.`);

      return ctx.paginateRows(
        artists.map((artist) => `**${truncate(artist.name, 50)}** ${emojis.dot} ${formatNumber(artist.playcount)} plays`),
        { perPage: 10, title: `Top artists — ${username}` },
      );
    },
  },

  {
    name: 'lastfm toptracks',
    aliases: ['fm toptracks'],
    category: 'Social',
    description: 'Your most played tracks on Last.fm.',
    usage: '[username]',
    examples: ['lastfm toptracks'],
    guildOnly: false,
    args: [USERNAME_ARG],
    cooldown: 4,
    async run(ctx) {
      const missing = requireKey(ctx);
      if (missing) return missing;

      const { username } = resolveTarget(ctx);
      if (!username) return ctx.error(`Save your username first: \`${ctx.prefix}lastfm set <username>\`.`);

      await ctx.defer();
      const result = await fetchJson(endpoint('user.gettoptracks', { user: username, limit: 50 }));
      if (!result.ok || result.data?.error) return ctx.error(`Could not read **${truncate(username, 40)}**'s Last.fm.`);

      const tracks = result.data.toptracks?.track ?? [];
      if (!tracks.length) return ctx.info(`**${username}** has no top tracks yet.`);

      return ctx.paginateRows(
        tracks.map(
          (track) => `**${truncate(track.name, 45)}** by ${truncate(track.artist?.name ?? '?', 30)} ${emojis.dot} ${formatNumber(track.playcount)}`,
        ),
        { perPage: 10, title: `Top tracks — ${username}` },
      );
    },
  },

  {
    name: 'lastfm profile',
    aliases: ['fm profile'],
    category: 'Social',
    description: 'Show a Last.fm profile and scrobble count.',
    usage: '[username]',
    examples: ['lastfm profile'],
    guildOnly: false,
    args: [USERNAME_ARG],
    cooldown: 4,
    async run(ctx) {
      const missing = requireKey(ctx);
      if (missing) return missing;

      const { username } = resolveTarget(ctx);
      if (!username) return ctx.error(`Save your username first: \`${ctx.prefix}lastfm set <username>\`.`);

      await ctx.defer();
      const result = await fetchJson(endpoint('user.getinfo', { user: username }));
      if (!result.ok || result.data?.error) return ctx.error(`Could not find **${truncate(username, 40)}** on Last.fm.`);

      const user = result.data.user;
      const embed = ctx.embed({
        title: user.realname || user.name,
        thumbnail: user.image?.find((entry) => entry.size === 'extralarge')?.['#text'] || null,
        fields: [
          { name: 'Scrobbles', value: formatNumber(user.playcount), inline: true },
          { name: 'Artists', value: formatNumber(user.artist_count ?? 0), inline: true },
          { name: 'Tracks', value: formatNumber(user.track_count ?? 0), inline: true },
          { name: 'Country', value: user.country || 'unknown', inline: true },
          {
            name: 'Registered',
            value: user.registered?.unixtime ? `<t:${user.registered.unixtime}:D>` : 'unknown',
            inline: true,
          },
        ],
      });
      embed.setURL(user.url);

      return ctx.send({ embeds: [embed] });
    },
  },
];
