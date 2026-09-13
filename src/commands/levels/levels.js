'use strict';

const store = require('../../lib/db');
const levels = require('../../modules/levels');
const { formatNumber, progressBar, formatDuration } = require('../../lib/util');
const emojis = require('../../lib/emojis');

module.exports = [
  {
    name: 'rank',
    aliases: ['level', 'xp'],
    category: 'Levels',
    description: 'Show your level, XP and position on the leaderboard.',
    usage: '[member]',
    examples: ['rank', 'rank @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose rank (defaults to you)' }],
    slash: true,
    async run(ctx) {
      if (!store.getSetting(ctx.guild.id, 'levels.enabled')) {
        return ctx.error(`Levelling is off here. An admin can turn it on with \`${ctx.prefix}set levels.enabled on\`.`);
      }

      const user = ctx.args.member ?? ctx.user;
      const row = levels.getUser(ctx.guild.id, user.id);
      if (!row.xp) return ctx.info(`**${user.username}** has not earned any XP yet.`);

      const { level, into, needed } = levels.levelFromXp(row.xp);
      const position = levels.rank(ctx.guild.id, user.id);
      const total = store.db.prepare('SELECT COUNT(*) AS total FROM levels WHERE guild_id = ? AND xp > 0').get(ctx.guild.id).total;

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: user.tag, iconURL: user.displayAvatarURL() },
            thumbnail: user.displayAvatarURL({ size: 256 }),
            description:
              `${emojis.level} **Level ${level}** ${emojis.dot} rank **#${position}** of ${formatNumber(total)}\n\n` +
              `${progressBar(into, needed, 18)}\n` +
              `**${formatNumber(into)} / ${formatNumber(needed)}** xp to level ${level + 1}`,
            fields: [
              { name: 'Total XP', value: formatNumber(row.xp), inline: true },
              { name: 'Messages', value: formatNumber(row.messages), inline: true },
              { name: 'Voice time', value: row.voice_time ? formatDuration(row.voice_time) : 'none', inline: true },
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'leaderboard',
    aliases: ['lb', 'levels', 'top'],
    category: 'Levels',
    description: 'The server XP leaderboard.',
    examples: ['leaderboard'],
    slash: true,
    async run(ctx) {
      const rows = levels.leaderboard(ctx.guild.id, 250);
      if (!rows.length) return ctx.info('Nobody has earned any XP yet.');

      const medals = ['🥇', '🥈', '🥉'];
      return ctx.paginateRows(
        rows.map((row, index) => {
          const { level } = levels.levelFromXp(row.xp);
          const prefix = medals[index] ?? '';
          return `${prefix} <@${row.user_id}> ${emojis.dot} level **${level}** ${emojis.dot} ${formatNumber(row.xp)} xp`;
        }),
        { perPage: 10, title: `${emojis.level} XP leaderboard` },
      );
    },
  },

  {
    name: 'setlevel',
    category: 'Levels',
    description: 'Set a member’s level directly.',
    usage: '<member> <level>',
    examples: ['setlevel @user 10'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'member', type: 'user', required: true, description: 'whose level to set' },
      { name: 'level', type: 'integer', required: true, description: 'the level to give them' },
    ],
    async run(ctx) {
      const { member, level } = ctx.args;
      if (level < 0 || level > 1000) return ctx.error('Level must be between **0** and **1000**.');

      const xp = levels.totalXpForLevel(level);
      levels.setXp(ctx.guild.id, member.id, xp);

      const guildMember = await ctx.guild.members.fetch(member.id).catch(() => null);
      if (guildMember) await levels.syncRoles(guildMember, level);

      return ctx.success(`**${member.tag}** is now level **${level}** (${formatNumber(xp)} xp).`);
    },
  },

  {
    name: 'addxp',
    category: 'Levels',
    description: 'Give or take XP from a member.',
    usage: '<member> <amount>',
    examples: ['addxp @user 500', 'addxp @user -200'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'member', type: 'user', required: true, description: 'who to adjust' },
      { name: 'amount', type: 'integer', required: true, description: 'how much XP (negative to remove)' },
    ],
    async run(ctx) {
      const result = levels.addXp(ctx.guild.id, ctx.args.member.id, ctx.args.amount);
      const guildMember = await ctx.guild.members.fetch(ctx.args.member.id).catch(() => null);
      if (guildMember) await levels.syncRoles(guildMember, result.after);

      return ctx.success(
        `${ctx.args.amount >= 0 ? 'Gave' : 'Removed'} **${formatNumber(Math.abs(ctx.args.amount))}** xp ` +
          `${ctx.args.amount >= 0 ? 'to' : 'from'} **${ctx.args.member.tag}** — now level **${result.after}**.`,
      );
    },
  },

  {
    name: 'resetlevels',
    category: 'Levels',
    description: 'Wipe all XP in the server, or for one member.',
    usage: '[member]',
    examples: ['resetlevels', 'resetlevels @user'],
    permissions: ['Administrator'],
    args: [{ name: 'member', type: 'user', required: false, description: 'reset only this member' }],
    async run(ctx) {
      if (ctx.args.member) {
        store.db.prepare('DELETE FROM levels WHERE guild_id = ? AND user_id = ?').run(ctx.guild.id, ctx.args.member.id);
        return ctx.success(`Reset XP for **${ctx.args.member.tag}**.`);
      }

      const total = store.db.prepare('SELECT COUNT(*) AS total FROM levels WHERE guild_id = ?').get(ctx.guild.id).total;
      const confirmed = await ctx.confirm({
        title: 'Reset all levels',
        description: `Every member’s XP and level will be wiped — **${total}** record(s). This cannot be undone.`,
        confirmLabel: 'Wipe all XP',
      });
      if (!confirmed) return undefined;

      store.db.prepare('DELETE FROM levels WHERE guild_id = ?').run(ctx.guild.id);
      return ctx.success(`Wiped XP for **${total}** member(s).`);
    },
  },

  {
    name: 'levelrole add',
    aliases: ['levelreward add'],
    category: 'Levels',
    description: 'Give a role automatically at a certain level.',
    details: 'With role stacking on (the default) members keep older level roles; turn `levels.stackRoles` off to swap them instead.',
    usage: '<level> <role>',
    examples: ['levelrole add 5 Regular', 'levelrole add 20 Veteran'],
    permissions: ['ManageGuild'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'level', type: 'integer', required: true, description: 'the level they must reach' },
      { name: 'role', type: 'role', required: true, description: 'the role to give' },
    ],
    async run(ctx) {
      const { level, role } = ctx.args;
      if (level < 1 || level > 1000) return ctx.error('Level must be between **1** and **1000**.');
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);

      store.db
        .prepare('INSERT OR REPLACE INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)')
        .run(ctx.guild.id, level, role.id);
      return ctx.success(`Members reaching **level ${level}** will get ${role}.`);
    },
  },

  {
    name: 'levelrole remove',
    category: 'Levels',
    description: 'Stop giving a role at a level.',
    usage: '<level>',
    examples: ['levelrole remove 5'],
    permissions: ['ManageGuild'],
    args: [{ name: 'level', type: 'integer', required: true, description: 'the level to clear' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?').run(ctx.guild.id, ctx.args.level).changes;
      if (!changed) return ctx.error(`No reward set for level **${ctx.args.level}**.`);
      return ctx.success(`Removed the reward for level **${ctx.args.level}**.`);
    },
  },

  {
    name: 'levelrole list',
    aliases: ['levelroles'],
    category: 'Levels',
    description: 'Show every level reward.',
    examples: ['levelrole list'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC').all(ctx.guild.id);
      if (!rows.length) return ctx.info(`No level rewards. Add one with \`${ctx.prefix}levelrole add <level> <role>\`.`);

      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Level rewards',
            description: rows.map((row) => `**Level ${row.level}** ${emojis.arrow} <@&${row.role_id}>`).join('\n'),
            footer: {
              text: store.getSetting(ctx.guild.id, 'levels.stackRoles') ? 'Roles stack' : 'Only the highest role is kept',
            },
          }),
        ],
      });
    },
  },

  {
    name: 'levels setup',
    category: 'Levels',
    description: 'Turn levelling on and choose where level-ups are announced.',
    usage: '[channel]',
    examples: ['levels setup', 'levels setup #level-ups'],
    permissions: ['ManageGuild'],
    args: [{ name: 'channel', type: 'textchannel', required: false, description: 'where to announce (defaults to wherever they spoke)' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'levels.enabled', true);
      if (ctx.args.channel) store.setSetting(ctx.guild.id, 'levels.channel', ctx.args.channel.id);

      return ctx.success(
        `Levelling enabled${ctx.args.channel ? `, announcing in ${ctx.args.channel}` : ''}.\n` +
          `Add rewards with \`${ctx.prefix}levelrole add <level> <role>\`.`,
      );
    },
  },

  {
    name: 'voiceleaderboard',
    aliases: ['vclb'],
    category: 'Levels',
    description: 'Who has spent the most time in voice channels.',
    examples: ['voiceleaderboard'],
    async run(ctx) {
      const rows = store.db
        .prepare('SELECT * FROM levels WHERE guild_id = ? AND voice_time > 0 ORDER BY voice_time DESC LIMIT 100')
        .all(ctx.guild.id);
      if (!rows.length) return ctx.info('No voice time recorded yet.');

      return ctx.paginateRows(
        rows.map((row) => `<@${row.user_id}> ${emojis.dot} ${formatDuration(row.voice_time, { max: 2 })}`),
        { perPage: 10, title: `${emojis.voice} Voice leaderboard` },
      );
    },
  },
];
