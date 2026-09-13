'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../lib/db');
const roles = require('../../modules/roles');
const invites = require('../../modules/invites');
const { truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');

module.exports = [
  {
    name: 'reactionrole add',
    aliases: ['rr add'],
    category: 'Roles',
    description: 'Give a role to anyone who reacts to a message.',
    details:
      'Reacting adds the role, removing the reaction takes it away. The message must be in this server — ' +
      'copy its ID with Developer Mode on.',
    usage: '<message id> <emoji> <role>',
    examples: ['reactionrole add 123456789012345678 🎮 Gamer'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles', 'AddReactions'],
    args: [
      { name: 'message', type: 'string', required: true, description: 'the message ID to watch' },
      { name: 'emoji', type: 'emoji', required: true, description: 'the emoji people react with' },
      { name: 'role', type: 'role', required: true, description: 'the role to give' },
    ],
    async run(ctx) {
      const { message: messageId, emoji, role } = ctx.args;
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);

      // Find the message anywhere in the server, so people do not have to be
      // in the right channel to set it up.
      let target = null;
      for (const channel of ctx.guild.channels.cache.values()) {
        if (!channel.isTextBased?.()) continue;
        target = await channel.messages.fetch(messageId).catch(() => null);
        if (target) break;
      }
      if (!target) return ctx.error('I could not find that message. Check the ID and that I can see the channel.');

      await target.react(emoji.toString()).catch(() => null);
      roles.addReactionRole({
        guildId: ctx.guild.id,
        channelId: target.channel.id,
        messageId: target.id,
        emoji,
        roleId: role.id,
      });

      return ctx.success(`Reacting with ${emoji} on [that message](${target.url}) now gives **${role.name}**.`);
    },
  },

  {
    name: 'reactionrole remove',
    aliases: ['rr remove'],
    category: 'Roles',
    description: 'Stop a reaction from giving a role.',
    usage: '<message id> <emoji>',
    examples: ['reactionrole remove 123456789012345678 🎮'],
    permissions: ['ManageRoles'],
    args: [
      { name: 'message', type: 'string', required: true, description: 'the message ID' },
      { name: 'emoji', type: 'emoji', required: true, description: 'the emoji to unbind' },
    ],
    async run(ctx) {
      if (!roles.removeReactionRole(ctx.args.message, ctx.args.emoji)) {
        return ctx.error('That emoji is not bound to a role on that message.');
      }
      return ctx.success('Reaction role removed.');
    },
  },

  {
    name: 'reactionrole list',
    aliases: ['rr list'],
    category: 'Roles',
    description: 'List every reaction role in the server.',
    examples: ['reactionrole list'],
    permissions: ['ManageRoles'],
    async run(ctx) {
      const rows = roles.listReactionRoles(ctx.guild.id);
      if (!rows.length) return ctx.info(`None set up. Add one with \`${ctx.prefix}reactionrole add\`.`);

      return ctx.paginateRows(
        rows.map(
          (row) =>
            `${row.emoji.includes(':') ? `<:${row.emoji}>` : row.emoji} ${emojis.arrow} <@&${row.role_id}>\n` +
            ` └ [message](https://discord.com/channels/${ctx.guild.id}/${row.channel_id}/${row.message_id})`,
        ),
        { perPage: 8, title: 'Reaction roles', numbered: false },
      );
    },
  },

  {
    name: 'buttonrole',
    aliases: ['br'],
    category: 'Roles',
    description: 'Post a message with buttons that hand out roles.',
    details:
      'Give up to five roles separated by `|`. Members press a button to add the role and press it again to ' +
      'remove it. The buttons keep working after a restart.',
    usage: '<title> | <role> | [role] …',
    examples: ['buttonrole Pick your pings | @Announcements | @Events'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [{ name: 'input', type: 'rest', required: true, description: 'title | role | role …' }],
    async run(ctx) {
      const parts = ctx.args.input.split('|').map((part) => part.trim()).filter(Boolean);
      const title = parts.shift();
      if (!parts.length) return ctx.usage('Name at least one role after the title.');

      const resolver = require('../../lib/arguments').resolveRole;
      const wanted = parts.slice(0, 5).map((text) => resolver(ctx.guild, text));
      if (wanted.some((role) => !role)) return ctx.error('One of those roles could not be found.');

      const tooHigh = wanted.find((role) => ctx.me.roles.highest.comparePositionTo(role) <= 0);
      if (tooHigh) return ctx.error(`**${tooHigh.name}** is above my highest role.`);

      const row = new ActionRowBuilder().addComponents(
        wanted.map((role) =>
          new ButtonBuilder().setCustomId(`role:${role.id}`).setLabel(truncate(role.name, 80)).setStyle(ButtonStyle.Secondary),
        ),
      );

      const message = await ctx.channel.send({
        embeds: [
          ctx.embed({
            title: truncate(title, 250),
            description: wanted.map((role) => `${emojis.dot} ${role}`).join('\n'),
            footer: { text: 'Press a button to add or remove a role' },
          }),
        ],
        components: [row],
      });

      for (const role of wanted) {
        store.db
          .prepare('INSERT INTO button_roles (guild_id, message_id, channel_id, role_id, label) VALUES (?, ?, ?, ?, ?)')
          .run(ctx.guild.id, message.id, ctx.channel.id, role.id, role.name);
      }
      return undefined;
    },
  },

  {
    name: 'invites',
    category: 'Roles',
    description: 'See how many people someone has invited.',
    usage: '[member]',
    examples: ['invites', 'invites @user'],
    botPermissions: ['ManageGuild'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose invites to check' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const stats = invites.stats(ctx.guild.id, user.id);

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: user.tag, iconURL: user.displayAvatarURL() },
            description: `**${stats.total}** invite(s) that stuck`,
            fields: [
              { name: 'Joined', value: String(stats.invites ?? 0), inline: true },
              { name: 'Left again', value: String(stats.leaves ?? 0), inline: true },
              { name: 'Bonus', value: String(stats.bonus ?? 0), inline: true },
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'inviteleaderboard',
    aliases: ['invitelb', 'topinvites'],
    category: 'Roles',
    description: 'Who has invited the most people.',
    examples: ['inviteleaderboard'],
    async run(ctx) {
      const rows = invites.leaderboard(ctx.guild.id).filter((row) => row.total > 0);
      if (!rows.length) return ctx.info('No invites tracked yet.');

      const medals = ['🥇', '🥈', '🥉'];
      return ctx.paginateRows(
        rows.map((row, index) => `${medals[index] ?? ''} <@${row.user_id}> ${emojis.dot} **${row.total}** invite(s)`),
        { perPage: 10, title: 'Invite leaderboard' },
      );
    },
  },

  {
    name: 'inviter',
    category: 'Roles',
    description: 'Find out who invited a member.',
    usage: '<member>',
    examples: ['inviter @user'],
    args: [{ name: 'member', type: 'user', required: true, description: 'who to look up' }],
    async run(ctx) {
      const record = invites.whoInvited(ctx.guild.id, ctx.args.member.id);
      if (!record?.inviter_id) return ctx.info('I do not know who invited them — I may not have been here at the time.');
      return ctx.info(`**${ctx.args.member.username}** was invited by <@${record.inviter_id}> (code \`${record.code}\`).`);
    },
  },

  {
    name: 'addinvites',
    category: 'Roles',
    description: 'Add or remove bonus invites for someone.',
    usage: '<member> <amount>',
    examples: ['addinvites @user 5'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'member', type: 'user', required: true, description: 'who to adjust' },
      { name: 'amount', type: 'integer', required: true, description: 'how many (negative to remove)' },
    ],
    async run(ctx) {
      const stats = invites.addBonus(ctx.guild.id, ctx.args.member.id, ctx.args.amount);
      return ctx.success(`**${ctx.args.member.username}** now has **${stats.total}** invite(s).`);
    },
  },
];
