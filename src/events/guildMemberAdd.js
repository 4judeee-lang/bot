'use strict';

const store = require('../lib/db');
const greetings = require('../modules/greetings');
const antiraid = require('../modules/antiraid');
const invites = require('../modules/invites');
const { sendLog } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { relative } = require('../lib/util');

module.exports = {
  name: 'guildMemberAdd',
  async run(client, member) {
    const guild = member.guild;

    // Screening can remove the member, in which case nothing else should run.
    if (await antiraid.screenMember(member)) return;
    await antiraid.trackJoin(client, member);

    const invite = await invites.trackJoin(client, member).catch(() => null);

    await greetings.applyAutoroles(member).catch(() => {});
    await greetings.announce('welcome', {
      guild,
      user: member.user,
      member,
      extra: {
        'inviter.name': invite?.inviter?.username ?? 'unknown',
        'invite.code': invite?.code ?? 'unknown',
      },
    });
    await greetings.welcomeDm(member).catch(() => {});

    // Re-apply an active mute so leaving and rejoining does not clear it.
    const activeMute = store.db
      .prepare("SELECT * FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'mute' AND active = 1")
      .get(guild.id, member.id);
    const muteRole = store.getSetting(guild.id, 'moderation.muteRole');
    if (activeMute && muteRole && guild.roles.cache.has(muteRole)) {
      await member.roles.add(muteRole, 'Re-applying active mute').catch(() => {});
    }

    const theme = themeFor(guild.id);
    await sendLog(guild, 'members', theme.base({
      color: theme.successColor,
      author: { name: `${member.user.tag} joined`, iconURL: member.user.displayAvatarURL() },
      description: `${member} \`${member.id}\``,
      fields: [
        { name: 'Account created', value: relative(member.user.createdAt), inline: true },
        { name: 'Member count', value: String(guild.memberCount), inline: true },
        ...(invite ? [{ name: 'Invited by', value: `${invite.inviter} (\`${invite.code}\`)`, inline: true }] : []),
      ],
      thumbnail: member.user.displayAvatarURL(),
      timestamp: true,
    }));
  },
};
