'use strict';

const { ChannelType, PermissionsBitField } = require('discord.js');
const counters = require('../../modules/counters');
const { truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');

module.exports = [
  {
    name: 'counter add',
    aliases: ['statschannel add'],
    category: 'Configuration',
    description: 'Turn a channel into a live statistics counter.',
    details:
      'The channel name is rewritten to show the number. Use one of these placeholders in the template: ' +
      '`{members}` `{humans}` `{bots}` `{boosts}` `{channels}` `{roles}`.\n\n' +
      'Discord only allows a channel to be renamed twice every ten minutes, so counters refresh on a ' +
      'ten-minute timer rather than instantly. Locking the channel so nobody can join it is a good idea.',
    usage: '<channel> <template>',
    examples: ['counter add "Member Count" Members: {members}', 'counter add #stats {humans} humans'],
    permissions: ['ManageGuild'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'channel', type: 'channel', required: true, description: 'the channel to rename' },
      { name: 'template', type: 'rest', required: true, description: 'the name, containing a placeholder' },
    ],
    async run(ctx) {
      const { channel, template } = ctx.args;

      if (!counters.TOKENS.some((token) => template.includes(token))) {
        return ctx.error(`Your template needs a placeholder — one of ${counters.TOKENS.map((t) => `\`${t}\``).join(', ')}.`);
      }
      if (!channel.manageable) return ctx.error(`I cannot rename ${channel} — check my permissions on it.`);

      counters.set(ctx.guild.id, channel.id, template);
      await ctx.guild.members.fetch().catch(() => {});
      const name = counters.render(ctx.guild, template);
      await channel.setName(name, `Counter set up by ${ctx.user.tag}`).catch(() => {});

      return ctx.success(`${channel} is now a counter — it will read **${truncate(name, 80)}** and refresh every 10 minutes.`);
    },
  },

  {
    name: 'counter remove',
    category: 'Configuration',
    description: 'Stop a channel being a counter (the name stays as it is).',
    usage: '<channel>',
    examples: ['counter remove #stats'],
    permissions: ['ManageGuild'],
    args: [{ name: 'channel', type: 'channel', required: true, description: 'the counter channel' }],
    async run(ctx) {
      if (!counters.remove(ctx.guild.id, ctx.args.channel.id)) return ctx.error('That channel is not a counter.');
      return ctx.success(`${ctx.args.channel} is no longer a counter.`);
    },
  },

  {
    name: 'counter list',
    aliases: ['counters'],
    category: 'Configuration',
    description: 'Show the counter channels in this server.',
    examples: ['counter list'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const all = counters.list(ctx.guild.id);
      const entries = Object.entries(all);
      if (!entries.length) return ctx.info(`No counters set up. Add one with \`${ctx.prefix}counter add <channel> <template>\`.`);

      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Counter channels',
            description: entries.map(([id, template]) => `<#${id}> ${emojis.arrow} \`${truncate(template, 60)}\``).join('\n'),
            footer: { text: 'Counters refresh every 10 minutes' },
          }),
        ],
      });
    },
  },

  {
    name: 'counter create',
    category: 'Configuration',
    description: 'Create a locked voice channel that shows the member count.',
    details: 'The quick way to get a counter: makes the channel, locks it so nobody can join, and sets it up.',
    usage: '[template]',
    examples: ['counter create', 'counter create Members: {members}'],
    permissions: ['ManageGuild'],
    botPermissions: ['ManageChannels'],
    args: [
      {
        name: 'template',
        type: 'rest',
        required: false,
        default: 'Members: {members}',
        description: 'the name template',
      },
    ],
    async run(ctx) {
      const template = ctx.args.template;
      if (!counters.TOKENS.some((token) => template.includes(token))) {
        return ctx.error(`Your template needs a placeholder — one of ${counters.TOKENS.map((t) => `\`${t}\``).join(', ')}.`);
      }

      await ctx.guild.members.fetch().catch(() => {});

      const channel = await ctx.guild.channels.create({
        name: counters.render(ctx.guild, template),
        type: ChannelType.GuildVoice,
        reason: `Counter channel created by ${ctx.user.tag}`,
        permissionOverwrites: [
          {
            id: ctx.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.Connect],
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
        ],
      });

      counters.set(ctx.guild.id, channel.id, template);
      return ctx.success(`Created ${channel} — nobody can join it, and it refreshes every 10 minutes.`);
    },
  },
];
