'use strict';

const store = require('../../lib/db');
const messages = require('../../modules/messages');
const variables = require('../../lib/variables');
const { formatDuration, truncate, relative, now, randomInt } = require('../../lib/util');
const emojis = require('../../lib/emojis');

module.exports = [
  {
    name: 'afk',
    category: 'Utility',
    description: 'Mark yourself away — I will tell anyone who pings you.',
    details: 'Your AFK clears itself the next time you send a message, and you are told how long you were gone.',
    usage: '[reason]',
    examples: ['afk', 'afk sleeping'],
    args: [{ name: 'reason', type: 'rest', required: false, default: 'AFK', description: 'what you are doing' }],
    slash: true,
    async run(ctx) {
      if (!store.getSetting(ctx.guild.id, 'fun.afkEnabled')) return ctx.error('AFK is disabled in this server.');
      messages.setAfk(ctx.guild.id, ctx.user.id, truncate(ctx.args.reason, 200));
      return ctx.success(`You are now AFK: **${truncate(ctx.args.reason, 200)}**`);
    },
  },

  {
    name: 'snipe',
    aliases: ['s'],
    category: 'Utility',
    description: 'Show the most recently deleted message in this channel.',
    details: 'Pass a number to look further back — `snipe 3` shows the third most recent. Snipes are kept for one hour.',
    usage: '[index]',
    examples: ['snipe', 'snipe 2'],
    args: [{ name: 'index', type: 'integer', required: false, default: 1, description: 'how far back to look' }],
    async run(ctx) {
      if (!store.getSetting(ctx.guild.id, 'fun.snipeEnabled')) return ctx.error('Sniping is disabled in this server.');

      const entries = ctx.client.caches.snipes.get(ctx.channel.id) ?? [];
      const entry = entries[Math.max(0, ctx.args.index - 1)];
      if (!entry) return ctx.error('Nothing to snipe here.');

      const embed = ctx.embed({
        author: { name: entry.author.tag, iconURL: entry.author.avatar },
        description: entry.content || '*no text content*',
        footer: { text: `${ctx.args.index} of ${entries.length} • deleted` },
        timestamp: new Date(entry.at),
      });
      if (entry.attachments.length) embed.setImage(entry.attachments[0]);

      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'editsnipe',
    aliases: ['es'],
    category: 'Utility',
    description: 'Show what a recently edited message used to say.',
    usage: '[index]',
    examples: ['editsnipe'],
    args: [{ name: 'index', type: 'integer', required: false, default: 1, description: 'how far back to look' }],
    async run(ctx) {
      const entries = ctx.client.caches.editSnipes.get(ctx.channel.id) ?? [];
      const entry = entries[Math.max(0, ctx.args.index - 1)];
      if (!entry) return ctx.error('No recent edits here.');

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: entry.author.tag, iconURL: entry.author.avatar },
            fields: [
              { name: 'Before', value: truncate(entry.before || '*empty*', 1000) },
              { name: 'After', value: truncate(entry.after || '*empty*', 1000) },
            ],
            description: `[jump to message](${entry.url})`,
            timestamp: new Date(entry.at),
          }),
        ],
      });
    },
  },

  {
    name: 'reactionsnipe',
    aliases: ['rs'],
    category: 'Utility',
    description: 'Show the most recent reaction added in this channel.',
    usage: '[index]',
    examples: ['reactionsnipe'],
    args: [{ name: 'index', type: 'integer', required: false, default: 1, description: 'how far back to look' }],
    async run(ctx) {
      const entries = ctx.client.caches.reactionSnipes.get(ctx.channel.id) ?? [];
      const entry = entries[Math.max(0, ctx.args.index - 1)];
      if (!entry) return ctx.error('No recent reactions here.');

      return ctx.send({
        embeds: [
          ctx.embed({
            description: `**${entry.user.tag}** reacted with ${entry.emoji}\n[jump to message](${entry.messageUrl})`,
            timestamp: new Date(entry.at),
          }),
        ],
      });
    },
  },

  {
    name: 'clearsnipes',
    category: 'Utility',
    description: 'Wipe the snipe history for this channel.',
    examples: ['clearsnipes'],
    permissions: ['ManageMessages'],
    async run(ctx) {
      ctx.client.caches.snipes.delete(ctx.channel.id);
      ctx.client.caches.editSnipes.delete(ctx.channel.id);
      ctx.client.caches.reactionSnipes.delete(ctx.channel.id);
      return ctx.success('Snipe history cleared for this channel.');
    },
  },

  {
    name: 'remind',
    aliases: ['remindme', 'reminder'],
    category: 'Utility',
    description: 'Get a DM about something later.',
    details: 'If your DMs are closed I will post the reminder in the channel you set it in instead.',
    usage: '<when> <what>',
    examples: ['remind 30m take the pizza out', 'remind 2d renew the domain'],
    args: [
      { name: 'when', type: 'duration', required: true, description: 'how far away, e.g. 30m or 2d' },
      { name: 'what', type: 'rest', required: true, description: 'what to remind you about' },
    ],
    slash: true,
    async run(ctx) {
      const { when, what } = ctx.args;
      if (when < 60) return ctx.error('Minimum reminder is **1 minute**.');
      if (when > 31_536_000) return ctx.error('Maximum reminder is **1 year**.');

      store.db
        .prepare('INSERT INTO reminders (user_id, guild_id, channel_id, text, remind_at) VALUES (?, ?, ?, ?, ?)')
        .run(ctx.user.id, ctx.guild.id, ctx.channel.id, truncate(what, 1000), now() + when);

      return ctx.success(`I will remind you in **${formatDuration(when)}** — ${truncate(what, 200)}`);
    },
  },

  {
    name: 'reminders',
    category: 'Utility',
    description: 'List your pending reminders.',
    examples: ['reminders'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC').all(ctx.user.id);
      if (!rows.length) return ctx.info('You have no reminders set.');

      return ctx.paginateRows(
        rows.map((row) => `\`${row.id}\` ${truncate(row.text, 60)} — ${relative(row.remind_at * 1000)}`),
        { perPage: 10, title: 'Your reminders', numbered: false },
      );
    },
  },

  {
    name: 'delreminder',
    category: 'Utility',
    description: 'Cancel a reminder by its ID.',
    usage: '<id>',
    examples: ['delreminder 4'],
    args: [{ name: 'id', type: 'integer', required: true, description: 'the reminder ID from `reminders`' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(ctx.args.id, ctx.user.id).changes;
      if (!changed) return ctx.error('No reminder with that ID belongs to you.');
      return ctx.success('Reminder cancelled.');
    },
  },

  {
    name: 'todo add',
    category: 'Utility',
    description: 'Add something to your personal to-do list.',
    usage: '<task>',
    examples: ['todo add finish the bot'],
    guildOnly: false,
    args: [{ name: 'task', type: 'rest', required: true, description: 'what to add' }],
    async run(ctx) {
      store.db.prepare('INSERT INTO todos (user_id, text) VALUES (?, ?)').run(ctx.user.id, truncate(ctx.args.task, 500));
      return ctx.success('Added to your to-do list.');
    },
  },

  {
    name: 'todo',
    category: 'Utility',
    description: 'Show your to-do list.',
    examples: ['todo'],
    guildOnly: false,
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY done ASC, id ASC').all(ctx.user.id);
      if (!rows.length) return ctx.info(`Your list is empty. Add something with \`${ctx.prefix}todo add <task>\`.`);

      return ctx.paginateRows(
        rows.map((row) => `${row.done ? '~~' : ''}\`${row.id}\` ${truncate(row.text, 80)}${row.done ? '~~' : ''}`),
        { perPage: 10, title: 'Your to-do list', numbered: false },
      );
    },
  },

  {
    name: 'todo done',
    category: 'Utility',
    description: 'Tick off a to-do item.',
    usage: '<id>',
    examples: ['todo done 3'],
    guildOnly: false,
    args: [{ name: 'id', type: 'integer', required: true, description: 'the item ID' }],
    async run(ctx) {
      const changed = store.db.prepare('UPDATE todos SET done = 1 WHERE id = ? AND user_id = ?').run(ctx.args.id, ctx.user.id).changes;
      if (!changed) return ctx.error('No item with that ID on your list.');
      return ctx.success('Nice one. Ticked off.');
    },
  },

  {
    name: 'todo remove',
    category: 'Utility',
    description: 'Delete a to-do item.',
    usage: '<id>',
    examples: ['todo remove 3'],
    guildOnly: false,
    args: [{ name: 'id', type: 'integer', required: true, description: 'the item ID' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(ctx.args.id, ctx.user.id).changes;
      if (!changed) return ctx.error('No item with that ID on your list.');
      return ctx.success('Removed.');
    },
  },

  {
    name: 'tag',
    aliases: ['t'],
    category: 'Utility',
    description: 'Show a saved snippet of text.',
    details: 'Tags are per-server. Create them with `tag create`, and they support all the message variables.',
    usage: '<name>',
    examples: ['tag rules'],
    args: [{ name: 'name', type: 'string', required: true, description: 'the tag name' }],
    async run(ctx) {
      const tag = store.db.prepare('SELECT * FROM tags WHERE guild_id = ? AND name = ?').get(ctx.guild.id, ctx.args.name.toLowerCase());
      if (!tag) return ctx.error(`No tag called **${truncate(ctx.args.name, 40)}**.`);

      store.db.prepare('UPDATE tags SET uses = uses + 1 WHERE guild_id = ? AND name = ?').run(ctx.guild.id, tag.name);
      return ctx.send(variables.render(tag.content, { user: ctx.user, member: ctx.member, guild: ctx.guild, channel: ctx.channel }));
    },
  },

  {
    name: 'tag create',
    aliases: ['tag add'],
    category: 'Utility',
    description: 'Save a new tag.',
    usage: '<name> <content>',
    examples: ['tag create rules Be nice. No spam.'],
    permissions: ['ManageMessages'],
    args: [
      { name: 'name', type: 'string', required: true, description: 'a short name for the tag' },
      { name: 'content', type: 'rest', required: true, description: 'the text to save' },
    ],
    async run(ctx) {
      const name = ctx.args.name.toLowerCase();
      const exists = store.db.prepare('SELECT 1 FROM tags WHERE guild_id = ? AND name = ?').get(ctx.guild.id, name);
      if (exists) return ctx.error(`A tag called **${name}** already exists.`);

      store.db
        .prepare('INSERT INTO tags (guild_id, name, content, owner_id) VALUES (?, ?, ?, ?)')
        .run(ctx.guild.id, name, ctx.args.content, ctx.user.id);
      return ctx.success(`Tag **${name}** created — use it with \`${ctx.prefix}tag ${name}\`.`);
    },
  },

  {
    name: 'tag edit',
    category: 'Utility',
    description: 'Change what a tag says.',
    usage: '<name> <content>',
    examples: ['tag edit rules Updated rules here'],
    permissions: ['ManageMessages'],
    args: [
      { name: 'name', type: 'string', required: true, description: 'the tag to edit' },
      { name: 'content', type: 'rest', required: true, description: 'the new text' },
    ],
    async run(ctx) {
      const changed = store.db
        .prepare('UPDATE tags SET content = ? WHERE guild_id = ? AND name = ?')
        .run(ctx.args.content, ctx.guild.id, ctx.args.name.toLowerCase()).changes;
      if (!changed) return ctx.error(`No tag called **${truncate(ctx.args.name, 40)}**.`);
      return ctx.success(`Tag **${ctx.args.name.toLowerCase()}** updated.`);
    },
  },

  {
    name: 'tag delete',
    aliases: ['tag remove'],
    category: 'Utility',
    description: 'Delete a tag.',
    usage: '<name>',
    examples: ['tag delete rules'],
    permissions: ['ManageMessages'],
    args: [{ name: 'name', type: 'string', required: true, description: 'the tag to delete' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM tags WHERE guild_id = ? AND name = ?').run(ctx.guild.id, ctx.args.name.toLowerCase()).changes;
      if (!changed) return ctx.error(`No tag called **${truncate(ctx.args.name, 40)}**.`);
      return ctx.success(`Deleted tag **${ctx.args.name.toLowerCase()}**.`);
    },
  },

  {
    name: 'tags',
    aliases: ['taglist'],
    category: 'Utility',
    description: 'List every tag in this server.',
    examples: ['tags'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM tags WHERE guild_id = ? ORDER BY uses DESC').all(ctx.guild.id);
      if (!rows.length) return ctx.info(`No tags yet. Create one with \`${ctx.prefix}tag create <name> <content>\`.`);

      return ctx.paginateRows(
        rows.map((row) => `\`${row.name}\` ${emojis.dot} used ${row.uses}× ${emojis.dot} by <@${row.owner_id}>`),
        { perPage: 12, title: `Tags — ${rows.length}` },
      );
    },
  },

  {
    name: 'embed',
    category: 'Utility',
    description: 'Post a custom embed built from an embed script.',
    details:
      'Uses the same script as welcome messages:\n' +
      '`{embed}{color: #8b5cf6}$v{title: Hello}$v{description: Some text}`\n\n' +
      'Run `variables` to see every part and variable you can use. Building it on the dashboard is easier — ' +
      'it has a live preview and copies the script for you.',
    usage: '<script>',
    examples: ['embed {embed}{title: Rules}$v{description: Be nice}'],
    permissions: ['ManageMessages'],
    args: [{ name: 'script', type: 'rest', required: true, description: 'the embed script' }],
    async run(ctx) {
      const payload = variables.render(ctx.args.script, {
        user: ctx.user,
        member: ctx.member,
        guild: ctx.guild,
        channel: ctx.channel,
      });
      if (!payload.embeds && !payload.content) return ctx.error('That script produced an empty message.');
      return ctx.channel.send(payload);
    },
  },

  {
    name: 'say',
    aliases: ['echo'],
    category: 'Utility',
    description: 'Make the bot repeat something.',
    usage: '<text>',
    examples: ['say hello everyone'],
    permissions: ['ManageMessages'],
    args: [{ name: 'text', type: 'rest', required: true, description: 'what to say' }],
    async run(ctx) {
      if (ctx.message) await ctx.message.delete().catch(() => {});
      return ctx.channel.send({ content: truncate(ctx.args.text, 2000), allowedMentions: { parse: [] } });
    },
  },

  {
    name: 'poll',
    category: 'Utility',
    description: 'Start a quick yes/no or multiple-choice poll.',
    details: 'Separate options with `|` for a multiple-choice poll, up to 9 options. Without options it is a yes/no poll.',
    usage: '<question> [| option | option]',
    examples: ['poll pizza tonight?', 'poll dinner? | pizza | sushi | tacos'],
    permissions: ['ManageMessages'],
    botPermissions: ['AddReactions'],
    args: [{ name: 'question', type: 'rest', required: true, description: 'the question, and options after a |' }],
    async run(ctx) {
      const [question, ...options] = ctx.args.question.split('|').map((part) => part.trim()).filter(Boolean);
      const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

      const embed = ctx.embed({
        title: `📊 ${truncate(question, 250)}`,
        description: options.length
          ? options.slice(0, 9).map((option, index) => `${numbers[index]} ${option}`).join('\n')
          : `${emojis.success} yes\n${emojis.error} no`,
        footer: { text: `Poll by ${ctx.user.tag}` },
      });

      const message = await ctx.channel.send({ embeds: [embed] });
      const reactions = options.length ? numbers.slice(0, Math.min(9, options.length)) : [emojis.success, emojis.error];
      for (const reaction of reactions) await message.react(reaction).catch(() => {});
      if (ctx.message) await ctx.message.delete().catch(() => {});
      return message;
    },
  },

  {
    name: 'timestamp',
    aliases: ['ts'],
    category: 'Utility',
    description: 'Turn a duration into a Discord timestamp you can paste anywhere.',
    usage: '<duration>',
    examples: ['timestamp 2h', 'timestamp 3d'],
    guildOnly: false,
    args: [{ name: 'duration', type: 'duration', required: true, description: 'how far in the future, e.g. 2h' }],
    async run(ctx) {
      const target = now() + ctx.args.duration;
      const formats = ['t', 'T', 'd', 'D', 'f', 'F', 'R'];
      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Timestamps',
            description: formats.map((format) => `\`<t:${target}:${format}>\` ${emojis.arrow} <t:${target}:${format}>`).join('\n'),
          }),
        ],
      });
    },
  },

  {
    name: 'calculate',
    aliases: ['calc', 'math'],
    category: 'Utility',
    description: 'Work out a simple sum.',
    details: 'Supports + - * / % ^ and brackets. Nothing else is allowed, so it cannot run arbitrary code.',
    usage: '<expression>',
    examples: ['calc 2 + 2 * 10', 'calc (45/9)^2'],
    guildOnly: false,
    args: [{ name: 'expression', type: 'rest', required: true, description: 'the sum to work out' }],
    async run(ctx) {
      const raw = ctx.args.expression.replace(/\^/g, '**').replace(/×/g, '*').replace(/÷/g, '/');
      // Whitelist: digits, operators, brackets, dots and spaces only.
      if (!/^[\d+\-*/%(). \t]+$/.test(raw)) {
        return ctx.error('Only numbers and `+ - * / % ^ ( )` are allowed.');
      }
      try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${raw});`)();
        if (typeof result !== 'number' || !Number.isFinite(result)) return ctx.error('That does not work out to a number.');
        return ctx.send({
          embeds: [ctx.embed({ description: `\`${truncate(ctx.args.expression, 200)}\` = **${result.toLocaleString('en-US')}**` })],
        });
      } catch {
        return ctx.error('I could not work that out. Check the brackets.');
      }
    },
  },

  {
    name: 'color',
    aliases: ['colour'],
    category: 'Utility',
    description: 'Preview a hex colour.',
    usage: '<hex>',
    examples: ['color #8b5cf6', 'color random'],
    guildOnly: false,
    args: [{ name: 'hex', type: 'string', required: true, description: 'a hex colour, or `random`' }],
    async run(ctx) {
      let hex = ctx.args.hex.trim();
      if (hex.toLowerCase() === 'random') hex = `#${randomInt(0, 0xffffff).toString(16).padStart(6, '0')}`;
      if (!/^#?[0-9a-f]{6}$/i.test(hex)) return ctx.error('Give me a hex colour like `#8b5cf6`.');
      if (!hex.startsWith('#')) hex = `#${hex}`;

      const int = Number.parseInt(hex.slice(1), 16);
      const r = (int >> 16) & 255;
      const g = (int >> 8) & 255;
      const b = int & 255;

      return ctx.send({
        embeds: [
          ctx.embed({
            color: int,
            title: hex.toUpperCase(),
            description: `**RGB** ${r}, ${g}, ${b}\n**Int** ${int}`,
            thumbnail: `https://singlecolorimage.com/get/${hex.slice(1)}/200x200`,
          }),
        ],
      });
    },
  },

  {
    name: 'highlight add',
    category: 'Utility',
    description: 'Get a DM whenever a word you care about is said.',
    details: 'Like a keyword notification. I only DM you if you can actually see the channel it was said in.',
    usage: '<word>',
    examples: ['highlight add my-project'],
    args: [{ name: 'word', type: 'rest', required: true, description: 'the word to watch for' }],
    async run(ctx) {
      const word = ctx.args.word.toLowerCase().slice(0, 100);
      if (word.length < 2) return ctx.error('Highlights must be at least **2** characters.');

      const count = store.db.prepare('SELECT COUNT(*) AS total FROM highlights WHERE guild_id = ? AND user_id = ?').get(ctx.guild.id, ctx.user.id).total;
      if (count >= 25) return ctx.error('You can only watch **25** words per server.');

      store.db.prepare('INSERT OR IGNORE INTO highlights (guild_id, user_id, word) VALUES (?, ?, ?)').run(ctx.guild.id, ctx.user.id, word);
      return ctx.whisper({ embeds: [ctx.theme.success(`I will DM you when **${word}** is mentioned.`)] });
    },
  },

  {
    name: 'highlight remove',
    category: 'Utility',
    description: 'Stop watching a word.',
    usage: '<word>',
    examples: ['highlight remove my-project'],
    args: [{ name: 'word', type: 'rest', required: true, description: 'the word to stop watching' }],
    async run(ctx) {
      const changed = store.db
        .prepare('DELETE FROM highlights WHERE guild_id = ? AND user_id = ? AND word = ?')
        .run(ctx.guild.id, ctx.user.id, ctx.args.word.toLowerCase()).changes;
      if (!changed) return ctx.error('You are not watching that word.');
      return ctx.whisper({ embeds: [ctx.theme.success('Highlight removed.')] });
    },
  },

  {
    name: 'highlight list',
    aliases: ['highlights'],
    category: 'Utility',
    description: 'Show the words you are watching.',
    examples: ['highlight list'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT word FROM highlights WHERE guild_id = ? AND user_id = ?').all(ctx.guild.id, ctx.user.id);
      if (!rows.length) return ctx.whisper({ embeds: [ctx.theme.info('You are not watching any words here.')] });
      return ctx.whisper({
        embeds: [ctx.embed({ title: 'Your highlights', description: rows.map((row) => `\`${row.word}\``).join(', ') })],
      });
    },
  },

  {
    name: 'autoresponder add',
    aliases: ['ar add'],
    category: 'Utility',
    description: 'Make the bot reply automatically to a phrase.',
    details: 'Matches anywhere in a message by default. Supports message variables and embed scripts.',
    usage: '<trigger> | <response>',
    examples: ['autoresponder add hello | hey there {user.mention}'],
    permissions: ['ManageGuild'],
    args: [{ name: 'input', type: 'rest', required: true, description: 'trigger | response' }],
    async run(ctx) {
      const [trigger, ...rest] = ctx.args.input.split('|');
      const response = rest.join('|').trim();
      if (!trigger?.trim() || !response) return ctx.usage('Separate the trigger and response with a `|`.');

      store.db
        .prepare('INSERT INTO autoresponders (guild_id, trigger, response) VALUES (?, ?, ?)')
        .run(ctx.guild.id, trigger.trim().toLowerCase(), response);
      return ctx.success(`I will now reply to **${truncate(trigger.trim(), 60)}**.`);
    },
  },

  {
    name: 'autoresponder remove',
    aliases: ['ar remove'],
    category: 'Utility',
    description: 'Delete an autoresponder by its ID.',
    usage: '<id>',
    examples: ['autoresponder remove 2'],
    permissions: ['ManageGuild'],
    args: [{ name: 'id', type: 'integer', required: true, description: 'the ID from the list' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM autoresponders WHERE guild_id = ? AND id = ?').run(ctx.guild.id, ctx.args.id).changes;
      if (!changed) return ctx.error('No autoresponder with that ID.');
      return ctx.success('Autoresponder deleted.');
    },
  },

  {
    name: 'autoresponder list',
    aliases: ['ar list', 'autoresponders'],
    category: 'Utility',
    description: 'List this server’s autoresponders.',
    examples: ['autoresponder list'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM autoresponders WHERE guild_id = ?').all(ctx.guild.id);
      if (!rows.length) return ctx.info('No autoresponders set up.');

      return ctx.paginateRows(
        rows.map((row) => `\`${row.id}\` **${truncate(row.trigger, 40)}** ${emojis.arrow} ${truncate(row.response, 80)}`),
        { perPage: 8, title: 'Autoresponders', numbered: false },
      );
    },
  },

  {
    name: 'sticky',
    category: 'Utility',
    description: 'Keep a message pinned to the bottom of a channel.',
    details: 'I repost it whenever it scrolls away. Use `sticky remove` to stop.',
    usage: '<message>',
    examples: ['sticky Read the rules before posting'],
    permissions: ['ManageMessages'],
    args: [{ name: 'message', type: 'rest', required: true, description: 'the message to stick' }],
    async run(ctx) {
      store.db
        .prepare(
          `INSERT INTO sticky_messages (guild_id, channel_id, content) VALUES (?, ?, ?)
           ON CONFLICT(channel_id) DO UPDATE SET content = excluded.content`,
        )
        .run(ctx.guild.id, ctx.channel.id, ctx.args.message);

      const payload = variables.render(ctx.args.message, { guild: ctx.guild, channel: ctx.channel });
      const posted = await ctx.channel.send(payload);
      store.db.prepare('UPDATE sticky_messages SET last_message_id = ? WHERE channel_id = ?').run(posted.id, ctx.channel.id);
      return undefined;
    },
  },

  {
    name: 'sticky remove',
    category: 'Utility',
    description: 'Stop the sticky message in this channel.',
    examples: ['sticky remove'],
    permissions: ['ManageMessages'],
    async run(ctx) {
      const row = store.db.prepare('SELECT * FROM sticky_messages WHERE channel_id = ?').get(ctx.channel.id);
      if (!row) return ctx.error('No sticky message here.');

      if (row.last_message_id) {
        await ctx.channel.messages.fetch(row.last_message_id).then((message) => message.delete()).catch(() => {});
      }
      store.db.prepare('DELETE FROM sticky_messages WHERE channel_id = ?').run(ctx.channel.id);
      return ctx.success('Sticky message removed.');
    },
  },
];
