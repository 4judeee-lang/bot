'use strict';

const store = require('../../lib/db');
const mod = require('../../lib/moderation');
const { formatDuration, relative, truncate, now } = require('../../lib/util');
const emojis = require('../../lib/emojis');

const REASON = { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why you are doing this' };

module.exports = [
  {
    name: 'ban',
    aliases: ['b'],
    category: 'Moderation',
    description: 'Ban a member, optionally for a set amount of time.',
    details:
      'Bans the member and records a case. Add a duration (for example `7d`) to make it temporary — I will ' +
      'unban them automatically when it expires. Works on people who have already left the server if you pass their ID.',
    usage: '<member> [duration] [reason]',
    examples: ['ban @user raiding', 'ban 123456789012345678 7d ban evasion', 'ban @user 12h spam'],
    permissions: ['BanMembers'],
    botPermissions: ['BanMembers'],
    args: [
      { name: 'user', type: 'user', required: true, description: 'member or user ID to ban' },
      { name: 'duration', type: 'duration', required: false, description: 'how long, e.g. 7d — omit for permanent' },
      REASON,
    ],
    slash: true,
    async run(ctx) {
      const { user, duration, reason } = ctx.args;
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        const problem = mod.checkHierarchy(ctx, member, { action: 'ban' });
        if (problem) return ctx.error(problem);
      }

      const already = await ctx.guild.bans.fetch(user.id).catch(() => null);
      if (already) return ctx.error(`**${user.tag}** is already banned.`);

      const { caseNumber } = await mod.record(ctx, { action: 'ban', target: member ?? user, reason, duration });

      try {
        await ctx.guild.bans.create(user.id, { reason: `${ctx.user.tag}: ${reason}`, deleteMessageSeconds: 0 });
      } catch (error) {
        return ctx.error(`Could not ban **${user.tag}** — ${error.message}`);
      }

      return ctx.success(
        `Banned **${user.tag}**${duration ? ` for **${formatDuration(duration)}**` : ''} ${emojis.dot} case #${caseNumber}`,
      );
    },
  },

  {
    name: 'softban',
    category: 'Moderation',
    description: 'Ban then immediately unban, which clears the member’s recent messages.',
    details: 'The tidy way to kick someone and wipe the mess they made. Deletes the last 7 days of their messages.',
    usage: '<member> [reason]',
    examples: ['softban @user spam flood'],
    permissions: ['BanMembers'],
    botPermissions: ['BanMembers'],
    args: [{ name: 'member', type: 'member', required: true, description: 'member to softban' }, REASON],
    async run(ctx) {
      const { member, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'ban' });
      if (problem) return ctx.error(problem);

      const { caseNumber } = await mod.record(ctx, { action: 'softban', target: member, reason });
      await ctx.guild.bans.create(member.id, { reason: `Softban by ${ctx.user.tag}: ${reason}`, deleteMessageSeconds: 604800 });
      await ctx.guild.bans.remove(member.id, 'Softban — immediate unban');

      return ctx.success(`Softbanned **${member.user.tag}** and cleared their recent messages ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'hardban',
    category: 'Moderation',
    description: 'Ban a user and keep them banned — re-bans them if anyone unbans them.',
    details:
      'For people who must never come back. The ban is recorded permanently; if another moderator unbans them, ' +
      'use `unhardban` first or the ban is simply re-applied.',
    usage: '<user> [reason]',
    examples: ['hardban @user ban evasion'],
    permissions: ['Administrator'],
    botPermissions: ['BanMembers'],
    args: [{ name: 'user', type: 'user', required: true, description: 'user to permanently ban' }, REASON],
    async run(ctx) {
      const { user, reason } = ctx.args;
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const problem = mod.checkHierarchy(ctx, member, { action: 'ban' });
        if (problem) return ctx.error(problem);
      }

      const confirmed = await ctx.confirm({
        title: 'Hard ban',
        description: `**${user.tag}** will be banned permanently and re-banned automatically if anyone unbans them.`,
      });
      if (!confirmed) return undefined;

      const { caseNumber } = await mod.record(ctx, { action: 'hardban', target: member ?? user, reason });
      await ctx.guild.bans.create(user.id, { reason: `Hardban by ${ctx.user.tag}: ${reason}` });
      return ctx.success(`Hard banned **${user.tag}** ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'unban',
    category: 'Moderation',
    description: 'Lift a ban.',
    details: 'Pass the user ID — banned users cannot be mentioned. `unban list` shows every current ban.',
    usage: '<user> [reason]',
    examples: ['unban 123456789012345678 appealed'],
    permissions: ['BanMembers'],
    botPermissions: ['BanMembers'],
    args: [{ name: 'user', type: 'user', required: true, description: 'user ID to unban' }, REASON],
    async run(ctx) {
      const { user, reason } = ctx.args;
      const ban = await ctx.guild.bans.fetch(user.id).catch(() => null);
      if (!ban) return ctx.error(`**${user.tag}** is not banned.`);

      const hardban = store.db
        .prepare("SELECT * FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'hardban' AND active = 1")
        .get(ctx.guild.id, user.id);
      if (hardban) {
        return ctx.error(`**${user.tag}** is hard banned (case #${hardban.case_number}). Use \`${ctx.prefix}unhardban\` first.`);
      }

      await ctx.guild.bans.remove(user.id, `${ctx.user.tag}: ${reason}`);
      store.db
        .prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type IN ('ban','softban')")
        .run(ctx.guild.id, user.id);

      const { caseNumber } = await mod.record(ctx, { action: 'unban', target: user, reason, dm: false });
      return ctx.success(`Unbanned **${user.tag}** ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'unhardban',
    category: 'Moderation',
    description: 'Remove a hard ban so the user can be unbanned normally.',
    usage: '<user>',
    examples: ['unhardban 123456789012345678'],
    permissions: ['Administrator'],
    args: [{ name: 'user', type: 'user', required: true, description: 'user to clear' }],
    async run(ctx) {
      const changed = store.db
        .prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'hardban'")
        .run(ctx.guild.id, ctx.args.user.id).changes;
      if (!changed) return ctx.error(`**${ctx.args.user.tag}** is not hard banned.`);
      return ctx.success(`**${ctx.args.user.tag}** is no longer hard banned — you can now \`${ctx.prefix}unban\` them.`);
    },
  },

  {
    name: 'kick',
    aliases: ['k'],
    category: 'Moderation',
    description: 'Remove a member from the server. They can rejoin with a new invite.',
    usage: '<member> [reason]',
    examples: ['kick @user breaking rule 3'],
    permissions: ['KickMembers'],
    botPermissions: ['KickMembers'],
    args: [{ name: 'member', type: 'member', required: true, description: 'member to kick' }, REASON],
    slash: true,
    async run(ctx) {
      const { member, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'kick' });
      if (problem) return ctx.error(problem);

      const { caseNumber } = await mod.record(ctx, { action: 'kick', target: member, reason });
      await member.kick(`${ctx.user.tag}: ${reason}`);
      return ctx.success(`Kicked **${member.user.tag}** ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'timeout',
    aliases: ['to', 'mute', 'shutup'],
    category: 'Moderation',
    description: 'Time a member out so they cannot talk, react or join voice.',
    details:
      'Uses Discord’s native timeout, which survives rejoining and needs no role. Maximum length is 28 days. ' +
      'If you would rather use a Muted role, use `rolemute` instead.',
    usage: '<member> <duration> [reason]',
    examples: ['timeout @user 10m calm down', 'timeout @user 1d spamming'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ModerateMembers'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'member to time out' },
      { name: 'duration', type: 'duration', required: true, description: 'how long, e.g. 10m, 2h, 7d (max 28d)' },
      REASON,
    ],
    slash: true,
    async run(ctx) {
      const { member, duration, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'timeout' });
      if (problem) return ctx.error(problem);
      if (duration > 2_419_200) return ctx.error('Timeouts cannot be longer than **28 days**.');

      const { caseNumber } = await mod.record(ctx, { action: 'timeout', target: member, reason, duration });
      await member.timeout(duration * 1000, `${ctx.user.tag}: ${reason}`);
      return ctx.success(`Timed out **${member.user.tag}** for **${formatDuration(duration)}** ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'untimeout',
    aliases: ['unmute', 'unto'],
    category: 'Moderation',
    description: 'End a member’s timeout early.',
    usage: '<member> [reason]',
    examples: ['untimeout @user appealed'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ModerateMembers'],
    args: [{ name: 'member', type: 'member', required: true, description: 'member to release' }, REASON],
    async run(ctx) {
      const { member, reason } = ctx.args;
      if (!member.isCommunicationDisabled()) return ctx.error(`**${member.user.tag}** is not timed out.`);

      await member.timeout(null, `${ctx.user.tag}: ${reason}`);
      store.db
        .prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'timeout'")
        .run(ctx.guild.id, member.id);
      const { caseNumber } = await mod.record(ctx, { action: 'untimeout', target: member, reason });
      return ctx.success(`Removed the timeout on **${member.user.tag}** ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'rolemute',
    category: 'Moderation',
    description: 'Mute a member with the Muted role instead of a native timeout.',
    details:
      'Creates a Muted role the first time you use it and denies it permission to speak in every channel. ' +
      'Useful when you want mutes longer than 28 days, or a role people can see.',
    usage: '<member> [duration] [reason]',
    examples: ['rolemute @user 30d', 'rolemute @user harassment'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'member to mute' },
      { name: 'duration', type: 'duration', required: false, description: 'optional length, e.g. 30d' },
      REASON,
    ],
    async run(ctx) {
      const { member, duration, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'mute' });
      if (problem) return ctx.error(problem);

      await ctx.defer();
      const role = await mod.ensureMuteRole(ctx.guild);
      if (member.roles.cache.has(role.id)) return ctx.error(`**${member.user.tag}** is already muted.`);

      const { caseNumber } = await mod.record(ctx, { action: 'mute', target: member, reason, duration });
      await member.roles.add(role, `${ctx.user.tag}: ${reason}`);

      return ctx.success(
        `Muted **${member.user.tag}**${duration ? ` for **${formatDuration(duration)}**` : ''} ${emojis.dot} case #${caseNumber}`,
      );
    },
  },

  {
    name: 'roleunmute',
    category: 'Moderation',
    description: 'Remove the Muted role from a member.',
    usage: '<member> [reason]',
    examples: ['roleunmute @user'],
    permissions: ['ModerateMembers'],
    botPermissions: ['ManageRoles'],
    args: [{ name: 'member', type: 'member', required: true, description: 'member to unmute' }, REASON],
    async run(ctx) {
      const { member, reason } = ctx.args;
      const roleId = store.getSetting(ctx.guild.id, 'moderation.muteRole');
      if (!roleId || !member.roles.cache.has(roleId)) return ctx.error(`**${member.user.tag}** is not muted.`);

      await member.roles.remove(roleId, `${ctx.user.tag}: ${reason}`);
      store.db
        .prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'mute'")
        .run(ctx.guild.id, member.id);
      const { caseNumber } = await mod.record(ctx, { action: 'unmute', target: member, reason });
      return ctx.success(`Unmuted **${member.user.tag}** ${emojis.dot} case #${caseNumber}`);
    },
  },

  {
    name: 'warn',
    aliases: ['w'],
    category: 'Moderation',
    description: 'Warn a member and record it against their history.',
    details:
      'Warnings are stored permanently and shown by `warnings`. Set `moderation.warnThreshold` to punish ' +
      'automatically once someone collects enough of them.',
    usage: '<member> [reason]',
    examples: ['warn @user stop posting that'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'member', type: 'member', required: true, description: 'member to warn' }, REASON],
    slash: true,
    async run(ctx) {
      const { member, reason } = ctx.args;
      const problem = mod.checkHierarchy(ctx, member, { action: 'warn' });
      if (problem) return ctx.error(problem);

      const { caseNumber } = await mod.record(ctx, { action: 'warn', target: member, reason });
      const total = store.db
        .prepare("SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1")
        .get(ctx.guild.id, member.id).total;

      const escalated = await mod.escalate(ctx, member);
      return ctx.success(
        `Warned **${member.user.tag}** — they now have **${total}** warning(s) ${emojis.dot} case #${caseNumber}` +
          (escalated ? `\nThreshold reached, applied **${escalated}**.` : ''),
      );
    },
  },

  {
    name: 'warnings',
    aliases: ['warns', 'infractions'],
    category: 'Moderation',
    description: 'List a member’s active warnings.',
    usage: '[member]',
    examples: ['warnings', 'warnings @user'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose warnings to show (defaults to you)' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const rows = store.db
        .prepare("SELECT * FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1 ORDER BY created_at DESC")
        .all(ctx.guild.id, user.id);

      if (!rows.length) return ctx.info(`**${user.tag}** has no active warnings.`);

      return ctx.paginateRows(
        rows.map(
          (row) => `**#${row.case_number}** ${truncate(row.reason, 80)}\n └ by <@${row.moderator_id}> ${relative(row.created_at * 1000)}`,
        ),
        { perPage: 6, title: `Warnings — ${user.tag}`, description: `${rows.length} active warning(s)`, numbered: false },
      );
    },
  },

  {
    name: 'delwarn',
    aliases: ['unwarn', 'removewarn'],
    category: 'Moderation',
    description: 'Delete a single warning by its case number.',
    usage: '<case>',
    examples: ['delwarn 12'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'case', type: 'integer', required: true, description: 'case number shown in `warnings`' }],
    async run(ctx) {
      const changed = store.db
        .prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND case_number = ? AND type = 'warn'")
        .run(ctx.guild.id, ctx.args.case).changes;
      if (!changed) return ctx.error(`No active warning with case number **${ctx.args.case}**.`);
      return ctx.success(`Removed warning **#${ctx.args.case}**.`);
    },
  },

  {
    name: 'clearwarns',
    category: 'Moderation',
    description: 'Clear every warning a member has.',
    usage: '<member>',
    examples: ['clearwarns @user'],
    permissions: ['ManageGuild'],
    args: [{ name: 'member', type: 'user', required: true, description: 'whose warnings to wipe' }],
    async run(ctx) {
      const user = ctx.args.member;
      const count = store.db
        .prepare("SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1")
        .get(ctx.guild.id, user.id).total;
      if (!count) return ctx.error(`**${user.tag}** has no warnings.`);

      const confirmed = await ctx.confirm({
        title: 'Clear warnings',
        description: `This removes all **${count}** warning(s) from **${user.tag}**.`,
      });
      if (!confirmed) return undefined;

      store.db
        .prepare("UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'warn'")
        .run(ctx.guild.id, user.id);
      return ctx.success(`Cleared **${count}** warning(s) from **${user.tag}**.`);
    },
  },

  {
    name: 'history',
    aliases: ['modlogs', 'cases'],
    category: 'Moderation',
    description: 'Show every moderation action taken against a member.',
    usage: '[member]',
    examples: ['history @user'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose history to show' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const rows = store.db
        .prepare('SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 200')
        .all(ctx.guild.id, user.id);

      if (!rows.length) return ctx.info(`**${user.tag}** has a clean record here.`);

      const meta = (type) => mod.ACTION_META[type]?.emoji ?? emojis.dot;
      return ctx.paginateRows(
        rows.map(
          (row) =>
            `${meta(row.type)} **#${row.case_number}** ${row.type}${row.duration ? ` (${formatDuration(row.duration)})` : ''}` +
            `${row.active ? '' : ' *(expired)*'}\n └ ${truncate(row.reason, 70)} — <@${row.moderator_id}> ${relative(row.created_at * 1000)}`,
        ),
        { perPage: 6, title: `History — ${user.tag}`, description: `${rows.length} case(s) on record`, numbered: false },
      );
    },
  },

  {
    name: 'case',
    category: 'Moderation',
    description: 'Look up one moderation case in detail.',
    usage: '<number>',
    examples: ['case 42'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'number', type: 'integer', required: true, description: 'the case number' }],
    async run(ctx) {
      const row = store.db.prepare('SELECT * FROM cases WHERE guild_id = ? AND case_number = ?').get(ctx.guild.id, ctx.args.number);
      if (!row) return ctx.error(`No case **#${ctx.args.number}** in this server.`);

      const embed = ctx.embed({
        title: `Case #${row.case_number} — ${row.type}`,
        fields: [
          { name: 'Member', value: `<@${row.user_id}> \`${row.user_id}\``, inline: true },
          { name: 'Moderator', value: `<@${row.moderator_id}>`, inline: true },
          { name: 'Status', value: row.active ? 'active' : 'expired / lifted', inline: true },
          ...(row.duration ? [{ name: 'Duration', value: formatDuration(row.duration), inline: true }] : []),
          ...(row.expires_at ? [{ name: 'Expires', value: relative(row.expires_at * 1000), inline: true }] : []),
          { name: 'Reason', value: row.reason ?? 'No reason provided', inline: false },
          { name: 'When', value: relative(row.created_at * 1000), inline: false },
        ],
      });
      return ctx.send({ embeds: [embed] });
    },
  },

  {
    name: 'reason',
    category: 'Moderation',
    description: 'Change the reason stored on a case.',
    usage: '<case> <reason>',
    examples: ['reason 42 actually it was ban evasion'],
    permissions: ['ModerateMembers'],
    args: [
      { name: 'case', type: 'integer', required: true, description: 'case number to edit' },
      { name: 'reason', type: 'rest', required: true, description: 'the new reason' },
    ],
    async run(ctx) {
      const changed = store.db
        .prepare('UPDATE cases SET reason = ? WHERE guild_id = ? AND case_number = ?')
        .run(ctx.args.reason, ctx.guild.id, ctx.args.case).changes;
      if (!changed) return ctx.error(`No case **#${ctx.args.case}** in this server.`);
      return ctx.success(`Updated the reason on case **#${ctx.args.case}**.`);
    },
  },

  {
    name: 'note',
    category: 'Moderation',
    description: 'Attach a private staff note to a member.',
    details: 'Notes are only visible to moderators and are never sent to the member.',
    usage: '<member> <note>',
    examples: ['note @user keeps toeing the line in #general'],
    permissions: ['ModerateMembers'],
    args: [
      { name: 'member', type: 'user', required: true, description: 'who the note is about' },
      { name: 'note', type: 'rest', required: true, description: 'the note text' },
    ],
    async run(ctx) {
      store.db
        .prepare('INSERT INTO mod_notes (guild_id, user_id, author_id, note) VALUES (?, ?, ?, ?)')
        .run(ctx.guild.id, ctx.args.member.id, ctx.user.id, ctx.args.note);
      return ctx.success(`Note added for **${ctx.args.member.tag}**.`);
    },
  },

  {
    name: 'notes',
    category: 'Moderation',
    description: 'Read the staff notes on a member.',
    usage: '<member>',
    examples: ['notes @user'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'member', type: 'user', required: true, description: 'whose notes to read' }],
    async run(ctx) {
      const rows = store.db
        .prepare('SELECT * FROM mod_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC')
        .all(ctx.guild.id, ctx.args.member.id);
      if (!rows.length) return ctx.info(`No notes on **${ctx.args.member.tag}**.`);

      return ctx.paginateRows(
        rows.map((row) => `\`${row.id}\` ${row.note}\n └ <@${row.author_id}> ${relative(row.created_at * 1000)}`),
        { perPage: 6, title: `Notes — ${ctx.args.member.tag}`, numbered: false },
      );
    },
  },

  {
    name: 'delnote',
    category: 'Moderation',
    description: 'Delete a staff note by its ID.',
    usage: '<id>',
    examples: ['delnote 7'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'id', type: 'integer', required: true, description: 'note ID shown by `notes`' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM mod_notes WHERE guild_id = ? AND id = ?').run(ctx.guild.id, ctx.args.id).changes;
      if (!changed) return ctx.error(`No note with ID **${ctx.args.id}**.`);
      return ctx.success(`Deleted note **${ctx.args.id}**.`);
    },
  },

  {
    name: 'modstats',
    category: 'Moderation',
    description: 'See how many actions a moderator has taken.',
    usage: '[moderator]',
    examples: ['modstats', 'modstats @mod'],
    permissions: ['ModerateMembers'],
    args: [{ name: 'moderator', type: 'user', required: false, description: 'which moderator (defaults to you)' }],
    async run(ctx) {
      const user = ctx.args.moderator ?? ctx.user;
      const rows = store.db
        .prepare('SELECT type, COUNT(*) AS total FROM cases WHERE guild_id = ? AND moderator_id = ? GROUP BY type ORDER BY total DESC')
        .all(ctx.guild.id, user.id);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      if (!total) return ctx.info(`**${user.tag}** has not taken any moderation actions here.`);

      const week = store.db
        .prepare("SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND moderator_id = ? AND created_at > ?")
        .get(ctx.guild.id, user.id, now() - 604800).total;

      return ctx.send({
        embeds: [
          ctx.embed({
            title: `Moderator stats — ${user.tag}`,
            description: `**${total}** actions all time ${emojis.dot} **${week}** in the last 7 days`,
            thumbnail: user.displayAvatarURL(),
            fields: rows.slice(0, 12).map((row) => ({ name: row.type, value: String(row.total), inline: true })),
          }),
        ],
      });
    },
  },
];
