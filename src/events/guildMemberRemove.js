'use strict';

const greetings = require('../modules/greetings');
const invites = require('../modules/invites');
const antinuke = require('../modules/antinuke');
const { sendLog } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { relative } = require('../lib/util');

module.exports = {
  name: 'guildMemberRemove',
  async run(client, member) {
    const guild = member.guild;

    await antinuke.onMemberRemove(member).catch(() => {});
    const inviterId = invites.trackLeave(guild, member.id);

    await greetings.announce('goodbye', { guild, user: member.user, member });

    const theme = themeFor(guild.id);
    const roles = member.roles?.cache
      ?.filter((role) => role.id !== guild.id)
      .map((role) => role.name)
      .slice(0, 15)
      .join(', ');

    await sendLog(guild, 'members', theme.base({
      color: theme.errorColor,
      author: { name: `${member.user.tag} left`, iconURL: member.user.displayAvatarURL() },
      description: `${member.user} \`${member.id}\``,
      fields: [
        { name: 'Joined', value: member.joinedAt ? relative(member.joinedAt) : 'unknown', inline: true },
        { name: 'Member count', value: String(guild.memberCount), inline: true },
        ...(inviterId ? [{ name: 'Invited by', value: `<@${inviterId}>`, inline: true }] : []),
        ...(roles ? [{ name: 'Roles', value: roles, inline: false }] : []),
      ],
      thumbnail: member.user.displayAvatarURL(),
      timestamp: true,
    }));
  },
};
