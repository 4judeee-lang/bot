'use strict';

const store = require('../lib/db');
const { sendLog, isIgnored } = require('../lib/modlog');
const { themeFor } = require('../lib/embeds');
const { remember } = require('../modules/messages');
const { truncate } = require('../lib/util');

module.exports = {
  name: 'messageDelete',
  async run(client, message) {
    if (!message.guild || message.author?.bot) return;
    if (message.partial && !message.content) return;

    // Snipe cache.
    const snipeIgnored = store.getSetting(message.guild.id, 'fun.snipeIgnored') ?? [];
    if (store.getSetting(message.guild.id, 'fun.snipeEnabled') && !snipeIgnored.includes(message.channel.id)) {
      remember(client.caches.snipes, message.channel.id, {
        content: message.content,
        author: { id: message.author.id, tag: message.author.tag, avatar: message.author.displayAvatarURL() },
        attachments: message.attachments.map((attachment) => attachment.url),
        at: Date.now(),
      });
    }

    if (isIgnored(message.guild, message.channel.id)) return;

    const theme = themeFor(message.guild.id);
    await sendLog(message.guild, 'messages', theme.base({
      color: theme.errorColor,
      author: { name: `${message.author.tag} — message deleted`, iconURL: message.author.displayAvatarURL() },
      description: truncate(message.content || '*no text content*', 3000),
      fields: [
        { name: 'Channel', value: `${message.channel}`, inline: true },
        { name: 'Author', value: `${message.author} \`${message.author.id}\``, inline: true },
        ...(message.attachments.size
          ? [{ name: 'Attachments', value: message.attachments.map((a) => a.name).join(', ').slice(0, 1024), inline: false }]
          : []),
      ],
      timestamp: true,
    }));
  },
};
