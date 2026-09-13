'use strict';

const { EmbedBuilder } = require('discord.js');
const store = require('./db');
const emojis = require('./emojis');
const { resolveColor, truncate } = require('./util');
const config = require('../config');

/**
 * Every embed the bot sends goes through here, so a server's colours and
 * footer are applied in exactly one place and the whole bot stays visually
 * consistent.
 */
class Theme {
  constructor(guildId) {
    this.guildId = guildId || null;
  }

  setting(key, fallback) {
    if (!this.guildId) return fallback;
    const value = store.getSetting(this.guildId, key);
    return value === undefined || value === null || value === '' ? fallback : value;
  }

  get primary() {
    return resolveColor(this.setting('embed.color', config.colors.primary));
  }

  get successColor() {
    return resolveColor(this.setting('embed.success', config.colors.success));
  }

  get errorColor() {
    return resolveColor(this.setting('embed.error', config.colors.error));
  }

  get warnColor() {
    return resolveColor(this.setting('embed.warn', config.colors.warn));
  }

  get useEmojis() {
    return this.setting('embed.emojis', true) !== false;
  }

  get useThumbnails() {
    return this.setting('embed.thumbnails', true) !== false;
  }

  /** A blank embed already wearing the server's colour and footer. */
  base(options = {}) {
    const embed = new EmbedBuilder().setColor(options.color ?? this.primary);
    const footer = this.setting('embed.footer', '');
    if (footer) embed.setFooter({ text: truncate(footer, 2048) });
    if (options.title) embed.setTitle(truncate(options.title, 256));
    if (options.description) embed.setDescription(truncate(options.description, 4096));
    if (options.author) embed.setAuthor(options.author);
    if (options.thumbnail && this.useThumbnails) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.fields) embed.addFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.timestamp) embed.setTimestamp(options.timestamp === true ? new Date() : options.timestamp);
    return embed;
  }

  /**
   * The short status replies. They intentionally have no title — a one-line
   * description reads faster than a boxed-in title/description pair.
   */
  status(kind, text, user) {
    const map = {
      success: [this.successColor, emojis.success],
      error: [this.errorColor, emojis.error],
      warn: [this.warnColor, emojis.warn],
      info: [this.primary, emojis.info],
    };
    const [color, emoji] = map[kind] ?? map.info;
    const prefix = this.useEmojis ? `${emoji} ` : '';
    const mention = user ? `**${user.username ?? user.tag ?? user}**: ` : '';
    return this.base({ color, description: `${prefix}${mention}${text}` });
  }

  success(text, user) {
    return this.status('success', text, user);
  }

  error(text, user) {
    return this.status('error', text, user);
  }

  warn(text, user) {
    return this.status('warn', text, user);
  }

  info(text, user) {
    return this.status('info', text, user);
  }

  /**
   * A tidy list embed: numbered rows, consistent spacing, page counter in the
   * footer. Used by every leaderboard/queue/history view in the bot.
   */
  list({ title, rows, page = 1, pages = 1, description = '', thumbnail, author, numbered = true, startAt = 0 }) {
    const body = rows.length
      ? rows
          .map((row, index) => (numbered ? `\`${String(startAt + index + 1).padStart(2, '0')}\` ${row}` : row))
          .join('\n')
      : '_Nothing to show yet._';
    const embed = this.base({
      title,
      description: `${description ? `${description}\n\n` : ''}${body}`,
      thumbnail,
      author,
    });
    const footer = this.setting('embed.footer', '');
    if (pages > 1) {
      embed.setFooter({ text: `Page ${page} of ${pages}${footer ? ` ${emojis.dot} ${footer}` : ''}` });
    }
    return embed;
  }
}

const cache = new Map();

/** Themes are cheap, but caching keeps settings lookups down on hot paths. */
function themeFor(guildId) {
  const key = guildId || 'global';
  let theme = cache.get(key);
  if (!theme) {
    theme = new Theme(guildId);
    cache.set(key, theme);
  }
  return theme;
}

module.exports = { Theme, themeFor };
