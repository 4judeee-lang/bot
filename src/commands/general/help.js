'use strict';

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { chunk, titleCase } = require('../../lib/util');
const { eph } = require('../../lib/reply');
const emojis = require('../../lib/emojis');
const config = require('../../config');

const CATEGORY_EMOJI = {
  General: 'ℹ️',
  Moderation: '🔨',
  Configuration: '⚙️',
  Roles: '🎭',
  Utility: '🧰',
  Information: '📊',
  Fun: '🎲',
  Music: '🎵',
  Levels: '📈',
  Economy: '💵',
  Giveaways: '🎁',
  Tickets: '🎫',
  Voice: '🎙️',
  Owner: '👑',
  Social: '🎧',
  Counters: '🔢',
};

/** The detailed, single-command guide. */
function commandEmbed(ctx, command) {
  const prefix = ctx.prefix;
  const embed = ctx.embed({
    title: `${CATEGORY_EMOJI[command.category] ?? emojis.info} ${prefix}${command.name}`,
    description: command.details || command.description,
  });

  embed.addFields({
    name: 'Usage',
    value: `\`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\``,
    inline: false,
  });

  if (command.args.length) {
    embed.addFields({
      name: 'Arguments',
      value: command.args
        .map(
          (arg) =>
            `\`${arg.required ? `<${arg.name}>` : `[${arg.name}]`}\` — ${arg.description ?? `a ${arg.type}`}${
              arg.required ? '' : ' *(optional)*'
            }`,
        )
        .join('\n'),
      inline: false,
    });
  }

  if (command.examples.length) {
    embed.addFields({
      name: 'Examples',
      value: command.examples.map((example) => `\`${prefix}${example}\``).join('\n'),
      inline: false,
    });
  }

  const meta = [];
  if (command.aliases.length) meta.push(`**Aliases:** ${command.aliases.map((a) => `\`${a}\``).join(', ')}`);
  meta.push(`**Category:** ${command.category}`);
  if (command.permissions.length) {
    meta.push(`**You need:** ${command.permissions.map((p) => `\`${titleCase(p.replace(/([A-Z])/g, ' $1').trim())}\``).join(', ')}`);
  }
  if (command.botPermissions.length) {
    meta.push(`**I need:** ${command.botPermissions.map((p) => `\`${titleCase(p.replace(/([A-Z])/g, ' $1').trim())}\``).join(', ')}`);
  }
  if (command.cooldown) meta.push(`**Cooldown:** ${command.cooldown}s`);
  if (command.ownerOnly) meta.push('**Restricted:** bot owners only');
  embed.addFields({ name: 'Details', value: meta.join('\n'), inline: false });

  // Point at related subcommands, e.g. `.antinuke` lists `.antinuke whitelist`.
  const children = ctx.client.registry
    .all()
    .filter((other) => other.name !== command.name && other.name.startsWith(`${command.name} `));
  if (children.length) {
    embed.addFields({
      name: 'Subcommands',
      value: children.map((child) => `\`${prefix}${child.name}\` — ${child.description}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  embed.setFooter({ text: `<required>  [optional] • ${prefix}help for every command` });
  return embed;
}

/** The interactive category browser. */
async function browse(ctx) {
  const registry = ctx.client.registry;
  const categories = [...registry.categories.keys()].sort();

  const home = ctx.embed({
    title: `${emojis.sparkle} ${ctx.client.user.username} — command guide`,
    description:
      `My prefix here is \`${ctx.prefix}\`. Every command also works as a slash command where registered.\n\n` +
      `**${registry.size}** commands across **${categories.length}** categories.\n` +
      `Use \`${ctx.prefix}help <command>\` for a full explanation of any single command` +
      `${config.web.baseUrl ? `, or read the searchable guide at ${config.web.baseUrl}/guide` : ''}.`,
    thumbnail: ctx.client.user.displayAvatarURL(),
  });

  home.addFields(
    chunk(categories, Math.ceil(categories.length / 2)).map((group) => ({
      name: '​',
      value: group
        .map((category) => `${CATEGORY_EMOJI[category] ?? emojis.dot} **${category}** — ${registry.categories.get(category).length}`)
        .join('\n'),
      inline: true,
    })),
  );
  home.setFooter({ text: 'Pick a category below to see its commands' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('help:category')
    .setPlaceholder('Browse a category…')
    .addOptions(
      categories.slice(0, 25).map((category) => ({
        label: category,
        value: category,
        description: `${registry.categories.get(category).length} commands`,
        emoji: CATEGORY_EMOJI[category] ?? emojis.dot,
      })),
    );

  const rows = [new ActionRowBuilder().addComponents(select)];
  if (config.web.baseUrl) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Dashboard').setURL(config.web.baseUrl).setStyle(ButtonStyle.Link),
        new ButtonBuilder().setLabel('Full guide').setURL(`${config.web.baseUrl}/guide`).setStyle(ButtonStyle.Link),
      ),
    );
  }

  const message = await ctx.send({ embeds: [home], components: rows });
  if (!message) return;

  const collector = message.createMessageComponentCollector({ time: 180_000 });

  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== ctx.user.id) {
      return interaction.reply(eph({ content: `${emojis.error} Run \`${ctx.prefix}help\` yourself to browse.` }));
    }

    const category = interaction.values[0];
    const commands = registry.categories.get(category) ?? [];
    const embed = ctx.embed({
      title: `${CATEGORY_EMOJI[category] ?? emojis.dot} ${category}`,
      description:
        commands.map((command) => `\`${ctx.prefix}${command.name}\` — ${command.description}`).join('\n').slice(0, 4000) ||
        'Nothing here yet.',
      footer: { text: `${commands.length} commands • ${ctx.prefix}help <command> for details` },
    });

    collector.resetTimer();
    return interaction.update({ embeds: [embed], components: rows }).catch(() => {});
  });

  collector.on('end', () => {
    const disabled = rows.map((row) => {
      const clone = ActionRowBuilder.from(row);
      clone.components.forEach((component) => {
        if (component.data.style !== ButtonStyle.Link) component.setDisabled(true);
      });
      return clone;
    });
    message.edit({ components: disabled }).catch(() => {});
  });
}

module.exports = [
  {
    name: 'help',
    aliases: ['h', 'commands', 'cmds'],
    category: 'General',
    description: 'Browse every command, or read the full guide for one of them.',
    details:
      'Run without arguments to open the interactive category browser. Pass a command name to see exactly ' +
      'what it does, what each argument means, which permissions it needs, and worked examples.',
    usage: '[command]',
    examples: ['help', 'help ban', 'help antinuke whitelist'],
    args: [{ name: 'command', type: 'rest', required: false, description: 'the command you want explained' }],
    guildOnly: false,
    cooldown: 3,
    slash: true,
    async run(ctx) {
      const query = ctx.args.command;
      if (!query) return browse(ctx);

      const command = ctx.client.registry.get(query.toLowerCase());
      if (command) return ctx.send({ embeds: [commandEmbed(ctx, command)] });

      const suggestions = ctx.client.registry.closest(query);
      return ctx.error(
        `No command called **${query}**.` +
          (suggestions.length ? `\nDid you mean ${suggestions.map((s) => `\`${ctx.prefix}${s}\``).join(', ')}?` : ''),
      );
    },
  },

  {
    name: 'guide',
    category: 'General',
    description: 'Links to the full written guide and the configuration dashboard.',
    details: 'Everything the bot can do, written out properly — including the setup walkthrough for each module.',
    examples: ['guide'],
    guildOnly: false,
    slash: true,
    async run(ctx) {
      const base = config.web.baseUrl;
      const embed = ctx.embed({
        title: `${emojis.sparkle} Getting started`,
        description:
          `**1.** Set a prefix — \`${ctx.prefix}prefix !\`\n` +
          `**2.** Turn on the modules you want — \`${ctx.prefix}config\` or use the dashboard.\n` +
          `**3.** Read any command's guide — \`${ctx.prefix}help <command>\`.\n\n` +
          `Every module (levels, logging, automod, antinuke, tickets, welcome messages, embed colours) ` +
          `can be configured either with commands or from the website.`,
        fields: base
          ? [
              { name: 'Dashboard', value: `${base}/dashboard`, inline: false },
              { name: 'Command guide', value: `${base}/guide`, inline: false },
            ]
          : [],
      });
      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'searchcommands',
    aliases: ['findcmd', 'search commands'],
    category: 'General',
    description: 'Search every command name and description for a keyword.',
    details: 'Useful when you know what you want to do but not what the command is called.',
    usage: '<query>',
    examples: ['searchcommands ban', 'searchcommands colour'],
    args: [{ name: 'query', type: 'rest', required: true, description: 'what to search for' }],
    guildOnly: false,
    async run(ctx) {
      const query = ctx.args.query.toLowerCase();
      const matches = ctx.client.registry
        .all()
        .filter(
          (command) =>
            command.name.includes(query) ||
            command.description.toLowerCase().includes(query) ||
            command.aliases.some((alias) => alias.includes(query)),
        );

      if (!matches.length) return ctx.error(`Nothing matched **${ctx.args.query}**.`);

      return ctx.paginateRows(
        matches.map((command) => `\`${ctx.prefix}${command.name}\` — ${command.description}`),
        { perPage: 12, title: `Search: ${ctx.args.query}`, numbered: false },
      );
    },
  },
];
