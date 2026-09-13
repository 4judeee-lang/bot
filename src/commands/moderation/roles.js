'use strict';

const store = require('../../lib/db');
const mod = require('../../lib/moderation');
const { pooled, formatDuration, now, truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');

/** Everything the bot is allowed to strip from a member. */
function strippableRoles(guild, member) {
  return mod.manageableRoles(guild, [...member.roles.cache.values()]);
}

module.exports = [
  {
    name: 'strip',
    aliases: ['stripstaff', 'clearroles'],
    category: 'Moderation',
    description: 'Remove every role from a member — or from everyone in the server.',
    details:
      'Takes all roles I am able to remove. Roles above me in the hierarchy, managed/bot roles and @everyone ' +
      'cannot be touched by anyone, so those stay.\n\n' +
      '**Always asks for confirmation before it does anything.** Stripped roles are remembered, so ' +
      '`restoreroles @user` can put a single member back exactly as they were.\n\n' +
      '`strip all` strips every member in the server and is limited to the server owner — it is the emergency ' +
      'button for when a role has been handed out to everyone by mistake or during a nuke.',
    usage: '<member | all> [reason]',
    examples: ['strip @user', 'strip @user compromised account', 'strip all'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'target', type: 'string', required: true, description: 'a member, or the word `all`' },
      { name: 'reason', type: 'rest', required: false, default: 'No reason provided', description: 'why' },
    ],
    cooldown: 10,
    async run(ctx) {
      const { target, reason } = ctx.args;

      /* ── strip everyone ─────────────────────────────────────────── */
      if (target.toLowerCase() === 'all') {
        if (ctx.guild.ownerId !== ctx.user.id && !require('../../lib/dispatcher').isOwner(ctx.user.id)) {
          return ctx.error('`strip all` is limited to the **server owner** — it affects every member at once.');
        }

        await ctx.defer();
        await ctx.guild.members.fetch();
        const affected = ctx.guild.members.cache.filter((member) => strippableRoles(ctx.guild, member).length > 0);

        if (!affected.size) return ctx.error('There are no roles I am able to remove from anyone.');

        const confirmed = await ctx.confirm({
          title: 'Strip roles from EVERYONE',
          description:
            `This removes every role I can manage from **${affected.size}** member(s) across the whole server.\n\n` +
            'This cannot be undone in bulk — only individual members can be restored afterwards with ' +
            `\`${ctx.prefix}restoreroles @user\`.`,
          confirmLabel: `Strip ${affected.size} members`,
          timeout: 45_000,
          fields: [
            { name: 'Requested by', value: `${ctx.user}`, inline: true },
            { name: 'Reason', value: truncate(reason, 200), inline: true },
          ],
        });
        if (!confirmed) return undefined;

        const status = await ctx.send({
          embeds: [ctx.theme.warn(`${emojis.loading} Stripping **${affected.size}** members — this may take a while…`)],
        });

        let stripped = 0;
        let failed = 0;
        await pooled([...affected.values()], 3, async (member) => {
          const roles = strippableRoles(ctx.guild, member);
          if (!roles.length) return;
          mod.stashRoles(ctx.guild.id, member.id, 'strip', roles.map((role) => role.id));
          try {
            await member.roles.remove(roles, `Mass strip by ${ctx.user.tag}: ${reason}`);
            stripped += 1;
          } catch {
            failed += 1;
          }
        });

        await mod.record(ctx, {
          action: 'strip',
          target: ctx.user,
          reason: `Mass strip — ${stripped} member(s): ${reason}`,
          dm: false,
        });

        const summary = ctx.theme.success(
          `Stripped roles from **${stripped}** member(s)${failed ? `, **${failed}** failed` : ''}.\n` +
            `Restore an individual with \`${ctx.prefix}restoreroles @user\`.`,
        );
        return status?.edit ? status.edit({ embeds: [summary] }) : ctx.send({ embeds: [summary] });
      }

      /* ── strip one member ───────────────────────────────────────── */
      const { resolveMember } = require('../../lib/arguments');
      const member = await resolveMember(ctx.guild, target);
      if (!member) return ctx.error(`I could not find a member called **${truncate(target, 50)}**.`);

      const problem = mod.checkHierarchy(ctx, member, { action: 'strip' });
      if (problem) return ctx.error(problem);

      const roles = strippableRoles(ctx.guild, member);
      if (!roles.length) return ctx.error(`**${member.user.tag}** has no roles I am able to remove.`);

      const confirmed = await ctx.confirm({
        title: 'Strip roles',
        description: `Remove **${roles.length}** role(s) from ${member}?`,
        confirmLabel: 'Strip roles',
        fields: [
          { name: 'Roles', value: truncate(roles.map((role) => `${role}`).join(' '), 1000), inline: false },
          { name: 'Reason', value: truncate(reason, 200), inline: false },
        ],
      });
      if (!confirmed) return undefined;

      mod.stashRoles(ctx.guild.id, member.id, 'strip', roles.map((role) => role.id));
      await member.roles.remove(roles, `Strip by ${ctx.user.tag}: ${reason}`);

      const { caseNumber } = await mod.record(ctx, {
        action: 'strip',
        target: member,
        reason,
        extra: [{ name: 'Roles removed', value: truncate(roles.map((r) => r.name).join(', '), 1000) }],
      });

      return ctx.success(
        `Stripped **${roles.length}** role(s) from **${member.user.tag}** ${emojis.dot} case #${caseNumber}\n` +
          `Undo with \`${ctx.prefix}restoreroles ${member.user.username}\`.`,
      );
    },
  },

  {
    name: 'restoreroles',
    aliases: ['unstrip'],
    category: 'Moderation',
    description: 'Give back the roles a member had before they were stripped.',
    details: 'Only works for members stripped by this bot, and only for roles that still exist and sit below me.',
    usage: '<member>',
    examples: ['restoreroles @user'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [{ name: 'member', type: 'member', required: true, description: 'member to restore' }],
    async run(ctx) {
      const member = ctx.args.member;
      const ids = mod.popRoles(ctx.guild.id, member.id, 'strip');
      if (!ids.length) return ctx.error(`I have no stored roles for **${member.user.tag}**.`);

      const roles = mod.manageableRoles(
        ctx.guild,
        ids.map((id) => ctx.guild.roles.cache.get(id)).filter(Boolean),
      );
      if (!roles.length) return ctx.error('None of their stored roles still exist, or they are all above me.');

      await member.roles.add(roles, `Roles restored by ${ctx.user.tag}`);
      return ctx.success(`Restored **${roles.length}** role(s) to **${member.user.tag}**.`);
    },
  },

  {
    name: 'role',
    aliases: ['r', 'giverole'],
    category: 'Roles',
    description: 'Add or remove a role — running it again toggles the role back off.',
    details: 'If the member already has the role it is removed, otherwise it is added.',
    usage: '<member> <role>',
    examples: ['role @user Member', 'role @user @Muted'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to change' },
      { name: 'role', type: 'role', required: true, description: 'the role to toggle' },
    ],
    slash: true,
    async run(ctx) {
      const { member, role } = ctx.args;
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) {
        return ctx.error(`**${role.name}** is above my highest role — move my role up to manage it.`);
      }
      if (ctx.guild.ownerId !== ctx.user.id && ctx.member.roles.highest.comparePositionTo(role) <= 0) {
        return ctx.error(`**${role.name}** is above your highest role.`);
      }
      if (role.managed) return ctx.error(`**${role.name}** is managed by an integration and cannot be assigned.`);

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role, `${ctx.user.tag} removed role`);
        return ctx.success(`Removed **${role.name}** from **${member.user.tag}**.`);
      }
      await member.roles.add(role, `${ctx.user.tag} added role`);
      return ctx.success(`Added **${role.name}** to **${member.user.tag}**.`);
    },
  },

  {
    name: 'temprole',
    category: 'Roles',
    description: 'Give someone a role that is removed again after a set time.',
    usage: '<member> <role> <duration>',
    examples: ['temprole @user VIP 7d', 'temprole @user Muted 2h'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'member', type: 'member', required: true, description: 'who to give it to' },
      { name: 'role', type: 'role', required: true, description: 'the role' },
      { name: 'duration', type: 'duration', required: true, description: 'how long, e.g. 7d' },
    ],
    async run(ctx) {
      const { member, role, duration } = ctx.args;
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);

      await member.roles.add(role, `Temporary role from ${ctx.user.tag}`);
      store.addCase({
        guildId: ctx.guild.id,
        type: 'temprole',
        userId: member.id,
        moderatorId: ctx.user.id,
        reason: `Temporary role: ${role.name}`,
        duration,
        expiresAt: now() + duration,
      });
      // Remove it on a timer as well as through the scheduler, so short
      // durations are precise rather than waiting for the next minute tick.
      setTimeout(() => member.roles.remove(role, 'Temporary role expired').catch(() => {}), duration * 1000);

      return ctx.success(`**${member.user.tag}** has **${role.name}** for **${formatDuration(duration)}**.`);
    },
  },

  {
    name: 'roleall',
    aliases: ['massrole'],
    category: 'Roles',
    description: 'Give a role to every member in the server.',
    details: 'Asks for confirmation first. Use `roleall humans` or `roleall bots` to target only one group.',
    usage: '<role> [humans|bots]',
    examples: ['roleall Member', 'roleall BotRole bots'],
    permissions: ['Administrator'],
    botPermissions: ['ManageRoles'],
    cooldown: 30,
    args: [
      { name: 'role', type: 'role', required: true, description: 'the role to hand out' },
      { name: 'filter', type: 'choice', required: false, choices: ['humans', 'bots', 'all'], default: 'all', description: 'who to include' },
    ],
    async run(ctx) {
      const { role, filter } = ctx.args;
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);
      if (role.managed) return ctx.error('That role is managed by an integration.');

      await ctx.defer();
      await ctx.guild.members.fetch();
      const targets = ctx.guild.members.cache.filter((member) => {
        if (member.roles.cache.has(role.id)) return false;
        if (filter === 'humans') return !member.user.bot;
        if (filter === 'bots') return member.user.bot;
        return true;
      });

      if (!targets.size) return ctx.error('Everyone matching that filter already has the role.');

      const confirmed = await ctx.confirm({
        title: 'Mass role',
        description: `Give **${role.name}** to **${targets.size}** member(s)?`,
        danger: false,
        confirmLabel: 'Do it',
      });
      if (!confirmed) return undefined;

      let done = 0;
      await pooled([...targets.values()], 3, async (member) => {
        const ok = await member.roles.add(role, `Mass role by ${ctx.user.tag}`).then(() => true).catch(() => false);
        if (ok) done += 1;
      });

      return ctx.success(`Gave **${role.name}** to **${done}** member(s).`);
    },
  },

  {
    name: 'rolecreate',
    aliases: ['createrole'],
    category: 'Roles',
    description: 'Create a new role.',
    usage: '<name> [colour]',
    examples: ['rolecreate Members', 'rolecreate VIP #f1c40f'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'name', type: 'string', required: true, description: 'name for the new role' },
      { name: 'color', type: 'string', required: false, description: 'hex colour like #f1c40f' },
    ],
    async run(ctx) {
      const { name, color } = ctx.args;
      const role = await ctx.guild.roles.create({
        name,
        color: color ? require('../../lib/util').resolveColor(color) : undefined,
        reason: `Created by ${ctx.user.tag}`,
      });
      return ctx.success(`Created ${role}.`);
    },
  },

  {
    name: 'roledelete',
    aliases: ['deleterole'],
    category: 'Roles',
    description: 'Delete a role.',
    usage: '<role>',
    examples: ['roledelete OldRole'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [{ name: 'role', type: 'role', required: true, description: 'role to delete' }],
    async run(ctx) {
      const role = ctx.args.role;
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);

      const confirmed = await ctx.confirm({
        title: 'Delete role',
        description: `**${role.name}** has **${role.members.size}** member(s). Deleting it cannot be undone.`,
      });
      if (!confirmed) return undefined;

      const name = role.name;
      await role.delete(`Deleted by ${ctx.user.tag}`);
      return ctx.success(`Deleted **${name}**.`);
    },
  },

  {
    name: 'rolecolor',
    aliases: ['rolecolour'],
    category: 'Roles',
    description: 'Change a role’s colour.',
    usage: '<role> <colour>',
    examples: ['rolecolor VIP #ff0000'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'role', type: 'role', required: true, description: 'the role to recolour' },
      { name: 'color', type: 'string', required: true, description: 'hex colour like #ff0000' },
    ],
    async run(ctx) {
      const { role, color } = ctx.args;
      if (!/^#?[0-9a-f]{6}$/i.test(color)) return ctx.error('Give me a hex colour, like `#ff0000`.');
      await role.setColor(require('../../lib/util').resolveColor(color), `By ${ctx.user.tag}`);
      return ctx.success(`${role} is now \`${color.startsWith('#') ? color : `#${color}`}\`.`);
    },
  },

  {
    name: 'rolename',
    aliases: ['renamerole'],
    category: 'Roles',
    description: 'Rename a role.',
    usage: '<role> <name>',
    examples: ['rolename VIP Supporter'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'role', type: 'role', required: true, description: 'role to rename' },
      { name: 'name', type: 'rest', required: true, description: 'the new name' },
    ],
    async run(ctx) {
      const old = ctx.args.role.name;
      await ctx.args.role.setName(ctx.args.name, `By ${ctx.user.tag}`);
      return ctx.success(`Renamed **${old}** to **${ctx.args.name}**.`);
    },
  },

  {
    name: 'rolehoist',
    category: 'Roles',
    description: 'Toggle whether a role is displayed separately in the member list.',
    usage: '<role>',
    examples: ['rolehoist Staff'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [{ name: 'role', type: 'role', required: true, description: 'role to toggle' }],
    async run(ctx) {
      const role = ctx.args.role;
      await role.setHoist(!role.hoist, `By ${ctx.user.tag}`);
      return ctx.success(`**${role.name}** is ${role.hoist ? 'no longer' : 'now'} shown separately.`);
    },
  },

  {
    name: 'rolemention',
    category: 'Roles',
    description: 'Toggle whether anyone can mention a role.',
    usage: '<role>',
    examples: ['rolemention Announcements'],
    permissions: ['ManageRoles'],
    botPermissions: ['ManageRoles'],
    args: [{ name: 'role', type: 'role', required: true, description: 'role to toggle' }],
    async run(ctx) {
      const role = ctx.args.role;
      await role.setMentionable(!role.mentionable, `By ${ctx.user.tag}`);
      return ctx.success(`**${role.name}** is ${role.mentionable ? 'no longer' : 'now'} mentionable.`);
    },
  },

  {
    name: 'inrole',
    category: 'Roles',
    description: 'List everyone who has a given role.',
    usage: '<role>',
    examples: ['inrole Moderator'],
    args: [{ name: 'role', type: 'role', required: true, description: 'the role to inspect' }],
    async run(ctx) {
      await ctx.guild.members.fetch();
      const members = ctx.args.role.members;
      if (!members.size) return ctx.info(`Nobody has **${ctx.args.role.name}**.`);

      return ctx.paginateRows(
        members.map((member) => `${member.user.tag} \`${member.id}\``),
        { perPage: 15, title: `${ctx.args.role.name} — ${members.size} member(s)` },
      );
    },
  },

  {
    name: 'roles',
    aliases: ['rolelist'],
    category: 'Roles',
    description: 'List every role in the server with its member count.',
    examples: ['roles'],
    async run(ctx) {
      const roles = [...ctx.guild.roles.cache.values()]
        .filter((role) => role.id !== ctx.guild.id)
        .sort((a, b) => b.position - a.position);
      if (!roles.length) return ctx.info('This server has no roles.');

      return ctx.paginateRows(
        roles.map((role) => `${role} ${emojis.dot} ${role.members.size} member(s) ${emojis.dot} \`${role.id}\``),
        { perPage: 12, title: `Roles — ${roles.length}` },
      );
    },
  },

  {
    name: 'autorole add',
    category: 'Roles',
    description: 'Automatically give a role to everyone who joins.',
    usage: '<role> [bots]',
    examples: ['autorole add Member', 'autorole add BotRole bots'],
    permissions: ['ManageGuild'],
    botPermissions: ['ManageRoles'],
    args: [
      { name: 'role', type: 'role', required: true, description: 'role to grant on join' },
      { name: 'kind', type: 'choice', required: false, choices: ['member', 'bot'], default: 'member', description: 'apply to humans or bots' },
    ],
    async run(ctx) {
      const { role, kind } = ctx.args;
      if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);

      store.db.prepare('INSERT OR IGNORE INTO autoroles (guild_id, role_id, kind) VALUES (?, ?, ?)').run(ctx.guild.id, role.id, kind);
      store.setSetting(ctx.guild.id, 'autorole.enabled', true);
      return ctx.success(`**${role.name}** will be given to every ${kind === 'bot' ? 'bot' : 'member'} who joins.`);
    },
  },

  {
    name: 'autorole remove',
    category: 'Roles',
    description: 'Stop giving a role out automatically.',
    usage: '<role>',
    examples: ['autorole remove Member'],
    permissions: ['ManageGuild'],
    args: [{ name: 'role', type: 'role', required: true, description: 'role to stop granting' }],
    async run(ctx) {
      const changed = store.db.prepare('DELETE FROM autoroles WHERE guild_id = ? AND role_id = ?').run(ctx.guild.id, ctx.args.role.id).changes;
      if (!changed) return ctx.error(`**${ctx.args.role.name}** is not an autorole.`);
      return ctx.success(`**${ctx.args.role.name}** is no longer given out automatically.`);
    },
  },

  {
    name: 'autorole list',
    category: 'Roles',
    description: 'Show which roles are handed out on join.',
    examples: ['autorole list'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM autoroles WHERE guild_id = ?').all(ctx.guild.id);
      const fromSettings = [
        ...(store.getSetting(ctx.guild.id, 'autorole.roles') ?? []).map((id) => ({ role_id: id, kind: 'member' })),
        ...(store.getSetting(ctx.guild.id, 'autorole.botRoles') ?? []).map((id) => ({ role_id: id, kind: 'bot' })),
      ];
      const all = [...rows, ...fromSettings];
      if (!all.length) return ctx.info(`No autoroles set. Add one with \`${ctx.prefix}autorole add <role>\`.`);

      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Autoroles',
            description: all.map((row) => `<@&${row.role_id}> ${emojis.dot} ${row.kind}s`).join('\n'),
            footer: { text: store.getSetting(ctx.guild.id, 'autorole.enabled') ? 'Autorole is enabled' : 'Autorole is currently disabled' },
          }),
        ],
      });
    },
  },
];
