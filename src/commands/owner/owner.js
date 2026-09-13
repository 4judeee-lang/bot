'use strict';

const store = require('../../lib/db');
const { truncate, formatNumber } = require('../../lib/util');
const emojis = require('../../lib/emojis');

/**
 * Bot-owner commands. Every one of these is gated by `ownerOnly`, which is
 * checked against OWNER_IDS in the environment — server administrators cannot
 * reach them.
 */
module.exports = [
  {
    name: 'blacklist',
    category: 'Owner',
    description: 'Block a user or server from using the bot.',
    usage: '<id> [reason]',
    examples: ['blacklist 123456789012345678 abuse'],
    ownerOnly: true,
    guildOnly: false,
    args: [
      { name: 'id', type: 'string', required: true, description: 'user or guild ID' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason given', description: 'why' },
    ],
    async run(ctx) {
      if (!/^\d{15,25}$/.test(ctx.args.id)) return ctx.error('That is not a valid ID.');

      const isGuild = ctx.client.guilds.cache.has(ctx.args.id);
      store.db
        .prepare('INSERT OR REPLACE INTO blacklist (id, kind, reason) VALUES (?, ?, ?)')
        .run(ctx.args.id, isGuild ? 'guild' : 'user', ctx.args.reason);
      return ctx.success(`Blacklisted \`${ctx.args.id}\` (${isGuild ? 'server' : 'user'}).`);
    },
  },

  {
    name: 'unblacklist',
    category: 'Owner',
    description: 'Remove a blacklist entry.',
    usage: '<id>',
    examples: ['unblacklist 123456789012345678'],
    ownerOnly: true,
    guildOnly: false,
    args: [{ name: 'id', type: 'string', required: true, description: 'the ID to clear' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM blacklist WHERE id = ?').run(ctx.args.id).changes;
      if (!changed) return ctx.error('That ID is not blacklisted.');
      return ctx.success(`\`${ctx.args.id}\` removed from the blacklist.`);
    },
  },

  {
    name: 'blacklisted',
    category: 'Owner',
    description: 'List every blacklisted user and server.',
    examples: ['blacklisted'],
    ownerOnly: true,
    guildOnly: false,
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM blacklist').all();
      if (!rows.length) return ctx.info('The blacklist is empty.');
      return ctx.paginateRows(
        rows.map((row) => `\`${row.id}\` (${row.kind}) — ${truncate(row.reason ?? '', 60)}`),
        { perPage: 10, title: 'Blacklist' },
      );
    },
  },

  {
    name: 'servers',
    aliases: ['guilds'],
    category: 'Owner',
    description: 'List every server the bot is in.',
    examples: ['servers'],
    ownerOnly: true,
    guildOnly: false,
    async run(ctx) {
      const guilds = [...ctx.client.guilds.cache.values()].sort((a, b) => b.memberCount - a.memberCount);
      return ctx.paginateRows(
        guilds.map((guild) => `**${truncate(guild.name, 40)}** ${emojis.dot} ${formatNumber(guild.memberCount)} members ${emojis.dot} \`${guild.id}\``),
        { perPage: 10, title: `Servers — ${guilds.length}` },
      );
    },
  },

  {
    name: 'leaveserver',
    category: 'Owner',
    description: 'Make the bot leave a server.',
    usage: '<guild id>',
    examples: ['leaveserver 123456789012345678'],
    ownerOnly: true,
    guildOnly: false,
    args: [{ name: 'guild', type: 'string', required: true, description: 'the server ID' }],
    async run(ctx) {
      const guild = ctx.client.guilds.cache.get(ctx.args.guild);
      if (!guild) return ctx.error('I am not in a server with that ID.');

      const confirmed = await ctx.confirm({ title: 'Leave server', description: `Leave **${guild.name}**?` });
      if (!confirmed) return undefined;

      await guild.leave();
      return ctx.success(`Left **${guild.name}**.`);
    },
  },

  {
    name: 'reload',
    category: 'Owner',
    description: 'Reload every command file without restarting the bot.',
    examples: ['reload'],
    ownerOnly: true,
    guildOnly: false,
    async run(ctx) {
      const { Registry } = require('../../lib/registry');
      try {
        const registry = new Registry().load();
        ctx.client.registry = registry;
        return ctx.success(`Reloaded **${registry.size}** commands.`);
      } catch (error) {
        return ctx.error(`Reload failed:\n\`\`\`${truncate((error.problems ?? [error.message]).join('\n'), 1500)}\`\`\``);
      }
    },
  },

  {
    name: 'setstatus',
    category: 'Owner',
    description: 'Change the bot’s presence.',
    usage: '<playing|watching|listening> <text>',
    examples: ['setstatus watching the server'],
    ownerOnly: true,
    guildOnly: false,
    args: [
      { name: 'kind', type: 'choice', required: true, choices: ['playing', 'watching', 'listening', 'competing'], description: 'activity type' },
      { name: 'text', type: 'rest', required: true, description: 'the status text' },
    ],
    async run(ctx) {
      const { ActivityType } = require('discord.js');
      const types = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        competing: ActivityType.Competing,
      };
      ctx.client.user.setPresence({ activities: [{ name: truncate(ctx.args.text, 120), type: types[ctx.args.kind] }] });
      return ctx.success(`Status set to **${ctx.args.kind} ${truncate(ctx.args.text, 100)}**.`);
    },
  },

  {
    name: 'dbstats',
    category: 'Owner',
    description: 'Row counts for every table in the database.',
    examples: ['dbstats'],
    ownerOnly: true,
    guildOnly: false,
    async run(ctx) {
      const tables = store.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all();

      const rows = tables.map((table) => {
        const count = store.db.prepare(`SELECT COUNT(*) AS total FROM "${table.name}"`).get().total;
        return `\`${table.name}\` — ${formatNumber(count)}`;
      });

      return ctx.paginateRows(rows, { perPage: 15, title: 'Database', numbered: false });
    },
  },

  {
    name: 'announce',
    category: 'Owner',
    description: 'Send a message to every server’s system channel.',
    usage: '<message>',
    examples: ['announce Downtime tonight at 9pm UTC'],
    ownerOnly: true,
    guildOnly: false,
    cooldown: 60,
    args: [{ name: 'message', type: 'rest', required: true, description: 'what to announce' }],
    async run(ctx) {
      const confirmed = await ctx.confirm({
        title: 'Broadcast',
        description: `Send this to **${ctx.client.guilds.cache.size}** server(s)?\n\n${truncate(ctx.args.message, 500)}`,
      });
      if (!confirmed) return undefined;

      let sent = 0;
      for (const guild of ctx.client.guilds.cache.values()) {
        const channel = guild.systemChannel ?? guild.channels.cache.find((c) => c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
        if (!channel) continue;
        const ok = await channel
          .send({ embeds: [ctx.embed({ title: '📢 Announcement', description: truncate(ctx.args.message, 4000) })] })
          .then(() => true)
          .catch(() => false);
        if (ok) sent += 1;
      }
      return ctx.success(`Delivered to **${sent}** server(s).`);
    },
  },
];
