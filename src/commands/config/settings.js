'use strict';

const store = require('../../lib/db');
const { SETTINGS, CATEGORIES, coerce } = require('../../lib/settingsSchema');
const { truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');
const config = require('../../config');

/** Render one setting's current value in a human-readable way. */
function display(guild, key, value) {
  const meta = SETTINGS[key];
  if (value === null || value === undefined || value === '') return '*not set*';

  switch (meta.type) {
    case 'boolean':
      return value ? `${emojis.success} on` : `${emojis.error} off`;
    case 'channel':
    case 'category':
      return `<#${value}>`;
    case 'role':
      return `<@&${value}>`;
    case 'channels':
      return value.length ? value.map((id) => `<#${id}>`).join(' ') : '*none*';
    case 'roles':
      return value.length ? value.map((id) => `<@&${id}>`).join(' ') : '*none*';
    case 'strings':
      return value.length ? truncate(value.map((v) => `\`${v}\``).join(', '), 300) : '*none*';
    case 'color':
      return `\`${value}\``;
    case 'template':
    case 'text':
      return `\`\`\`${truncate(String(value), 300) || ' '}\`\`\``;
    default:
      return `\`${truncate(String(value), 200)}\``;
  }
}

module.exports = [
  {
    name: 'prefix',
    category: 'Configuration',
    description: 'Show or change the command prefix for this server.',
    details: 'Mentioning the bot always works as a prefix too, so you can never lock yourself out.',
    usage: '[new prefix]',
    examples: ['prefix', 'prefix !'],
    args: [{ name: 'prefix', type: 'string', required: false, description: 'the new prefix (max 5 characters)' }],
    slash: true,
    async run(ctx) {
      if (!ctx.args.prefix) return ctx.info(`My prefix here is \`${ctx.prefix}\`.`);
      if (!ctx.member.permissions.has('ManageGuild')) return ctx.error('You need `Manage Server` to change the prefix.');
      if (ctx.args.prefix.length > 5) return ctx.error('Prefixes can be at most **5** characters.');

      store.setPrefix(ctx.guild.id, ctx.args.prefix);
      return ctx.success(`Prefix set to \`${ctx.args.prefix}\` — try \`${ctx.args.prefix}help\`.`);
    },
  },

  {
    name: 'config',
    aliases: ['settings', 'cfg'],
    category: 'Configuration',
    description: 'View every setting in a category, or jump to the dashboard.',
    details:
      'Run on its own to see the categories. Pass a category to see its settings and their current values. ' +
      `Change one with \`${'{prefix}'}set <key> <value>\`, or use the website where everything is a form field.`,
    usage: '[category]',
    examples: ['config', 'config levels', 'config automod'],
    permissions: ['ManageGuild'],
    slash: true,
    args: [{ name: 'category', type: 'string', required: false, description: 'which category to open' }],
    async run(ctx) {
      const requested = ctx.args.category;

      if (!requested) {
        const embed = ctx.embed({
          title: `${emojis.sparkle} Server configuration`,
          description:
            `**${Object.keys(SETTINGS).length}** settings across **${CATEGORIES.length}** categories.\n` +
            `\`${ctx.prefix}config <category>\` to view one ${emojis.dot} \`${ctx.prefix}set <key> <value>\` to change one.` +
            (config.web.baseUrl ? `\n\nOr do it all visually: ${config.web.baseUrl}/dashboard` : ''),
          fields: [
            {
              name: 'Categories',
              value: CATEGORIES.map((category) => `\`${category.toLowerCase()}\``).join(' • '),
              inline: false,
            },
          ],
        });
        return ctx.send({ embeds: [embed] });
      }

      const category = CATEGORIES.find((name) => name.toLowerCase() === requested.toLowerCase());
      if (!category) {
        return ctx.error(`Unknown category. Try one of: ${CATEGORIES.map((c) => `\`${c.toLowerCase()}\``).join(', ')}`);
      }

      const keys = Object.keys(SETTINGS).filter((key) => SETTINGS[key].category === category);
      const current = store.getSettings(ctx.guild.id);

      const rows = keys.map((key) => {
        const meta = SETTINGS[key];
        return `**${meta.label}** — \`${key}\`\n └ ${display(ctx.guild, key, current[key])}`;
      });

      return ctx.paginateRows(rows, {
        perPage: 6,
        numbered: false,
        title: `${category} settings`,
        description: `Change one with \`${ctx.prefix}set <key> <value>\``,
      });
    },
  },

  {
    name: 'set',
    category: 'Configuration',
    description: 'Change any setting by its key.',
    details:
      'Keys look like `levels.enabled` or `embed.color` — `config <category>` lists them all with their current ' +
      'values. Booleans accept on/off, true/false or yes/no. Channels and roles accept a mention, an ID or a name. ' +
      'List settings (like blocked words) accept comma separated values. Use `reset <key>` to restore the default.',
    usage: '<key> <value>',
    examples: ['set levels.enabled on', 'set embed.color #ff0066', 'set logs.channel #mod-logs'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'key', type: 'string', required: true, description: 'the setting key, e.g. levels.enabled' },
      { name: 'value', type: 'rest', required: true, description: 'the new value' },
    ],
    async run(ctx) {
      const key = ctx.args.key.toLowerCase();
      const meta = SETTINGS[key];
      if (!meta) {
        const near = Object.keys(SETTINGS).filter((candidate) => candidate.includes(key.split('.').pop()));
        return ctx.error(
          `Unknown setting \`${truncate(key, 60)}\`.` +
            (near.length ? `\nDid you mean ${near.slice(0, 4).map((k) => `\`${k}\``).join(', ')}?` : ` Run \`${ctx.prefix}config\`.`),
        );
      }

      // Resolve mentions/names to IDs before validating.
      let raw = ctx.args.value;
      if (['channel', 'category'].includes(meta.type)) {
        const channel = require('../../lib/arguments').resolveChannel(ctx.guild, raw);
        if (!channel) return ctx.error(`I could not find a channel called **${truncate(raw, 50)}**.`);
        raw = channel.id;
      } else if (meta.type === 'role') {
        const role = require('../../lib/arguments').resolveRole(ctx.guild, raw);
        if (!role) return ctx.error(`I could not find a role called **${truncate(raw, 50)}**.`);
        raw = role.id;
      } else if (meta.type === 'channels' || meta.type === 'roles') {
        const resolver = meta.type === 'roles' ? require('../../lib/arguments').resolveRole : require('../../lib/arguments').resolveChannel;
        const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
        const resolved = parts.map((part) => resolver(ctx.guild, part)).filter(Boolean);
        if (resolved.length !== parts.length) return ctx.error('One or more of those could not be found.');
        raw = resolved.map((entry) => entry.id);
      } else if (meta.type === 'strings') {
        raw = raw.split(',').map((part) => part.trim()).filter(Boolean);
      }

      const result = coerce(key, raw);
      if (!result.ok) {
        return ctx.error(
          `${result.error}.` +
            (meta.type === 'select' ? ` Allowed: ${meta.options.map((o) => `\`${o}\``).join(', ')}` : ''),
        );
      }

      store.setSetting(ctx.guild.id, key, result.value);
      return ctx.success(`**${meta.label}** is now ${display(ctx.guild, key, result.value)}`);
    },
  },

  {
    name: 'reset',
    category: 'Configuration',
    description: 'Restore a setting to its default value.',
    usage: '<key | all>',
    examples: ['reset embed.color', 'reset all'],
    permissions: ['ManageGuild'],
    args: [{ name: 'key', type: 'string', required: true, description: 'the setting key, or `all`' }],
    async run(ctx) {
      if (ctx.args.key.toLowerCase() === 'all') {
        const confirmed = await ctx.confirm({
          title: 'Reset all settings',
          description: 'Every module, colour, channel and message template goes back to its default. Your cases, levels and economy are kept.',
          confirmLabel: 'Reset everything',
        });
        if (!confirmed) return undefined;
        store.resetSettings(ctx.guild.id);
        return ctx.success('All settings restored to their defaults.');
      }

      const key = ctx.args.key.toLowerCase();
      if (!SETTINGS[key]) return ctx.error(`Unknown setting \`${truncate(key, 60)}\`.`);
      store.setSetting(ctx.guild.id, key, null);
      return ctx.success(`**${SETTINGS[key].label}** restored to its default.`);
    },
  },

  {
    name: 'dashboard',
    aliases: ['panel', 'website'],
    category: 'Configuration',
    description: 'Get the link to this server’s dashboard.',
    examples: ['dashboard'],
    async run(ctx) {
      if (!config.web.baseUrl) return ctx.error('No dashboard is configured for this bot.');
      return ctx.send({
        embeds: [
          ctx.embed({
            title: `${emojis.sparkle} Dashboard`,
            description:
              `Configure **${ctx.guild.name}** in your browser:\n${config.web.baseUrl}/dashboard/${ctx.guild.id}\n\n` +
              'You need **Manage Server** in this server to open it.',
          }),
        ],
      });
    },
  },

  {
    name: 'disable',
    category: 'Configuration',
    description: 'Disable a command in this server, or in one channel.',
    usage: '<command> [channel]',
    examples: ['disable ship', 'disable play #general'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'command', type: 'string', required: true, description: 'command to disable' },
      { name: 'channel', type: 'channel', required: false, description: 'only in this channel' },
    ],
    async run(ctx) {
      const command = ctx.client.registry.get(ctx.args.command);
      if (!command) return ctx.error(`No command called **${truncate(ctx.args.command, 40)}**.`);
      if (['help', 'disable', 'enable', 'config'].includes(command.name)) return ctx.error('That command cannot be disabled.');

      const scope = ctx.args.channel?.id ?? 'all';
      store.db
        .prepare('INSERT OR IGNORE INTO disabled_commands (guild_id, command, channel_id) VALUES (?, ?, ?)')
        .run(ctx.guild.id, command.name, scope);
      return ctx.success(`\`${command.name}\` disabled ${scope === 'all' ? 'server-wide' : `in <#${scope}>`}.`);
    },
  },

  {
    name: 'enable',
    category: 'Configuration',
    description: 'Re-enable a disabled command.',
    usage: '<command> [channel]',
    examples: ['enable ship'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'command', type: 'string', required: true, description: 'command to enable' },
      { name: 'channel', type: 'channel', required: false, description: 'the channel it was disabled in' },
    ],
    async run(ctx) {
      const command = ctx.client.registry.get(ctx.args.command);
      if (!command) return ctx.error(`No command called **${truncate(ctx.args.command, 40)}**.`);

      const scope = ctx.args.channel?.id ?? 'all';
      const changed = store.db
        .prepare('DELETE FROM disabled_commands WHERE guild_id = ? AND command = ? AND channel_id = ?')
        .run(ctx.guild.id, command.name, scope).changes;
      if (!changed) return ctx.error(`\`${command.name}\` was not disabled ${scope === 'all' ? 'server-wide' : 'there'}.`);
      return ctx.success(`\`${command.name}\` is enabled again.`);
    },
  },

  {
    name: 'disabled',
    category: 'Configuration',
    description: 'List the commands that are switched off here.',
    examples: ['disabled'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM disabled_commands WHERE guild_id = ?').all(ctx.guild.id);
      const categories = store.getSetting(ctx.guild.id, 'general.disabledCategories') ?? [];
      if (!rows.length && !categories.length) return ctx.info('Nothing is disabled in this server.');

      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Disabled commands',
            description:
              (rows.length
                ? rows.map((row) => `\`${row.command}\` — ${row.channel_id === 'all' ? 'server-wide' : `<#${row.channel_id}>`}`).join('\n')
                : '*No individual commands disabled.*') +
              (categories.length ? `\n\n**Disabled categories:** ${categories.map((c) => `\`${c}\``).join(', ')}` : ''),
          }),
        ],
      });
    },
  },

  {
    name: 'alias',
    category: 'Configuration',
    description: 'Create your own name for a command.',
    details: 'Server aliases work exactly like the real command. Use `alias remove <name>` to delete one.',
    usage: '<alias> <command>',
    examples: ['alias yeet ban', 'alias remove yeet'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'alias', type: 'string', required: true, description: 'the new name, or `remove`' },
      { name: 'command', type: 'rest', required: true, description: 'the command it points at' },
    ],
    async run(ctx) {
      if (ctx.args.alias.toLowerCase() === 'remove') {
        const changed = store.db
          .prepare('DELETE FROM command_aliases WHERE guild_id = ? AND alias = ?')
          .run(ctx.guild.id, ctx.args.command.toLowerCase()).changes;
        if (!changed) return ctx.error(`There is no alias called **${truncate(ctx.args.command, 40)}**.`);
        return ctx.success(`Removed the alias \`${ctx.args.command}\`.`);
      }

      const command = ctx.client.registry.get(ctx.args.command);
      if (!command) return ctx.error(`No command called **${truncate(ctx.args.command, 40)}**.`);
      const alias = ctx.args.alias.toLowerCase();
      if (ctx.client.registry.get(alias)) return ctx.error(`\`${alias}\` is already a built-in command.`);

      store.db
        .prepare('INSERT OR REPLACE INTO command_aliases (guild_id, alias, command) VALUES (?, ?, ?)')
        .run(ctx.guild.id, alias, command.name);
      return ctx.success(`\`${ctx.prefix}${alias}\` now runs \`${command.name}\`.`);
    },
  },

  {
    name: 'aliases',
    category: 'Configuration',
    description: 'List this server’s custom command aliases.',
    examples: ['aliases'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM command_aliases WHERE guild_id = ?').all(ctx.guild.id);
      if (!rows.length) return ctx.info(`No custom aliases. Make one with \`${ctx.prefix}alias <name> <command>\`.`);
      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Custom aliases',
            description: rows.map((row) => `\`${ctx.prefix}${row.alias}\` ${emojis.arrow} \`${row.command}\``).join('\n'),
          }),
        ],
      });
    },
  },

  {
    name: 'module',
    category: 'Configuration',
    description: 'Turn a whole command category on or off.',
    usage: '<category> <on|off>',
    examples: ['module fun off', 'module economy on'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'category', type: 'string', required: true, description: 'category name, e.g. fun' },
      { name: 'state', type: 'boolean', required: true, description: 'on or off' },
    ],
    async run(ctx) {
      const registry = ctx.client.registry;
      const category = [...registry.categories.keys()].find((name) => name.toLowerCase() === ctx.args.category.toLowerCase());
      if (!category) {
        return ctx.error(`Unknown category. Options: ${[...registry.categories.keys()].map((c) => `\`${c.toLowerCase()}\``).join(', ')}`);
      }
      if (['Configuration', 'General'].includes(category)) return ctx.error('That category cannot be disabled.');

      const disabled = new Set(store.getSetting(ctx.guild.id, 'general.disabledCategories') ?? []);
      if (ctx.args.state) disabled.delete(category);
      else disabled.add(category);
      store.setSetting(ctx.guild.id, 'general.disabledCategories', [...disabled]);

      return ctx.success(`**${category}** commands are now ${ctx.args.state ? 'enabled' : 'disabled'}.`);
    },
  },
];
