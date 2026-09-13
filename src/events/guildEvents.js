'use strict';

/**
 * discord.js only allows one handler export per file, so the small
 * server-level listeners are registered here as a bundle by re-exporting an
 * array. `client.js` understands both shapes.
 */

const store = require('../lib/db');
const antinuke = require('../modules/antinuke');
const invites = require('../modules/invites');
const { sendLog } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { titleCase } = require('../lib/util');
const logger = require('../lib/logger');

const CHANNEL_KINDS = {
  0: 'text', 2: 'voice', 4: 'category', 5: 'announcement',
  13: 'stage', 15: 'forum', 16: 'media',
};

module.exports = [
  {
    name: 'guildCreate',
    async run(client, guild) {
      store.rememberGuild(guild);
      await invites.cacheGuild(client, guild).catch(() => {});
      logger.info(`Joined ${guild.name} (${guild.id}) — ${guild.memberCount} members`);
    },
  },

  {
    name: 'guildDelete',
    async run(client, guild) {
      store.db.prepare("UPDATE guilds SET left_at = strftime('%s','now') WHERE guild_id = ?").run(guild.id);
      client.music?.get(guild.id)?.destroy();
      logger.info(`Left ${guild.name} (${guild.id})`);
    },
  },

  {
    name: 'channelCreate',
    async run(client, channel) {
      if (!channel.guild) return;
      const theme = themeFor(channel.guild.id);
      await sendLog(channel.guild, 'server', theme.base({
        color: theme.successColor,
        title: 'Channel created',
        description: `${channel} — \`#${channel.name}\` (${CHANNEL_KINDS[channel.type] ?? channel.type})`,
        timestamp: true,
      }));
    },
  },

  {
    name: 'channelDelete',
    async run(client, channel) {
      if (!channel.guild) return;
      await antinuke.onChannelDelete(channel).catch(() => {});
      store.db.prepare('DELETE FROM sticky_messages WHERE channel_id = ?').run(channel.id);
      store.db.prepare('DELETE FROM vm_channels WHERE channel_id = ?').run(channel.id);

      const theme = themeFor(channel.guild.id);
      await sendLog(channel.guild, 'server', theme.base({
        color: theme.errorColor,
        title: 'Channel deleted',
        description: `\`#${channel.name}\` (${CHANNEL_KINDS[channel.type] ?? channel.type})`,
        timestamp: true,
      }));
    },
  },

  {
    name: 'roleCreate',
    async run(client, role) {
      const theme = themeFor(role.guild.id);
      await sendLog(role.guild, 'server', theme.base({
        color: theme.successColor,
        title: 'Role created',
        description: `${role} — \`${role.name}\``,
        timestamp: true,
      }));
    },
  },

  {
    name: 'roleDelete',
    async run(client, role) {
      await antinuke.onRoleDelete(role).catch(() => {});
      store.db.prepare('DELETE FROM reaction_roles WHERE role_id = ?').run(role.id);
      store.db.prepare('DELETE FROM button_roles WHERE role_id = ?').run(role.id);
      store.db.prepare('DELETE FROM level_rewards WHERE role_id = ?').run(role.id);

      const theme = themeFor(role.guild.id);
      await sendLog(role.guild, 'server', theme.base({
        color: theme.errorColor,
        title: 'Role deleted',
        description: `\`${role.name}\` (${role.members.size} member(s) had it)`,
        timestamp: true,
      }));
    },
  },

  {
    name: 'roleUpdate',
    async run(client, oldRole, newRole) {
      const changes = [];
      if (oldRole.name !== newRole.name) changes.push(`Name: \`${oldRole.name}\` → \`${newRole.name}\``);
      if (oldRole.hexColor !== newRole.hexColor) changes.push(`Colour: \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const added = newRole.permissions.toArray().filter((p) => !oldRole.permissions.has(p));
        const removed = oldRole.permissions.toArray().filter((p) => !newRole.permissions.has(p));
        if (added.length) changes.push(`Granted: ${added.map((p) => `\`${titleCase(p.replace(/([A-Z])/g, ' $1'))}\``).join(', ')}`);
        if (removed.length) changes.push(`Revoked: ${removed.map((p) => `\`${titleCase(p.replace(/([A-Z])/g, ' $1'))}\``).join(', ')}`);
      }
      if (!changes.length) return;

      const theme = themeFor(newRole.guild.id);
      await sendLog(newRole.guild, 'server', theme.base({
        title: 'Role updated',
        description: `${newRole}\n\n${changes.join('\n')}`,
        timestamp: true,
      }));
    },
  },

  {
    name: 'guildBanAdd',
    async run(client, ban) {
      await antinuke.onBanAdd(ban).catch(() => {});
      const theme = themeFor(ban.guild.id);
      await sendLog(ban.guild, 'moderation', theme.base({
        color: theme.errorColor,
        author: { name: `${ban.user.tag} was banned`, iconURL: ban.user.displayAvatarURL() },
        description: `${ban.user} \`${ban.user.id}\`\n${ban.reason ? `Reason: ${ban.reason}` : ''}`,
        timestamp: true,
      }));
    },
  },

  {
    name: 'guildBanRemove',
    async run(client, ban) {
      const theme = themeFor(ban.guild.id);
      await sendLog(ban.guild, 'moderation', theme.base({
        color: theme.successColor,
        author: { name: `${ban.user.tag} was unbanned`, iconURL: ban.user.displayAvatarURL() },
        description: `${ban.user} \`${ban.user.id}\``,
        timestamp: true,
      }));
    },
  },

  {
    name: 'guildAuditLogEntryCreate',
    async run(client, entry, guild) {
      await antinuke.onAuditLogEntry(entry, guild).catch(() => {});
    },
  },

  {
    name: 'inviteCreate',
    async run(client, invite) {
      if (invite.guild) await invites.cacheGuild(client, invite.guild).catch(() => {});
    },
  },

  {
    name: 'inviteDelete',
    async run(client, invite) {
      if (invite.guild) await invites.cacheGuild(client, invite.guild).catch(() => {});
    },
  },
];
