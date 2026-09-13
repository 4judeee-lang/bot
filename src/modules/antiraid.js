'use strict';

const { ChannelType, PermissionsBitField } = require('discord.js');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const { sendLog } = require('../lib/modlog');
const logger = require('../lib/logger');

const JOIN_WINDOW_MS = 10_000;

/** Per-account checks that run on every join, raid or not. */
async function screenMember(member) {
  const guild = member.guild;
  if (!store.getSetting(guild.id, 'antiraid.enabled')) return false;

  const minAgeDays = store.getSetting(guild.id, 'antiraid.minAccountAge') ?? 0;
  if (minAgeDays > 0) {
    const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
    if (ageDays < minAgeDays) {
      await kick(member, `Account younger than ${minAgeDays} day(s)`);
      return true;
    }
  }

  if (store.getSetting(guild.id, 'antiraid.noAvatar') && !member.user.avatar) {
    await kick(member, 'No custom avatar (antiraid)');
    return true;
  }

  return false;
}

async function kick(member, reason) {
  if (!member.kickable) return;
  await member.kick(reason).catch(() => {});
  await sendLog(member.guild, 'moderation', themeFor(member.guild.id).base({
    color: themeFor(member.guild.id).warnColor,
    author: { name: 'Antiraid • member removed', iconURL: member.user.displayAvatarURL() },
    description: `${member.user.tag} \`${member.id}\`\n${reason}`,
    timestamp: true,
  }));
}

/** Raid burst detection — many joins in a short window. */
async function trackJoin(client, member) {
  const guild = member.guild;
  if (!store.getSetting(guild.id, 'antiraid.enabled')) return;

  const stamps = (client.caches.joins.get(guild.id) ?? []).filter((time) => Date.now() - time < JOIN_WINDOW_MS);
  stamps.push(Date.now());
  client.caches.joins.set(guild.id, stamps);

  const threshold = store.getSetting(guild.id, 'antiraid.joinThreshold') ?? 8;
  if (stamps.length < threshold) return;

  client.caches.joins.set(guild.id, []);
  const action = store.getSetting(guild.id, 'antiraid.action') ?? 'lockdown';
  const theme = themeFor(guild.id);

  logger.warn(`Raid detected in ${guild.name} (${stamps.length} joins) — responding with ${action}`);

  if (action === 'lockdown') {
    await lockdown(guild, true, 'Antiraid: join flood detected');
  } else {
    // Remove everyone who joined inside the burst window.
    const cutoff = Date.now() - JOIN_WINDOW_MS * 2;
    const recent = guild.members.cache.filter((m) => m.joinedTimestamp >= cutoff && !m.user.bot);
    for (const target of recent.values()) {
      if (action === 'ban' && target.bannable) await target.ban({ reason: 'Antiraid' }).catch(() => {});
      else if (target.kickable) await target.kick('Antiraid').catch(() => {});
    }
  }

  await sendLog(guild, 'moderation', theme.base({
    color: theme.errorColor,
    title: '🚨 Raid detected',
    description: `**${stamps.length}** members joined within ${JOIN_WINDOW_MS / 1000}s.\nResponse: **${action}**.`,
    timestamp: true,
  }));
}

/** Lock (or unlock) every text channel the bot can manage. */
async function lockdown(guild, locked, reason = 'Lockdown') {
  const everyone = guild.roles.everyone;
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return 0;

  const channels = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildText && channel.permissionsFor(me)?.has('ManageChannels'),
  );

  let changed = 0;
  for (const channel of channels.values()) {
    const ok = await channel.permissionOverwrites
      .edit(everyone, { SendMessages: locked ? false : null }, { reason })
      .then(() => true)
      .catch(() => false);
    if (ok) changed += 1;
  }
  return changed;
}

module.exports = { screenMember, trackJoin, lockdown };
