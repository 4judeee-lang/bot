'use strict';

const { ChannelType } = require('discord.js');
const mod = require('../../lib/moderation');
const antiraid = require('../../modules/antiraid');
const { formatDuration, truncate, pooled } = require('../../lib/util');
const emojis = require('../../lib/emojis');

/**
 * Bulk delete with a filter. Discord refuses to bulk-delete anything older
 * than 14 days, so those are skipped rather than failing the whole command.
 */
async function purgeWith(ctx, amount, predicate) {
  const channel = ctx.channel;
  const fetched = await channel.messages.fetch({ limit: 100 });
  const cutoff = Date.now() - 14 * 86_400_000;

  const targets = [...fetched.values()]
    .filter((message) => message.createdTimestamp > cutoff)
    .filter((message) => !message.pinned)
    .filter((message) => (ctx.message ? message.id !== ctx.message.id : true))
    .filter(predicate)
    .slice(0, amount);

  if (!targets.length) return 0;
  const deleted = await channel.bulkDelete(targets, true);
  return deleted.size;
}

async function reportPurge(ctx, count, what) {
  const reply = await ctx.send({ embeds: [ctx.theme.success(`Deleted **${count}** ${what}.`)] });
  if (reply?.delete) setTimeout(() => reply.delete().catch(() => {}), 6000);
  await mod.record(ctx, {
    action: 'purge',
    target: ctx.user,
    reason: `${count} ${what} in #${ctx.channel.name}`,
    dm: false,
  });
  return reply;
}

const AMOUNT = { name: 'amount', type: 'integer', required: false, default: 50, description: 'how many messages to scan (max 100)' };

module.exports = [
  {
    name: 'purge',
    aliases: ['clear', 'prune', 'c'],
    category: 'Moderation',
    description: 'Bulk delete messages, optionally only from one member.',
    details:
      'Scans the most recent messages in the channel and deletes up to the amount you asked for. ' +
      'Discord does not allow bulk deletion of messages older than 14 days, and pinned messages are always kept.\n\n' +
      'Subcommands narrow it down: `purge bots`, `purge images`, `purge links`, `purge embeds`, `purge contains <text>`.',
    usage: '<amount> [member]',
    examples: ['purge 50', 'purge 20 @user'],
    permissions: ['ManageMessages'],
    botPermissions: ['ManageMessages'],
    args: [
      { name: 'amount', type: 'integer', required: true, description: 'how many to delete (1-100)' },
      { name: 'member', type: 'user', required: false, description: 'only delete this member’s messages' },
    ],
    slash: true,
    async run(ctx) {
      const amount = Math.min(100, Math.max(1, ctx.args.amount));
      const member = ctx.args.member;
      const count = await purgeWith(ctx, amount, (message) => (member ? message.author.id === member.id : true));
      if (!count) return ctx.error('Nothing to delete — messages older than 14 days cannot be bulk deleted.');
      return reportPurge(ctx, count, member ? `message(s) from ${member.tag}` : 'message(s)');
    },
  },

  {
    name: 'purge bots',
    category: 'Moderation',
    description: 'Delete recent messages sent by bots.',
    usage: '[amount]',
    examples: ['purge bots', 'purge bots 20'],
    permissions: ['ManageMessages'],
    botPermissions: ['ManageMessages'],
    args: [AMOUNT],
    async run(ctx) {
      const count = await purgeWith(ctx, ctx.args.amount, (message) => message.author.bot);
      if (!count) return ctx.error('No recent bot messages to delete.');
      return reportPurge(ctx, count, 'bot message(s)');
    },
  },

  {
    name: 'purge images',
    aliases: ['purge attachments'],
    category: 'Moderation',
    description: 'Delete recent messages that contain an attachment.',
    usage: '[amount]',
    examples: ['purge images 30'],
    permissions: ['ManageMessages'],
    botPermissions: ['ManageMessages'],
    args: [AMOUNT],
    async run(ctx) {
      const count = await purgeWith(ctx, ctx.args.amount, (message) => message.attachments.size > 0);
      if (!count) return ctx.error('No recent messages with attachments.');
      return reportPurge(ctx, count, 'message(s) with attachments');
    },
  },

  {
    name: 'purge links',
    category: 'Moderation',
    description: 'Delete recent messages containing a link.',
    usage: '[amount]',
    examples: ['purge links'],
    permissions: ['ManageMessages'],
    botPermissions: ['ManageMessages'],
    args: [AMOUNT],
    async run(ctx) {
      const count = await purgeWith(ctx, ctx.args.amount, (message) => /https?:\/\//i.test(message.content));
      if (!count) return ctx.error('No recent messages with links.');
      return reportPurge(ctx, count, 'message(s) with links');
    },
  },

  {
    name: 'purge embeds',
    category: 'Moderation',
    description: 'Delete recent messages that contain an embed.',
    usage: '[amount]',
    examples: ['purge embeds'],
    permissions: ['ManageMessages'],
    botPermissions: ['ManageMessages'],
    args: [AMOUNT],
    async run(ctx) {
      const count = await purgeWith(ctx, ctx.args.amount, (message) => message.embeds.length > 0);
      if (!count) return ctx.error('No recent messages with embeds.');
      return reportPurge(ctx, count, 'message(s) with embeds');
    },
  },

  {
    name: 'purge contains',
    category: 'Moderation',
    description: 'Delete recent messages containing a word or phrase.',
    usage: '<text>',
    examples: ['purge contains discord.gg'],
    permissions: ['ManageMessages'],
    botPermissions: ['ManageMessages'],
    args: [{ name: 'text', type: 'rest', required: true, description: 'text to match (case insensitive)' }],
    async run(ctx) {
      const needle = ctx.args.text.toLowerCase();
      const count = await purgeWith(ctx, 100, (message) => message.content.toLowerCase().includes(needle));
      if (!count) return ctx.error(`No recent messages containing **${truncate(ctx.args.text, 50)}**.`);
      return reportPurge(ctx, count, `message(s) containing "${truncate(ctx.args.text, 30)}"`);
    },
  },

  {
    name: 'lock',
    category: 'Moderation',
    description: 'Stop everyone from sending messages in a channel.',
    details: 'Denies Send Messages for @everyone. Staff roles with an explicit allow are unaffected.',
    usage: '[channel] [reason]',
    examples: ['lock', 'lock #general raid in progress'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'channel', type: 'textchannel', required: false, description: 'which channel (defaults to here)' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    slash: true,
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      await channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: false }, { reason: ctx.args.reason });
      const embed = ctx.theme.base({
        color: ctx.theme.warnColor,
        description: `${emojis.lock} This channel has been locked.\n${ctx.args.reason}`,
      });
      if (channel.id !== ctx.channel.id) await channel.send({ embeds: [embed] }).catch(() => {});
      return ctx.success(`Locked ${channel}.`);
    },
  },

  {
    name: 'unlock',
    category: 'Moderation',
    description: 'Allow everyone to send messages again.',
    usage: '[channel]',
    examples: ['unlock', 'unlock #general'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'channel', type: 'textchannel', required: false, description: 'which channel (defaults to here)' }],
    slash: true,
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      await channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: null }, { reason: `Unlocked by ${ctx.user.tag}` });
      return ctx.success(`Unlocked ${channel}.`);
    },
  },

  {
    name: 'lockdown',
    category: 'Moderation',
    description: 'Lock every text channel in the server at once.',
    details: 'The emergency switch during a raid. `lockdown end` reverses it.',
    usage: '[reason]',
    examples: ['lockdown raid', 'lockdown end'],
    permissions: ['Administrator'],
    botPermissions: ['ManageChannels'],
    cooldown: 15,
    args: [{ name: 'reason', type: 'rest', required: false, default: 'Server lockdown', description: 'why, or `end` to lift it' }],
    async run(ctx) {
      const lifting = String(ctx.args.reason).toLowerCase() === 'end';

      const confirmed = await ctx.confirm({
        title: lifting ? 'Lift lockdown' : 'Lock the entire server',
        description: lifting
          ? 'Every text channel will be unlocked.'
          : 'Every text channel I can manage will be locked for @everyone.',
        confirmLabel: lifting ? 'Unlock all' : 'Lock all',
      });
      if (!confirmed) return undefined;

      await ctx.defer();
      const count = await antiraid.lockdown(ctx.guild, !lifting, `${lifting ? 'Lockdown lifted' : 'Lockdown'} by ${ctx.user.tag}`);
      return ctx.success(`${lifting ? 'Unlocked' : 'Locked'} **${count}** channel(s).`);
    },
  },

  {
    name: 'slowmode',
    aliases: ['slow'],
    category: 'Moderation',
    description: 'Set how often members can send a message in a channel.',
    usage: '<duration> [channel]',
    examples: ['slowmode 10s', 'slowmode 0', 'slowmode 5m #general'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'duration', type: 'string', required: true, description: 'delay per message, e.g. 10s (max 6h), or 0 to disable' },
      { name: 'channel', type: 'textchannel', required: false, description: 'which channel' },
    ],
    slash: true,
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      const raw = String(ctx.args.duration);
      const seconds = raw === '0' ? 0 : require('../../lib/util').parseDuration(raw);
      if (seconds === null) return ctx.error('That is not a valid duration. Try `10s`, `5m`, or `0` to turn it off.');
      if (seconds > 21_600) return ctx.error('Slowmode cannot be longer than **6 hours**.');

      await channel.setRateLimitPerUser(seconds, `By ${ctx.user.tag}`);
      return ctx.success(seconds ? `Slowmode in ${channel} is now **${formatDuration(seconds)}**.` : `Slowmode disabled in ${channel}.`);
    },
  },

  {
    name: 'hide',
    category: 'Moderation',
    description: 'Hide a channel from @everyone.',
    usage: '[channel]',
    examples: ['hide', 'hide #staff'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'channel', type: 'channel', required: false, description: 'which channel' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      await channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { ViewChannel: false }, { reason: `Hidden by ${ctx.user.tag}` });
      return ctx.success(`${channel} is now hidden.`);
    },
  },

  {
    name: 'unhide',
    category: 'Moderation',
    description: 'Make a hidden channel visible again.',
    usage: '[channel]',
    examples: ['unhide', 'unhide #staff'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'channel', type: 'channel', required: false, description: 'which channel' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      await channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { ViewChannel: null }, { reason: `Revealed by ${ctx.user.tag}` });
      return ctx.success(`${channel} is visible again.`);
    },
  },

  {
    name: 'nuke',
    category: 'Moderation',
    description: 'Delete a channel and recreate it identically — wiping all its messages.',
    details:
      'Clones the channel with the same name, permissions, topic and position, then deletes the original. ' +
      'The only way to clear a channel with more than 14 days of history. Always asks first.',
    usage: '[channel]',
    examples: ['nuke', 'nuke #spam'],
    permissions: ['Administrator'],
    botPermissions: ['ManageChannels'],
    cooldown: 30,
    args: [{ name: 'channel', type: 'textchannel', required: false, description: 'which channel to nuke' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;

      const confirmed = await ctx.confirm({
        title: 'Nuke channel',
        description:
          `**${channel.name}** will be deleted and recreated with the same settings.\n` +
          '**Every message in it will be lost permanently.**',
        confirmLabel: 'Nuke it',
      });
      if (!confirmed) return undefined;

      const position = channel.position;
      const clone = await channel.clone({ reason: `Nuked by ${ctx.user.tag}` });
      await channel.delete(`Nuked by ${ctx.user.tag}`);
      await clone.setPosition(position).catch(() => {});

      await mod.record(ctx, { action: 'purge', target: ctx.user, reason: `Nuked #${clone.name}`, dm: false });
      return clone.send({
        embeds: [ctx.theme.success(`Channel nuked by ${ctx.user}. Fresh start ${emojis.sparkle}`)],
      });
    },
  },

  {
    name: 'topic',
    category: 'Moderation',
    description: 'Set or clear a channel’s topic.',
    usage: '<topic>',
    examples: ['topic general chat — be nice', 'topic clear'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'topic', type: 'rest', required: true, description: 'the new topic, or `clear`' }],
    async run(ctx) {
      const clearing = ctx.args.topic.toLowerCase() === 'clear';
      await ctx.channel.setTopic(clearing ? null : ctx.args.topic, `By ${ctx.user.tag}`);
      return ctx.success(clearing ? 'Topic cleared.' : 'Topic updated.');
    },
  },

  {
    name: 'nsfw',
    category: 'Moderation',
    description: 'Toggle a channel’s age-restricted flag.',
    usage: '[channel]',
    examples: ['nsfw'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'channel', type: 'textchannel', required: false, description: 'which channel' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      await channel.setNSFW(!channel.nsfw, `By ${ctx.user.tag}`);
      return ctx.success(`${channel} is ${channel.nsfw ? 'no longer' : 'now'} age-restricted.`);
    },
  },

  {
    name: 'channelcreate',
    category: 'Moderation',
    description: 'Create a channel.',
    usage: '<name> [text|voice]',
    examples: ['channelcreate announcements', 'channelcreate Music voice'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'name', type: 'string', required: true, description: 'name for the channel' },
      { name: 'kind', type: 'choice', required: false, choices: ['text', 'voice'], default: 'text', description: 'channel type' },
    ],
    async run(ctx) {
      const channel = await ctx.guild.channels.create({
        name: ctx.args.name,
        type: ctx.args.kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        reason: `Created by ${ctx.user.tag}`,
      });
      return ctx.success(`Created ${channel}.`);
    },
  },

  {
    name: 'channeldelete',
    category: 'Moderation',
    description: 'Delete a channel.',
    usage: '[channel]',
    examples: ['channeldelete #old'],
    permissions: ['ManageChannels'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'channel', type: 'channel', required: false, description: 'which channel to delete' }],
    async run(ctx) {
      const channel = ctx.args.channel ?? ctx.channel;
      const confirmed = await ctx.confirm({
        title: 'Delete channel',
        description: `**#${channel.name}** and everything in it will be gone for good.`,
      });
      if (!confirmed) return undefined;

      const name = channel.name;
      await channel.delete(`Deleted by ${ctx.user.tag}`);
      if (channel.id === ctx.channel.id) return undefined;
      return ctx.success(`Deleted **#${name}**.`);
    },
  },

  {
    name: 'unbanall',
    category: 'Moderation',
    description: 'Lift every ban in the server.',
    details: 'Hard bans are skipped. Asks for confirmation, and can take a while on large ban lists.',
    examples: ['unbanall'],
    permissions: ['Administrator'],
    botPermissions: ['BanMembers'],
    cooldown: 60,
    serverOwnerOnly: true,
    async run(ctx) {
      await ctx.defer();
      const bans = await ctx.guild.bans.fetch();
      if (!bans.size) return ctx.info('There are no bans to lift.');

      const hardbanned = new Set(
        require('../../lib/db')
          .db.prepare("SELECT user_id FROM cases WHERE guild_id = ? AND type = 'hardban' AND active = 1")
          .all(ctx.guild.id)
          .map((row) => row.user_id),
      );
      const targets = [...bans.values()].filter((ban) => !hardbanned.has(ban.user.id));

      const confirmed = await ctx.confirm({
        title: 'Unban everyone',
        description: `This lifts **${targets.length}** ban(s).${hardbanned.size ? ` ${hardbanned.size} hard ban(s) will be kept.` : ''}`,
        confirmLabel: `Unban ${targets.length}`,
      });
      if (!confirmed) return undefined;

      let done = 0;
      await pooled(targets, 3, async (ban) => {
        const ok = await ctx.guild.bans.remove(ban.user.id, `Mass unban by ${ctx.user.tag}`).then(() => true).catch(() => false);
        if (ok) done += 1;
      });

      return ctx.success(`Unbanned **${done}** user(s).`);
    },
  },

  {
    name: 'bans',
    aliases: ['banlist'],
    category: 'Moderation',
    description: 'List everyone currently banned from the server.',
    examples: ['bans'],
    permissions: ['BanMembers'],
    botPermissions: ['BanMembers'],
    async run(ctx) {
      await ctx.defer();
      const bans = await ctx.guild.bans.fetch();
      if (!bans.size) return ctx.info('Nobody is banned here.');

      return ctx.paginateRows(
        [...bans.values()].map((ban) => `**${ban.user.tag}** \`${ban.user.id}\`\n └ ${truncate(ban.reason ?? 'No reason given', 80)}`),
        { perPage: 8, title: `Bans — ${bans.size}`, numbered: false },
      );
    },
  },
];
