'use strict';

const { PermissionsBitField } = require('discord.js');
const store = require('../../lib/db');
const mod = require('../../lib/moderation');
const { formatDuration, now, pooled, truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');

const P = PermissionsBitField.Flags;

/** Force-nicknames are kept as a map in the settings table. */
function forcedNicks(guildId) {
  return store.getSetting(guildId, 'moderation.forcedNicks') ?? {};
}

module.exports = [
  {
    name: 'nickname',
    aliases: ['nick', 'setnick'],
    category: 'Moderation',
    description: 'Change or clear a member’s nickname.',
    usage: '<member> [nickname]',
    examples: ['nickname @user Dave', 'nickname @user'],
    permissions: ['ManageNicknames'],
    botPermissions: ['ManageNicknames'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to rename' },
      { name: 'nickname', type: 'rest', required: false, description: 'the new nickname — leave empty to reset' },
    ],
    async run(ctx) {
      const { member, nickname } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'rename' });
      if (problem) return ctx.error(problem);
      if (nickname && nickname.length > 32) return ctx.error('Nicknames cannot be longer than **32** characters.');

      await member.setNickname(nickname || null, `By ${ctx.user.tag}`);
      return ctx.success(nickname ? `**${member.user.tag}** is now **${nickname}**.` : `Reset **${member.user.tag}**’s nickname.`);
    },
  },

  {
    name: 'forcenick',
    category: 'Moderation',
    description: 'Lock a member to one nickname — I reset it whenever they change it.',
    details: 'Use `unforcenick` to release them. Handy for people who keep setting offensive nicknames.',
    usage: '<member> <nickname>',
    examples: ['forcenick @user Timeout'],
    permissions: ['ManageNicknames'],
    botPermissions: ['ManageNicknames'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to lock' },
      { name: 'nickname', type: 'rest', required: true, description: 'the nickname they are stuck with' },
    ],
    async run(ctx) {
      const { member, nickname } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'rename' });
      if (problem) return ctx.error(problem);
      if (nickname.length > 32) return ctx.error('Nicknames cannot be longer than **32** characters.');

      const map = forcedNicks(ctx.guild.id);
      map[member.id] = nickname;
      store.setSetting(ctx.guild.id, 'moderation.forcedNicks', map);

      await member.setNickname(nickname, `Force nick by ${ctx.user.tag}`);
      return ctx.success(`**${member.user.tag}** is locked to **${nickname}**.`);
    },
  },

  {
    name: 'unforcenick',
    category: 'Moderation',
    description: 'Release a member from a forced nickname.',
    usage: '<member>',
    examples: ['unforcenick @user'],
    permissions: ['ManageNicknames'],
    botPermissions: ['ManageNicknames'],
    args: [{ name: 'member', type: 'member', required: true, description: 'who to release' }],
    async run(ctx) {
      const map = forcedNicks(ctx.guild.id);
      if (!map[ctx.args.member.id]) return ctx.error(`**${ctx.args.member.user.tag}** does not have a forced nickname.`);
      delete map[ctx.args.member.id];
      store.setSetting(ctx.guild.id, 'moderation.forcedNicks', map);
      await ctx.args.member.setNickname(null, `Force nick removed by ${ctx.user.tag}`).catch(() => {});
      return ctx.success(`**${ctx.args.member.user.tag}** can choose their own nickname again.`);
    },
  },

  {
    name: 'jail',
    category: 'Moderation',
    description: 'Lock a member into the jail channel and take their other roles away.',
    details:
      'Creates a Jailed role the first time you use it. Their previous roles are stored and given back by ' +
      '`unjail`. Set the jail channel with `setjail #channel`.',
    usage: '<member> [duration] [reason]',
    examples: ['jail @user', 'jail @user 1h under review'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to jail' },
      { name: 'duration', type: 'duration', required: false, description: 'how long, e.g. 1h' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    async run(ctx) {
      const { member, duration, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'jail' });
      if (problem) return ctx.error(problem);

      await ctx.defer();
      const jailRole = await mod.ensureJailRole(ctx.guild);
      if (member.roles.cache.has(jailRole.id)) return ctx.error(`**${member.user.tag}** is already jailed.`);

      const roles = mod.manageableRoles(ctx.guild, [...member.roles.cache.values()]);
      mod.stashRoles(ctx.guild.id, member.id, 'jail', roles.map((role) => role.id));

      await member.roles.set([jailRole], `Jailed by ${ctx.user.tag}: ${reason}`);
      const { caseNumber } = await mod.record(ctx, { action: 'jail', target: member, reason, duration });

      const jailChannel = store.getSetting(ctx.guild.id, 'moderation.jailChannel');
      return ctx.success(
        `Jailed **${member.user.tag}**${duration ? ` for **${formatDuration(duration)}**` : ''} ${emojis.dot} case #${caseNumber}` +
          (jailChannel ? `\nThey can only see <#${jailChannel}>.` : `\nTip: set a jail channel with \`${ctx.prefix}setjail #channel\`.`),
      );
    },
  },

  {
    name: 'unjail',
    category: 'Moderation',
    description: 'Release a member from jail and restore their roles.',
    usage: '<member> [reason]',
    examples: ['unjail @user'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to release' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    async run(ctx) {
      const { member, reason } = ctx.args;
      const jailRole = store.getSetting(ctx.guild.id, 'moderation.jailRole');
      if (!jailRole || !member.roles.cache.has(jailRole)) return ctx.error(`**${member.user.tag}** is not jailed.`);

      const ids = mod.popRoles(ctx.guild.id, member.id, 'jail');
      const roles = ids.map((id) => ctx.guild.roles.cache.get(id)).filter(Boolean);
      await member.roles.set(roles, `Released by ${ctx.user.tag}: ${reason}`);

      store.db.prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'jail'").run(ctx.guild.id, member.id);
      const { caseNumber } = await mod.record(ctx, { action: 'unjail', target: member, reason });
      return ctx.success(`Released **${member.user.tag}** and restored **${roles.length}** role(s) ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'setjail',
    category: 'Configuration',
    description: 'Choose the channel jailed members can see.',
    usage: '<channel>',
    examples: ['setjail #jail'],
    permissions: ['ManageGuild'],
    args: [{ name: 'channel', type: 'textchannel', required: true, description: 'the jail channel' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'moderation.jailChannel', ctx.args.channel.id);

      const jailRole = store.getSetting(ctx.guild.id, 'moderation.jailRole');
      if (jailRole) {
        await ctx.args.channel.permissionOverwrites
          .edit(jailRole, { ViewChannel: true, SendMessages: true }, { reason: 'Jail channel set' })
          .catch(() => {});
      }
      return ctx.success(`Jailed members will be able to see ${ctx.args.channel}.`);
    },
  },

  {
    name: 'imute',
    category: 'Moderation',
    description: 'Stop a member from posting images and files.',
    details: 'Applies a per-channel permission override denying Attach Files and Embed Links.',
    usage: '<member> [duration] [reason]',
    examples: ['imute @user 1h'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to mute' },
      { name: 'duration', type: 'duration', required: false, description: 'how long' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    cooldown: 10,
    async run(ctx) {
      const { member, duration, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'mute' });
      if (problem) return ctx.error(problem);

      await ctx.defer();
      const channels = ctx.guild.channels.cache.filter((channel) => channel.isTextBased?.() && !channel.isThread?.());
      let done = 0;
      await pooled([...channels.values()], 5, async (channel) => {
        const ok = await channel.permissionOverwrites
          .edit(member.id, { AttachFiles: false, EmbedLinks: false }, { reason: `Image mute: ${reason}` })
          .then(() => true)
          .catch(() => false);
        if (ok) done += 1;
      });

      const { caseNumber } = await mod.record(ctx, { action: 'imute', target: member, reason, duration });
      return ctx.success(`**${member.user.tag}** cannot post images in **${done}** channel(s) ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'iunmute',
    category: 'Moderation',
    description: 'Let a member post images again.',
    usage: '<member>',
    examples: ['iunmute @user'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'member', type: 'member', required: true, description: 'who to unmute' }],
    cooldown: 10,
    async run(ctx) {
      await ctx.defer();
      const member = ctx.args.member;
      let done = 0;
      await pooled([...ctx.guild.channels.cache.values()], 5, async (channel) => {
        const overwrite = channel.permissionOverwrites?.cache?.get(member.id);
        if (!overwrite) return;
        const ok = await channel.permissionOverwrites
          .edit(member.id, { AttachFiles: null, EmbedLinks: null }, { reason: 'Image mute lifted' })
          .then(() => true)
          .catch(() => false);
        if (ok) done += 1;
      });

      store.db.prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'imute'").run(ctx.guild.id, member.id);
      return ctx.success(`**${member.user.tag}** can post images again (**${done}** channel(s) updated).`);
    },
  },

  {
    name: 'rmute',
    category: 'Moderation',
    description: 'Stop a member from adding reactions.',
    usage: '<member> [duration] [reason]',
    examples: ['rmute @user 30m'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to mute' },
      { name: 'duration', type: 'duration', required: false, description: 'how long' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    cooldown: 10,
    async run(ctx) {
      const { member, duration, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'mute' });
      if (problem) return ctx.error(problem);

      await ctx.defer();
      const channels = ctx.guild.channels.cache.filter((channel) => channel.isTextBased?.() && !channel.isThread?.());
      let done = 0;
      await pooled([...channels.values()], 5, async (channel) => {
        const ok = await channel.permissionOverwrites
          .edit(member.id, { AddReactions: false }, { reason: `Reaction mute: ${reason}` })
          .then(() => true)
          .catch(() => false);
        if (ok) done += 1;
      });

      const { caseNumber } = await mod.record(ctx, { action: 'rmute', target: member, reason, duration });
      return ctx.success(`**${member.user.tag}** cannot react in **${done}** channel(s) ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'runmute',
    category: 'Moderation',
    description: 'Let a member add reactions again.',
    usage: '<member>',
    examples: ['runmute @user'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ManageChannels'],
    args: [{ name: 'member', type: 'member', required: true, description: 'who to unmute' }],
    cooldown: 10,
    async run(ctx) {
      await ctx.defer();
      const member = ctx.args.member;
      let done = 0;
      await pooled([...ctx.guild.channels.cache.values()], 5, async (channel) => {
        if (!channel.permissionOverwrites?.cache?.get(member.id)) return;
        const ok = await channel.permissionOverwrites
          .edit(member.id, { AddReactions: null }, { reason: 'Reaction mute lifted' })
          .then(() => true)
          .catch(() => false);
        if (ok) done += 1;
      });

      store.db.prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'rmute'").run(ctx.guild.id, member.id);
      return ctx.success(`**${member.user.tag}** can react again (**${done}** channel(s) updated).`);
    },
  },

  {
    name: 'voicekick',
    aliases: ['vckick'],
    category: 'Moderation',
    description: 'Disconnect a member from voice.',
    usage: '<member> [reason]',
    examples: ['voicekick @user'],
    permissions: ['MoveMembers'],
    botPermissions: ['MoveMembers'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to disconnect' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    async run(ctx) {
      const member = ctx.args.member;
      if (!member.voice.channel) return ctx.error(`**${member.user.tag}** is not in a voice channel.`);
      await member.voice.disconnect(`${ctx.user.tag}: ${ctx.args.reason}`);
      return ctx.success(`Disconnected **${member.user.tag}** from voice.`);
    },
  },

  {
    name: 'voicemute',
    aliases: ['vmute'],
    category: 'Moderation',
    description: 'Server-mute a member in voice.',
    usage: '<member> [reason]',
    examples: ['voicemute @user'],
    permissions: ['MuteMembers'],
    botPermissions: ['MuteMembers'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to mute' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    async run(ctx) {
      const member = ctx.args.member;
      if (!member.voice.channel) return ctx.error(`**${member.user.tag}** is not in a voice channel.`);
      await member.voice.setMute(!member.voice.serverMute, `${ctx.user.tag}: ${ctx.args.reason}`);
      return ctx.success(`**${member.user.tag}** is ${member.voice.serverMute ? 'no longer' : 'now'} voice muted.`);
    },
  },

  {
    name: 'deafen',
    aliases: ['vdeafen'],
    category: 'Moderation',
    description: 'Server-deafen a member in voice.',
    usage: '<member>',
    examples: ['deafen @user'],
    permissions: ['DeafenMembers'],
    botPermissions: ['DeafenMembers'],
    args: [{ name: 'member', type: 'member', required: true, description: 'who to deafen' }],
    async run(ctx) {
      const member = ctx.args.member;
      if (!member.voice.channel) return ctx.error(`**${member.user.tag}** is not in a voice channel.`);
      await member.voice.setDeaf(!member.voice.serverDeaf, `By ${ctx.user.tag}`);
      return ctx.success(`**${member.user.tag}** is ${member.voice.serverDeaf ? 'no longer' : 'now'} deafened.`);
    },
  },

  {
    name: 'move',
    aliases: ['drag'],
    category: 'Moderation',
    description: 'Move a member into another voice channel.',
    usage: '<member> [channel]',
    examples: ['move @user General', 'move @user'],
    permissions: ['MoveMembers'],
    botPermissions: ['MoveMembers'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to move' },
      { name: 'channel', type: 'voicechannel', required: false, description: 'where to (defaults to your channel)' },
    ],
    async run(ctx) {
      const target = ctx.args.channel ?? ctx.member.voice.channel;
      if (!target) return ctx.error('Join a voice channel, or name one to move them to.');
      if (!ctx.args.member.voice.channel) return ctx.error(`**${ctx.args.member.user.tag}** is not in voice.`);

      await ctx.args.member.voice.setChannel(target, `Moved by ${ctx.user.tag}`);
      return ctx.success(`Moved **${ctx.args.member.user.tag}** to **${target.name}**.`);
    },
  },

  {
    name: 'moveall',
    aliases: ['dragall'],
    category: 'Moderation',
    description: 'Move everyone from one voice channel to another.',
    usage: '<from> <to>',
    examples: ['moveall Lobby General'],
    permissions: ['MoveMembers'],
    botPermissions: ['MoveMembers'],
    cooldown: 10,
    args: [
      { name: 'from', type: 'voicechannel', required: true, description: 'channel to empty' },
      { name: 'to', type: 'voicechannel', required: true, description: 'channel to fill' },
    ],
    async run(ctx) {
      const { from, to } = ctx.args;
      const members = [...from.members.values()];
      if (!members.length) return ctx.error(`**${from.name}** is empty.`);

      let done = 0;
      await pooled(members, 4, async (member) => {
        const ok = await member.voice.setChannel(to, `Moved by ${ctx.user.tag}`).then(() => true).catch(() => false);
        if (ok) done += 1;
      });
      return ctx.success(`Moved **${done}** member(s) to **${to.name}**.`);
    },
  },

  {
    name: 'massban',
    category: 'Moderation',
    description: 'Ban several users at once by ID.',
    details: 'Pass a list of user IDs separated by spaces. Always asks for confirmation.',
    usage: '<ids...>',
    examples: ['massban 111111111111111111 222222222222222222'],
    permissions: ['Administrator'],
    botPermissions: ['BanMembers'],
    cooldown: 30,
    args: [{ name: 'ids', type: 'rest', required: true, description: 'space separated user IDs' }],
    async run(ctx) {
      const ids = [...new Set(ctx.args.ids.split(/\s+/).filter((id) => /^\d{15,25}$/.test(id)))];
      if (!ids.length) return ctx.error('I did not find any valid user IDs in that.');
      if (ids.length > 50) return ctx.error('Maximum **50** users at a time.');

      const confirmed = await ctx.confirm({
        title: 'Mass ban',
        description: `Ban **${ids.length}** user(s)?`,
        confirmLabel: `Ban ${ids.length}`,
      });
      if (!confirmed) return undefined;

      let done = 0;
      const failed = [];
      await pooled(ids, 3, async (id) => {
        const ok = await ctx.guild.bans
          .create(id, { reason: `Mass ban by ${ctx.user.tag}` })
          .then(() => true)
          .catch(() => false);
        if (ok) {
          done += 1;
          store.addCase({ guildId: ctx.guild.id, type: 'ban', userId: id, moderatorId: ctx.user.id, reason: 'Mass ban' });
        } else failed.push(id);
      });

      return ctx.success(
        `Banned **${done}** user(s).${failed.length ? `\nFailed: ${truncate(failed.join(', '), 500)}` : ''}`,
      );
    },
  },
];
