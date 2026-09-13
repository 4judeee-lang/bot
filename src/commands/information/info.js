'use strict';

const { version: djsVersion, PermissionsBitField } = require('discord.js');
const os = require('node:os');
const store = require('../../lib/db');
const { relative, longDate, formatNumber, formatDuration, truncate, titleCase } = require('../../lib/util');
const emojis = require('../../lib/emojis');
const config = require('../../config');

const VERIFICATION = ['none', 'low', 'medium', 'high', 'highest'];

/**
 * Everything the bot needs for its features, and nothing more — no
 * Administrator shortcut, so server owners can see exactly what they grant.
 */
const INVITE_PERMISSIONS = [
  'ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'EmbedLinks', 'AttachFiles',
  'ReadMessageHistory', 'AddReactions', 'UseExternalEmojis', 'ManageMessages',
  'ManageChannels', 'ManageRoles', 'ManageNicknames', 'ManageGuildExpressions',
  'KickMembers', 'BanMembers', 'ModerateMembers', 'ManageGuild', 'ViewAuditLog',
  'Connect', 'Speak', 'MuteMembers', 'DeafenMembers', 'MoveMembers', 'ManageWebhooks',
]
  .reduce((bits, flag) => bits | PermissionsBitField.Flags[flag], 0n)
  .toString();

module.exports = [
  {
    name: 'userinfo',
    aliases: ['ui', 'whois', 'user'],
    category: 'Information',
    description: 'Everything about a member — roles, dates, permissions and their record.',
    usage: '[member]',
    examples: ['userinfo', 'userinfo @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to look up (defaults to you)' }],
    slash: true,
    async run(ctx) {
      const user = await ctx.client.users.fetch(ctx.args.member?.id ?? ctx.user.id, { force: true });
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);

      const embed = ctx.embed({
        author: { name: user.tag, iconURL: user.displayAvatarURL() },
        thumbnail: user.displayAvatarURL({ size: 256 }),
        description: `${user} \`${user.id}\`${user.bot ? ` ${emojis.bot} bot` : ''}`,
      });

      embed.addFields(
        { name: 'Account created', value: `${longDate(user.createdAt)}\n${relative(user.createdAt)}`, inline: true },
        member?.joinedAt
          ? { name: 'Joined server', value: `${longDate(member.joinedAt)}\n${relative(member.joinedAt)}`, inline: true }
          : { name: 'Joined server', value: 'not in this server', inline: true },
      );

      if (member) {
        const roles = [...member.roles.cache.values()]
          .filter((role) => role.id !== ctx.guild.id)
          .sort((a, b) => b.position - a.position);

        if (roles.length) {
          embed.addFields({
            name: `Roles (${roles.length})`,
            value: truncate(roles.map((role) => `${role}`).join(' '), 1000),
            inline: false,
          });
        }

        const keyPermissions = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'BanMembers', 'KickMembers', 'ManageMessages']
          .filter((permission) => member.permissions.has(permission));
        if (keyPermissions.length) {
          embed.addFields({
            name: 'Key permissions',
            value: keyPermissions.map((p) => `\`${titleCase(p.replace(/([A-Z])/g, ' $1').trim())}\``).join(', '),
            inline: false,
          });
        }

        const facts = [];
        if (member.id === ctx.guild.ownerId) facts.push(`${emojis.owner} server owner`);
        if (member.premiumSince) facts.push(`${emojis.boost} boosting since ${relative(member.premiumSince)}`);
        if (member.isCommunicationDisabled()) facts.push(`${emojis.mute} timed out until ${relative(member.communicationDisabledUntil)}`);
        if (facts.length) embed.addFields({ name: 'Notes', value: facts.join('\n'), inline: false });

        const cases = store.db
          .prepare('SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND user_id = ?')
          .get(ctx.guild.id, user.id).total;
        const level = store.db.prepare('SELECT level, xp FROM levels WHERE guild_id = ? AND user_id = ?').get(ctx.guild.id, user.id);

        const stats = [];
        if (cases) stats.push(`${cases} moderation case(s)`);
        if (level) stats.push(`level ${level.level} (${formatNumber(level.xp)} xp)`);
        if (stats.length) embed.addFields({ name: 'In this server', value: stats.join(' • '), inline: false });
      }

      if (user.banner) embed.setImage(user.bannerURL({ size: 512 }));
      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'serverinfo',
    aliases: ['si', 'guildinfo', 'server'],
    category: 'Information',
    description: 'Statistics and settings for this server.',
    examples: ['serverinfo'],
    slash: true,
    async run(ctx) {
      const guild = ctx.guild;
      await guild.members.fetch().catch(() => {});

      const channels = guild.channels.cache;
      const humans = guild.members.cache.filter((member) => !member.user.bot).size;
      const bots = guild.members.cache.size - humans;
      const owner = await guild.fetchOwner().catch(() => null);

      const embed = ctx.embed({
        title: guild.name,
        thumbnail: guild.iconURL({ size: 256 }),
        description: guild.description ?? undefined,
        fields: [
          { name: 'Owner', value: owner ? `${owner.user.tag}` : 'unknown', inline: true },
          { name: 'Created', value: relative(guild.createdAt), inline: true },
          { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
          {
            name: `Members (${formatNumber(guild.memberCount)})`,
            value: `${formatNumber(humans)} humans\n${formatNumber(bots)} bots`,
            inline: true,
          },
          {
            name: `Channels (${channels.size})`,
            value:
              `${channels.filter((c) => c.type === 0).size} text\n` +
              `${channels.filter((c) => c.type === 2).size} voice\n` +
              `${channels.filter((c) => c.type === 4).size} categories`,
            inline: true,
          },
          {
            name: 'Boosts',
            value: `${emojis.boost} ${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`,
            inline: true,
          },
          { name: 'Roles', value: String(guild.roles.cache.size - 1), inline: true },
          { name: 'Emojis', value: String(guild.emojis.cache.size), inline: true },
          { name: 'Verification', value: VERIFICATION[guild.verificationLevel] ?? 'unknown', inline: true },
        ],
      });

      if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));
      if (guild.vanityURLCode) embed.addFields({ name: 'Vanity URL', value: `discord.gg/${guild.vanityURLCode}`, inline: true });

      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'avatar',
    aliases: ['av', 'pfp', 'icon'],
    category: 'Information',
    description: 'Show someone’s avatar in full size.',
    usage: '[member]',
    examples: ['avatar', 'avatar @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose avatar (defaults to you)' }],
    slash: true,
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);
      const global = user.displayAvatarURL({ size: 4096 });
      const serverSpecific = member?.avatar ? member.displayAvatarURL({ size: 4096 }) : null;

      const embed = ctx.embed({
        author: { name: user.tag, iconURL: global },
        image: serverSpecific ?? global,
        description: [
          `[png](${user.displayAvatarURL({ extension: 'png', size: 4096 })})`,
          `[jpg](${user.displayAvatarURL({ extension: 'jpg', size: 4096 })})`,
          `[webp](${user.displayAvatarURL({ extension: 'webp', size: 4096 })})`,
        ].join(' • ') + (serverSpecific ? '\n*showing their server avatar*' : ''),
      });
      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'banner',
    category: 'Information',
    description: 'Show someone’s profile banner.',
    usage: '[member]',
    examples: ['banner', 'banner @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose banner' }],
    async run(ctx) {
      const user = await ctx.client.users.fetch((ctx.args.member ?? ctx.user).id, { force: true });
      if (!user.banner) return ctx.error(`**${user.tag}** does not have a banner.`);
      return ctx.send({
        embeds: [ctx.embed({ author: { name: user.tag, iconURL: user.displayAvatarURL() }, image: user.bannerURL({ size: 1024 }) })],
      });
    },
  },

  {
    name: 'servericon',
    category: 'Information',
    description: 'Show this server’s icon.',
    examples: ['servericon'],
    async run(ctx) {
      if (!ctx.guild.iconURL()) return ctx.error('This server has no icon.');
      return ctx.send({ embeds: [ctx.embed({ title: ctx.guild.name, image: ctx.guild.iconURL({ size: 1024 }) })] });
    },
  },

  {
    name: 'roleinfo',
    category: 'Information',
    description: 'Details about a role.',
    usage: '<role>',
    examples: ['roleinfo Moderator'],
    args: [{ name: 'role', type: 'role', required: true, description: 'the role to inspect' }],
    async run(ctx) {
      const role = ctx.args.role;
      const permissions = role.permissions.toArray();

      return ctx.send({
        embeds: [
          ctx.embed({
            title: role.name,
            color: role.color || undefined,
            fields: [
              { name: 'ID', value: `\`${role.id}\``, inline: true },
              { name: 'Colour', value: `\`${role.hexColor}\``, inline: true },
              { name: 'Members', value: String(role.members.size), inline: true },
              { name: 'Position', value: `${role.position} of ${ctx.guild.roles.cache.size}`, inline: true },
              { name: 'Hoisted', value: role.hoist ? 'yes' : 'no', inline: true },
              { name: 'Mentionable', value: role.mentionable ? 'yes' : 'no', inline: true },
              { name: 'Created', value: relative(role.createdAt), inline: true },
              { name: 'Managed', value: role.managed ? 'by an integration' : 'no', inline: true },
              {
                name: `Permissions (${permissions.length})`,
                value: permissions.length
                  ? truncate(permissions.map((p) => `\`${titleCase(p.replace(/([A-Z])/g, ' $1').trim())}\``).join(', '), 1000)
                  : 'none',
                inline: false,
              },
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'channelinfo',
    category: 'Information',
    description: 'Details about a channel.',
    usage: '[channel]',
    examples: ['channelinfo', 'channelinfo #general'],
    args: [{ name: 'channel', type: 'channel', required: false, description: 'which channel' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      return ctx.send({
        embeds: [
          ctx.embed({
            title: `#${channel.name}`,
            description: channel.topic ?? undefined,
            fields: [
              { name: 'ID', value: `\`${channel.id}\``, inline: true },
              { name: 'Type', value: String(channel.type), inline: true },
              { name: 'Category', value: channel.parent?.name ?? 'none', inline: true },
              { name: 'Created', value: relative(channel.createdAt), inline: true },
              { name: 'NSFW', value: channel.nsfw ? 'yes' : 'no', inline: true },
              {
                name: 'Slowmode',
                value: channel.rateLimitPerUser ? formatDuration(channel.rateLimitPerUser) : 'off',
                inline: true,
              },
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'membercount',
    aliases: ['members', 'mc'],
    category: 'Information',
    description: 'How many members this server has.',
    examples: ['membercount'],
    async run(ctx) {
      await ctx.guild.members.fetch().catch(() => {});
      const humans = ctx.guild.members.cache.filter((member) => !member.user.bot).size;
      const bots = ctx.guild.members.cache.size - humans;
      return ctx.send({
        embeds: [
          ctx.embed({
            description:
              `${emojis.members} **${formatNumber(ctx.guild.memberCount)}** members\n` +
              `${emojis.dot} ${formatNumber(humans)} humans\n` +
              `${emojis.bot} ${formatNumber(bots)} bots`,
          }),
        ],
      });
    },
  },

  {
    name: 'boosters',
    category: 'Information',
    description: 'List everyone boosting the server.',
    examples: ['boosters'],
    async run(ctx) {
      await ctx.guild.members.fetch().catch(() => {});
      const boosters = ctx.guild.members.cache
        .filter((member) => member.premiumSince)
        .sort((a, b) => a.premiumSinceTimestamp - b.premiumSinceTimestamp);

      if (!boosters.size) return ctx.info('Nobody is boosting this server yet.');

      return ctx.paginateRows(
        boosters.map((member) => `${member.user.tag} ${emojis.dot} since ${relative(member.premiumSince)}`),
        { perPage: 10, title: `${emojis.boost} Boosters — ${boosters.size}` },
      );
    },
  },

  {
    name: 'ping',
    category: 'Information',
    description: 'Check the bot’s latency.',
    examples: ['ping'],
    guildOnly: false,
    slash: true,
    async run(ctx) {
      const started = Date.now();
      const message = await ctx.send({ embeds: [ctx.embed({ description: `${emojis.loading} measuring…` })] });
      const roundTrip = Date.now() - started;

      const embed = ctx.embed({
        title: '🏓 Pong',
        fields: [
          { name: 'Websocket', value: `${Math.round(ctx.client.ws.ping)}ms`, inline: true },
          { name: 'Round trip', value: `${roundTrip}ms`, inline: true },
        ],
      });

      if (message?.edit) return message.edit({ embeds: [embed] });
      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'botinfo',
    aliases: ['about', 'stats', 'uptime'],
    category: 'Information',
    description: 'Statistics about the bot itself.',
    examples: ['botinfo'],
    guildOnly: false,
    slash: true,
    async run(ctx) {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      const commandUses = store.db.prepare('SELECT COALESCE(SUM(uses), 0) AS total FROM command_stats').get().total;
      const top = store.db.prepare('SELECT command, uses FROM command_stats ORDER BY uses DESC LIMIT 5').all();

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: ctx.client.user.tag, iconURL: ctx.client.user.displayAvatarURL() },
            thumbnail: ctx.client.user.displayAvatarURL(),
            description: `An all-in-one utility bot — moderation, music, levels, economy, logging and a full web dashboard.`,
            fields: [
              { name: 'Servers', value: formatNumber(ctx.client.guilds.cache.size), inline: true },
              {
                name: 'Members',
                value: formatNumber(ctx.client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0)),
                inline: true,
              },
              { name: 'Commands', value: String(ctx.client.registry.size), inline: true },
              { name: 'Uptime', value: formatDuration(process.uptime()), inline: true },
              { name: 'Memory', value: `${used.toFixed(1)} MB`, inline: true },
              { name: 'Latency', value: `${Math.round(ctx.client.ws.ping)}ms`, inline: true },
              { name: 'Node', value: process.version, inline: true },
              { name: 'discord.js', value: `v${djsVersion}`, inline: true },
              { name: 'Host', value: `${os.platform()} ${os.arch()}`, inline: true },
              {
                name: 'Commands run',
                value: `${formatNumber(commandUses)} total${top.length ? `\nTop: ${top.map((row) => `\`${row.command}\``).join(', ')}` : ''}`,
                inline: false,
              },
              ...(config.web.baseUrl ? [{ name: 'Dashboard', value: config.web.baseUrl, inline: false }] : []),
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'invite',
    category: 'Information',
    description: 'Get the link to add this bot to another server.',
    examples: ['invite'],
    guildOnly: false,
    async run(ctx) {
      const url = `https://discord.com/oauth2/authorize?client_id=${ctx.client.user.id}&permissions=${INVITE_PERMISSIONS}&scope=bot%20applications.commands`;
      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Add me to your server',
            description: `[Click here to invite me](${url})` + (config.supportServer ? `\n[Support server](${config.supportServer})` : ''),
          }),
        ],
      });
    },
  },

  {
    name: 'emojis',
    aliases: ['emotes'],
    category: 'Information',
    description: 'List every custom emoji in the server.',
    examples: ['emojis'],
    async run(ctx) {
      const emojiList = [...ctx.guild.emojis.cache.values()];
      if (!emojiList.length) return ctx.info('This server has no custom emojis.');

      return ctx.paginateRows(
        emojiList.map((emoji) => `${emoji} \`:${emoji.name}:\` ${emojis.dot} \`${emoji.id}\``),
        { perPage: 15, title: `Emojis — ${emojiList.length}` },
      );
    },
  },

  {
    name: 'emojiinfo',
    category: 'Information',
    description: 'Details about a custom emoji, including a full-size image.',
    usage: '<emoji>',
    examples: ['emojiinfo :partyparrot:'],
    args: [{ name: 'emoji', type: 'emoji', required: true, description: 'the emoji to inspect' }],
    async run(ctx) {
      const emoji = ctx.args.emoji;
      if (!emoji.id) return ctx.error('That is a standard emoji, so there is nothing extra to show.');

      const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=256`;
      return ctx.send({
        embeds: [
          ctx.embed({
            title: `:${emoji.name}:`,
            image: url,
            fields: [
              { name: 'ID', value: `\`${emoji.id}\``, inline: true },
              { name: 'Animated', value: emoji.animated ? 'yes' : 'no', inline: true },
              { name: 'Download', value: `[link](${url})`, inline: true },
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'steal',
    aliases: ['addemoji'],
    category: 'Information',
    description: 'Copy an emoji from another server into this one.',
    usage: '<emoji> [name]',
    examples: ['steal :cooldance:', 'steal :cooldance: dancing'],
    permissions: ['ManageGuildExpressions'],
    botPermissions: ['ManageGuildExpressions'],
    args: [
      { name: 'emoji', type: 'emoji', required: true, description: 'the emoji to copy' },
      { name: 'name', type: 'string', required: false, description: 'a new name for it' },
    ],
    async run(ctx) {
      const emoji = ctx.args.emoji;
      if (!emoji.id) return ctx.error('Standard emojis cannot be added — they already work everywhere.');

      const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`;
      try {
        const created = await ctx.guild.emojis.create({
          attachment: url,
          name: (ctx.args.name ?? emoji.name).replace(/\W/g, '').slice(0, 32) || 'emoji',
          reason: `Added by ${ctx.user.tag}`,
        });
        return ctx.success(`Added ${created} as \`:${created.name}:\`.`);
      } catch (error) {
        return ctx.error(`Could not add that emoji — ${error.message}`);
      }
    },
  },

  {
    name: 'firstmessage',
    aliases: ['firstmsg'],
    category: 'Information',
    description: 'Jump to the very first message in a channel.',
    usage: '[channel]',
    examples: ['firstmessage', 'firstmessage #general'],
    args: [{ name: 'channel', type: 'textchannel', required: false, description: 'which channel' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      const messages = await channel.messages.fetch({ after: '0', limit: 1 }).catch(() => null);
      const first = messages?.first();
      if (!first) return ctx.error('I could not read that far back.');

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: first.author.tag, iconURL: first.author.displayAvatarURL() },
            description: `${truncate(first.content || '*no text*', 500)}\n\n[Jump to message](${first.url})`,
            footer: { text: `Sent ${first.createdAt.toDateString()}` },
          }),
        ],
      });
    },
  },
];
