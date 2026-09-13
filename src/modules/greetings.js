'use strict';

const store = require('../lib/db');
const variables = require('../lib/variables');
const logger = require('../lib/logger');

/** Send a configured message (welcome / goodbye / boost) if it is enabled. */
async function announce(kind, { guild, user, member, extra = {} }) {
  if (!store.getSetting(guild.id, `${kind}.enabled`)) return null;

  const channelId = store.getSetting(guild.id, `${kind}.channel`);
  const channel = channelId ? guild.channels.cache.get(channelId) : null;
  if (!channel?.isTextBased()) return null;

  const template = store.getSetting(guild.id, `${kind}.message`);
  if (!template) return null;

  const payload = variables.render(template, { user, member, guild, channel, extra });

  try {
    const message = await channel.send({
      ...payload,
      allowedMentions: { users: user ? [user.id] : [], roles: [] },
    });

    const deleteAfter = store.getSetting(guild.id, `${kind}.deleteAfter`) ?? 0;
    if (deleteAfter > 0) setTimeout(() => message.delete().catch(() => {}), deleteAfter * 1000);
    return message;
  } catch (error) {
    logger.debug(`${kind} message failed in ${guild.id}: ${error.message}`);
    return null;
  }
}

/** Optional welcome DM, separate from the channel message. */
async function welcomeDm(member) {
  const template = store.getSetting(member.guild.id, 'welcome.dm');
  if (!template) return;
  const payload = variables.render(template, { user: member.user, member, guild: member.guild });
  await member.send(payload).catch(() => {});
}

/** Grant the configured join roles, honouring the anti-raid delay. */
async function applyAutoroles(member) {
  const guild = member.guild;
  if (!store.getSetting(guild.id, 'autorole.enabled')) return;

  const key = member.user.bot ? 'autorole.botRoles' : 'autorole.roles';
  const configured = store.getSetting(guild.id, key) ?? [];

  // Roles added through the `autorole` command live in their own table too.
  const fromTable = store.db
    .prepare('SELECT role_id FROM autoroles WHERE guild_id = ? AND kind = ?')
    .all(guild.id, member.user.bot ? 'bot' : 'member')
    .map((row) => row.role_id);

  const ids = [...new Set([...configured, ...fromTable])];
  if (!ids.length) return;

  const roles = ids
    .map((id) => guild.roles.cache.get(id))
    .filter((role) => role && guild.members.me.roles.highest.comparePositionTo(role) > 0);
  if (!roles.length) return;

  const delay = store.getSetting(guild.id, 'autorole.delay') ?? 0;
  const grant = () => member.roles.add(roles, 'Autorole').catch((error) => logger.debug(`Autorole failed: ${error.message}`));

  if (delay > 0) setTimeout(grant, delay * 1000);
  else await grant();
}

module.exports = { announce, welcomeDm, applyAutoroles };
