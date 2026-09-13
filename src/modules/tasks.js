'use strict';

/**
 * The background scheduler. Runs once a minute and handles everything with an
 * expiry: temporary bans, mutes, jails, reminders and giveaways.
 */

const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const { sendLog } = require('../lib/modlog');
const { popRoles } = require('../lib/moderation');
const giveaways = require('./giveaways');
const { now, truncate } = require('../lib/util');
const logger = require('../lib/logger').scoped('tasks');

async function expirePunishments(client) {
  const due = store.db
    .prepare(
      `SELECT * FROM cases WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?
       AND type IN ('ban','mute','timeout','jail','imute','rmute')`,
    )
    .all(now());

  for (const record of due) {
    const guild = client.guilds.cache.get(record.guild_id);
    if (!guild) {
      store.db.prepare('UPDATE cases SET active = 0 WHERE id = ?').run(record.id);
      continue;
    }

    try {
      switch (record.type) {
        case 'ban':
          await guild.bans.remove(record.user_id, 'Temporary ban expired').catch(() => {});
          break;
        case 'mute': {
          const roleId = store.getSetting(guild.id, 'moderation.muteRole');
          const member = await guild.members.fetch(record.user_id).catch(() => null);
          if (member && roleId) await member.roles.remove(roleId, 'Mute expired').catch(() => {});
          break;
        }
        case 'jail': {
          const member = await guild.members.fetch(record.user_id).catch(() => null);
          const jailRole = store.getSetting(guild.id, 'moderation.jailRole');
          if (member) {
            if (jailRole) await member.roles.remove(jailRole, 'Jail expired').catch(() => {});
            const restore = popRoles(guild.id, record.user_id, 'jail')
              .map((id) => guild.roles.cache.get(id))
              .filter(Boolean);
            if (restore.length) await member.roles.add(restore, 'Jail expired').catch(() => {});
          }
          break;
        }
        case 'imute':
        case 'rmute': {
          const member = await guild.members.fetch(record.user_id).catch(() => null);
          if (member) {
            const permission = record.type === 'imute' ? 'AttachFiles' : 'AddReactions';
            for (const channel of guild.channels.cache.values()) {
              const overwrite = channel.permissionOverwrites?.cache?.get(record.user_id);
              if (overwrite) await channel.permissionOverwrites.delete(record.user_id, 'Mute expired').catch(() => {});
            }
            logger.debug(`Cleared ${permission} overrides for ${record.user_id}`);
          }
          break;
        }
        default:
          break;
      }

      const theme = themeFor(guild.id);
      await sendLog(guild, 'moderation', theme.base({
        color: theme.successColor,
        description: `⏱️ <@${record.user_id}>'s **${record.type}** (case #${record.case_number}) expired.`,
        timestamp: true,
      }));
    } catch (error) {
      logger.debug(`Failed to expire case ${record.id}: ${error.message}`);
    }

    store.db.prepare('UPDATE cases SET active = 0 WHERE id = ?').run(record.id);
  }
}

async function deliverReminders(client) {
  const due = store.db.prepare('SELECT * FROM reminders WHERE remind_at <= ?').all(now());

  for (const reminder of due) {
    store.db.prepare('DELETE FROM reminders WHERE id = ?').run(reminder.id);
    const theme = themeFor(reminder.guild_id);
    const embed = theme.base({
      title: '⏰ Reminder',
      description: truncate(reminder.text, 3000),
      footer: { text: `Set ${new Date(reminder.created_at * 1000).toDateString()}` },
    });

    const user = await client.users.fetch(reminder.user_id).catch(() => null);
    if (!user) continue;

    const sent = await user.send({ embeds: [embed] }).catch(() => null);
    if (sent) continue;

    // DMs closed — fall back to the channel it was set in.
    const channel = reminder.channel_id ? client.channels.cache.get(reminder.channel_id) : null;
    if (channel?.isTextBased()) {
      await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] }).catch(() => {});
    }
  }
}

/** Clean out snipe caches so memory does not grow forever. */
function pruneCaches(client) {
  const cutoff = Date.now() - 3_600_000;
  for (const cache of [client.caches.snipes, client.caches.editSnipes, client.caches.reactionSnipes]) {
    for (const [channelId, entries] of cache) {
      const kept = entries.filter((entry) => entry.at > cutoff);
      if (kept.length) cache.set(channelId, kept);
      else cache.delete(channelId);
    }
  }
  client.caches.spam.sweep((stamps) => !stamps.length || Date.now() - stamps[stamps.length - 1] > 60_000);
}

function start(client) {
  const run = async () => {
    try {
      await expirePunishments(client);
      await deliverReminders(client);
      await giveaways.tick(client);
      pruneCaches(client);
    } catch (error) {
      logger.error('Scheduler tick failed', error);
    }
  };

  run();
  const timer = setInterval(run, 60_000);
  timer.unref?.();
  logger.info('Scheduler started (60s interval)');
  return timer;
}

module.exports = { start, expirePunishments, deliverReminders };
