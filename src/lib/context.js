'use strict';

const { themeFor } = require('./embeds');
const { paginate } = require('./paginator');
const { confirm } = require('./confirm');
const { eph, messageFrom } = require('./reply');
const store = require('./db');
const { chunk } = require('./util');

/**
 * One object that behaves the same whether a command was typed with a prefix
 * or run as a slash command. Commands only ever touch `ctx`, so nothing in
 * `src/commands` needs to know which of the two happened.
 */
class Context {
  constructor({ client, message, interaction, command, args = {}, rawArgs = [], prefix }) {
    this.client = client;
    this.message = message ?? null;
    this.interaction = interaction ?? null;
    this.command = command;
    this.args = args;
    this.rawArgs = rawArgs;
    this.prefix = prefix ?? store.getPrefix(this.guild?.id);
    this.theme = themeFor(this.guild?.id);
    this._deferred = false;
    this._replied = false;
  }

  get isSlash() {
    return Boolean(this.interaction);
  }

  get source() {
    return this.interaction ?? this.message;
  }

  get user() {
    return this.interaction?.user ?? this.message.author;
  }

  /** Alias — plenty of commands read more naturally as `ctx.author`. */
  get author() {
    return this.user;
  }

  get member() {
    return this.interaction?.member ?? this.message?.member ?? null;
  }

  get guild() {
    return this.source?.guild ?? null;
  }

  get channel() {
    return this.source?.channel ?? null;
  }

  get me() {
    return this.guild?.members?.me ?? null;
  }

  get settings() {
    return this.guild ? store.getSettings(this.guild.id) : {};
  }

  setting(key) {
    return this.guild ? store.getSetting(this.guild.id, key) : undefined;
  }

  /* ── replying ─────────────────────────────────────────────────────── */

  /** Tell Discord we need more than three seconds. Safe to call twice. */
  async defer({ ephemeral = false } = {}) {
    if (this.isSlash) {
      if (!this.interaction.deferred && !this.interaction.replied) {
        await this.interaction.deferReply(ephemeral ? eph({}) : {}).catch(() => {});
        this._deferred = true;
        this._ephemeral = ephemeral;
      }
      return;
    }
    // Prefix commands get a typing indicator instead.
    await this.channel?.sendTyping?.().catch(() => {});
  }

  /**
   * The single send path. Returns the Message so callers can add collectors.
   */
  async send(payload) {
    const options = typeof payload === 'string' ? { content: payload } : { ...payload };
    options.allowedMentions = options.allowedMentions ?? { parse: [], repliedUser: false };

    if (this.isSlash) {
      const { ephemeral, ...rest } = options;
      const body = ephemeral ? eph(rest) : rest;
      if (this.interaction.deferred || this.interaction.replied) {
        if (this._replied) {
          return messageFrom(await this.interaction.followUp({ ...body, withResponse: true }));
        }
        this._replied = true;
        return this.interaction.editReply(rest);
      }
      this._replied = true;
      return messageFrom(await this.interaction.reply({ ...body, withResponse: true }));
    }

    const { ephemeral: _drop, ...rest } = options;
    if (!this._replied && this.message) {
      this._replied = true;
      return this.message
        .reply({ ...rest, allowedMentions: { ...options.allowedMentions, repliedUser: false } })
        .catch(() => this.channel.send(rest));
    }
    return this.channel.send(rest);
  }

  /** Alias for `send`, for commands that read better as a reply. */
  reply(payload) {
    return this.send(payload);
  }

  /** Reply only the invoker can see (prefix commands fall back to a normal reply). */
  whisper(payload) {
    const options = typeof payload === 'string' ? { content: payload } : payload;
    return this.send({ ...options, ephemeral: true });
  }

  success(text, options = {}) {
    return this.send({ embeds: [this.theme.success(text, this.user)], ...options });
  }

  error(text, options = {}) {
    return this.send({ embeds: [this.theme.error(text, this.user)], ...options });
  }

  warn(text, options = {}) {
    return this.send({ embeds: [this.theme.warn(text, this.user)], ...options });
  }

  info(text, options = {}) {
    return this.send({ embeds: [this.theme.info(text, this.user)], ...options });
  }

  embed(options) {
    return this.theme.base(options);
  }

  /** Show the command's own usage — used whenever an argument is missing. */
  usage(note) {
    const command = this.command;
    const lines = [];
    if (note) lines.push(`${note}\n`);
    lines.push(`**Usage:** \`${this.prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\``);
    if (command.examples?.length) {
      lines.push(`**Example:** \`${this.prefix}${command.examples[0]}\``);
    }
    lines.push(`\nRun \`${this.prefix}help ${command.name}\` for the full guide.`);
    return this.send({
      embeds: [this.theme.base({ color: this.theme.errorColor, description: lines.join('\n') })],
    });
  }

  /* ── interactive helpers ──────────────────────────────────────────── */

  paginate(pages, options) {
    return paginate(this, pages, options);
  }

  /** Turn a list of strings into paged embeds automatically. */
  paginateRows(rows, { perPage = 10, title, description, thumbnail, numbered = true, author } = {}) {
    const groups = chunk(rows, perPage);
    if (!groups.length) groups.push([]);
    const pages = groups.map((group, index) =>
      this.theme.list({
        title,
        description,
        thumbnail,
        author,
        numbered,
        rows: group,
        page: index + 1,
        pages: groups.length,
        startAt: index * perPage,
      }),
    );
    return this.paginate(pages);
  }

  confirm(options) {
    return confirm(this, options);
  }
}

module.exports = { Context };
