'use strict';

const automod = require('../modules/automod');
const { sendLog, isIgnored } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { remember } = require('../modules/messages');
const { truncate } = require('../lib/util');

module.exports = {
  name: 'messageUpdate',
  async run(client, oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // Editing a message is a classic way to sneak content past a filter.
    if (await automod.handleMessage(client, newMessage)) return;

    remember(client.caches.editSnipes, newMessage.channel.id, {
      before: oldMessage.content ?? '',
      after: newMessage.content ?? '',
      url: newMessage.url,
      author: { id: newMessage.author.id, tag: newMessage.author.tag, avatar: newMessage.author.displayAvatarURL() },
      at: Date.now(),
    });

    if (isIgnored(newMessage.guild, newMessage.channel.id)) return;

    const theme = themeFor(newMessage.guild.id);
    await sendLog(newMessage.guild, 'messages', theme.base({
      color: theme.warnColor,
      author: { name: `${newMessage.author.tag} — message edited`, iconURL: newMessage.author.displayAvatarURL() },
      fields: [
        { name: 'Before', value: truncate(oldMessage.content || '*empty*', 1000), inline: false },
        { name: 'After', value: truncate(newMessage.content || '*empty*', 1000), inline: false },
        { name: 'Channel', value: `${newMessage.channel} — [jump](${newMessage.url})`, inline: true },
      ],
      timestamp: true,
    }));
  },
};
