'use strict';

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const { formatTimestamp, truncate, shuffle } = require('../lib/util');
const emojis = require('../lib/emojis');
const logger = require('../lib/logger').scoped('music');

let play = null;
try {
  play = require('play-dl');
} catch (error) {
  logger.warn('play-dl is not installed — music commands will report as unavailable');
}

const LOOP_MODES = ['off', 'track', 'queue'];

class Track {
  constructor({ title, url, duration, thumbnail, author, requestedBy, source = 'youtube' }) {
    this.title = title;
    this.url = url;
    this.duration = duration || 0;
    this.thumbnail = thumbnail || null;
    this.author = author || 'Unknown';
    this.requestedBy = requestedBy;
    this.source = source;
  }

  get formattedDuration() {
    return this.duration ? formatTimestamp(this.duration) : 'live';
  }

  toString() {
    return `[${truncate(this.title, 60)}](${this.url})`;
  }
}

/** One queue per guild. Owns the voice connection and the audio player. */
class Queue {
  constructor(manager, guild, voiceChannel, textChannel) {
    this.manager = manager;
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.tracks = [];
    this.history = [];
    this.current = null;
    this.loop = 'off';
    this.volume = store.getSetting(guild.id, 'music.defaultVolume') ?? 60;
    this.paused = false;
    this.destroyed = false;
    this.resource = null;
    this.nowPlayingMessage = null;
    this.leaveTimer = null;

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });

    this.player.on(AudioPlayerStatus.Idle, () => this.#advance());
    this.player.on('error', (error) => {
      logger.warn(`Player error in ${guild.id}: ${error.message}`);
      this.#announce(themeFor(guild.id).error(`Playback error on **${truncate(this.current?.title ?? 'track', 60)}** — skipping.`));
      this.#advance();
    });
  }

  get playing() {
    return this.player.state.status === AudioPlayerStatus.Playing;
  }

  get totalDuration() {
    return this.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  }

  get position() {
    return this.resource ? Math.floor(this.resource.playbackDuration / 1000) : 0;
  }

  async connect() {
    this.connection = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.subscribe(this.player);

    // Recover from Discord moving the bot between voice servers.
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
      this.destroy();
      throw new Error('I could not connect to that voice channel.');
    }
    return this;
  }

  add(track) {
    const max = store.getSetting(this.guild.id, 'music.maxQueue') ?? 200;
    if (this.tracks.length >= max) {
      const error = new Error(`The queue is full (${max} tracks).`);
      error.friendly = true;
      throw error;
    }
    this.tracks.push(track);
    return this.tracks.length;
  }

  async start() {
    if (this.current || !this.tracks.length) return;
    await this.#playNext();
  }

  async #playNext() {
    if (this.destroyed) return;

    if (this.loop === 'track' && this.current) {
      await this.#stream(this.current);
      return;
    }

    if (this.current) this.history.unshift(this.current);
    if (this.history.length > 25) this.history.pop();

    if (this.loop === 'queue' && this.current) this.tracks.push(this.current);

    const next = this.tracks.shift();
    if (!next) {
      this.current = null;
      this.#scheduleLeave();
      this.#announce(themeFor(this.guild.id).info('Queue finished — add more tracks or I will leave shortly.'));
      return;
    }

    this.current = next;
    await this.#stream(next);
  }

  async #stream(track) {
    if (!play) throw new Error('Music support is not installed on this bot.');
    try {
      const source = await play.stream(track.url, { quality: 2 });
      this.resource = createAudioResource(source.stream, {
        inputType: source.type ?? StreamType.Arbitrary,
        inlineVolume: true,
      });
      this.resource.volume?.setVolume(this.volume / 100);
      this.player.play(this.resource);
      this.#clearLeave();
      await this.announceNowPlaying();
    } catch (error) {
      logger.warn(`Could not stream ${track.url}: ${error.message}`);
      this.#announce(themeFor(this.guild.id).error(`Could not play **${truncate(track.title, 60)}** — skipping.`));
      await this.#advance();
    }
  }

  async #advance() {
    if (this.destroyed) return;
    await this.#playNext().catch((error) => logger.warn(`advance failed: ${error.message}`));
  }

  async announceNowPlaying() {
    if (!this.textChannel?.isTextBased() || !this.current) return;
    const theme = themeFor(this.guild.id);
    const embed = theme.base({
      color: theme.primary,
      author: { name: 'Now playing' },
      title: truncate(this.current.title, 250),
      description: `by **${this.current.author}** ${emojis.dot} \`${this.current.formattedDuration}\` ${emojis.dot} requested by ${this.current.requestedBy}`,
      thumbnail: this.current.thumbnail,
      footer: {
        text: `${this.tracks.length} track(s) left ${emojis.dot} volume ${this.volume}% ${emojis.dot} loop: ${this.loop}`,
      },
    });
    embed.setURL(this.current.url);

    const message = await this.textChannel.send({ embeds: [embed] }).catch(() => null);
    // Replace the previous card so the channel does not fill with them.
    this.nowPlayingMessage?.delete?.().catch(() => {});
    this.nowPlayingMessage = message;
  }

  #announce(embed) {
    this.textChannel?.send?.({ embeds: [embed] }).catch(() => {});
  }

  skip() {
    const skipped = this.current;
    // Looping a single track would otherwise replay it instead of skipping.
    if (this.loop === 'track') this.loop = 'off';
    this.player.stop(true);
    return skipped;
  }

  pause() {
    this.paused = this.player.pause();
    return this.paused;
  }

  resume() {
    const ok = this.player.unpause();
    this.paused = !ok;
    return ok;
  }

  setVolume(value) {
    this.volume = Math.max(1, Math.min(150, Math.round(value)));
    this.resource?.volume?.setVolume(this.volume / 100);
    return this.volume;
  }

  setLoop(mode) {
    if (!LOOP_MODES.includes(mode)) return this.loop;
    this.loop = mode;
    return this.loop;
  }

  shuffle() {
    this.tracks = shuffle(this.tracks);
    return this.tracks.length;
  }

  remove(index) {
    if (index < 0 || index >= this.tracks.length) return null;
    return this.tracks.splice(index, 1)[0];
  }

  clear() {
    const count = this.tracks.length;
    this.tracks = [];
    return count;
  }

  #scheduleLeave() {
    this.#clearLeave();
    this.leaveTimer = setTimeout(() => this.destroy(), 120_000);
  }

  #clearLeave() {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.#clearLeave();
    this.tracks = [];
    this.current = null;
    try {
      this.player.stop(true);
      this.connection?.destroy();
    } catch {
      // already gone
    }
    this.nowPlayingMessage?.delete?.().catch(() => {});
    this.manager.queues.delete(this.guild.id);
  }
}

class MusicManager {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
  }

  get available() {
    return Boolean(play);
  }

  get(guildId) {
    return this.queues.get(guildId) ?? null;
  }

  async create(guild, voiceChannel, textChannel) {
    const existing = this.queues.get(guild.id);
    if (existing) return existing;
    const queue = new Queue(this, guild, voiceChannel, textChannel);
    this.queues.set(guild.id, queue);
    await queue.connect();
    return queue;
  }

  /**
   * Resolve user input to tracks. Accepts a YouTube/Spotify/SoundCloud URL,
   * a playlist URL, or plain search terms.
   */
  async resolve(query, requestedBy) {
    if (!play) {
      const error = new Error('Music support is not installed on this bot.');
      error.friendly = true;
      throw error;
    }

    const type = play.yt_validate(query) || (await play.validate(query).catch(() => false));

    if (type === 'playlist' || type === 'yt_playlist') {
      const playlist = await play.playlist_info(query, { incomplete: true });
      const videos = await playlist.all_videos();
      return {
        playlist: playlist.title,
        tracks: videos.map(
          (video) =>
            new Track({
              title: video.title,
              url: video.url,
              duration: video.durationInSec,
              thumbnail: video.thumbnails?.[0]?.url,
              author: video.channel?.name,
              requestedBy,
            }),
        ),
      };
    }

    if (type === 'sp_track' || type === 'sp_album' || type === 'sp_playlist') {
      // Spotify links are metadata only — look the tracks up on YouTube.
      const spotify = await play.spotify(query);
      const items = spotify.type === 'track' ? [spotify] : await spotify.all_tracks();
      const tracks = [];
      for (const item of items.slice(0, 100)) {
        const [found] = await play.search(`${item.name} ${item.artists?.[0]?.name ?? ''}`, { limit: 1 });
        if (found) {
          tracks.push(
            new Track({
              title: item.name,
              url: found.url,
              duration: found.durationInSec,
              thumbnail: item.thumbnail?.url ?? found.thumbnails?.[0]?.url,
              author: item.artists?.[0]?.name ?? found.channel?.name,
              requestedBy,
              source: 'spotify',
            }),
          );
        }
      }
      return { playlist: spotify.type === 'track' ? null : spotify.name, tracks };
    }

    if (type === 'video' || type === 'yt_video') {
      const info = await play.video_basic_info(query);
      const details = info.video_details;
      return {
        playlist: null,
        tracks: [
          new Track({
            title: details.title,
            url: details.url,
            duration: details.durationInSec,
            thumbnail: details.thumbnails?.[0]?.url,
            author: details.channel?.name,
            requestedBy,
          }),
        ],
      };
    }

    const results = await play.search(query, { limit: 5, source: { youtube: 'video' } });
    if (!results.length) {
      const error = new Error(`No results for **${truncate(query, 80)}**.`);
      error.friendly = true;
      throw error;
    }
    return {
      playlist: null,
      tracks: [
        new Track({
          title: results[0].title,
          url: results[0].url,
          duration: results[0].durationInSec,
          thumbnail: results[0].thumbnails?.[0]?.url,
          author: results[0].channel?.name,
          requestedBy,
        }),
      ],
      alternatives: results,
    };
  }

  /** Search without queueing — used by the `search` command. */
  async search(query, limit = 10) {
    if (!play) return [];
    return play.search(query, { limit, source: { youtube: 'video' } });
  }

  destroyAll() {
    for (const queue of [...this.queues.values()]) queue.destroy();
  }
}

module.exports = { MusicManager, Queue, Track, LOOP_MODES };
