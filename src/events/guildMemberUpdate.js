'use strict';

const store = require('../lib/db');
const greetings = require('../modules/greetings');
const { sendLog } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');

module.exports = {
  name: 'guildMemberUpdate',
  async run(client, oldMember, newMember) {
    const guild = newMember.guild;
    const theme = themeFor(guild.id);

    // Started boosting.
    if (!oldMember.premiumSince && newMember.premiumSince) {
      await greetings.announce('boost', { guild, user: newMember.user, member: newMember });
    }

    if (oldMember.nickname !== newMember.nickname) {
      // Re-apply a forced nickname if they changed it themselves.
      const forced = (store.getSetting(guild.id, 'moderation.forcedNicks') ?? {})[newMember.id];
      if (forced && newMember.nickname !== forced && newMember.manageable) {
        await newMember.setNickname(forced, 'Forced nickname re-applied').catch(() => {});
      }

      await sendLog(guild, 'members', theme.base({
        author: { name: `${newMember.user.tag} — nickname changed`, iconURL: newMember.user.displayAvatarURL() },
        fields: [
          { name: 'Before', value: oldMember.nickname ?? '*none*', inline: true },
          { name: 'After', value: newMember.nickname ?? '*none*', inline: true },
        ],
        timestamp: true,
      }));
    }

    const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));

    if (added.size || removed.size) {
      const fields = [];
      if (added.size) fields.push({ name: 'Added', value: added.map((r) => `${r}`).join(' ').slice(0, 1024), inline: false });
      if (removed.size) fields.push({ name: 'Removed', value: removed.map((r) => `${r}`).join(' ').slice(0, 1024), inline: false });

      await sendLog(guild, 'members', theme.base({
        author: { name: `${newMember.user.tag} — roles updated`, iconURL: newMember.user.displayAvatarURL() },
        description: `${newMember} \`${newMember.id}\``,
        fields,
        timestamp: true,
      }));
    }

    // Timeout applied or lifted by anyone, including Discord's own UI.
    const wasTimedOut = oldMember.communicationDisabledUntilTimestamp > Date.now();
    const isTimedOut = newMember.communicationDisabledUntilTimestamp > Date.now();
    if (!wasTimedOut && isTimedOut) {
      await sendLog(guild, 'moderation', theme.base({
        color: theme.warnColor,
        author: { name: `${newMember.user.tag} was timed out`, iconURL: newMember.user.displayAvatarURL() },
        description: `Until <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`,
        timestamp: true,
      }));
    }
  },
};
