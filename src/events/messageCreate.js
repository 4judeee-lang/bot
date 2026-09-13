'use strict';

const store = require('../lib/db');
const { handleMessage } = require('../lib/dispatcher');
const { themeFor } = require('../lib/embeds');
const levels = require('../modules/levels');
const automod = require('../modules/automod');
const messages = require('../modules/messages');
const config = require('../config');

/** Mentioning the bot with nothing else should tell you the prefix. */
function isBareMention(client, message) {
  const pattern = new RegExp(`^<@!?${client.user.id}>$`);
  return pattern.test(message.content.trim());
}

module.exports = {
  name: 'messageCreate',
  async run(client, message) {
    if (message.author.bot || !message.guild || !message.channel.isTextBased()) return;

    // Automod runs first — a filtered message should never trigger anything else.
    if (await automod.handleMessage(client, message)) return;

    const prefix = store.getPrefix(message.guild.id);

    if (isBareMention(client, message)) {
      const theme = themeFor(message.guild.id);
      await message
        .reply({
          embeds: [
            theme.base({
              description:
                `My prefix here is \`${prefix}\`.\n` +
                `Try \`${prefix}help\` for the command guide` +
                `${config.web.baseUrl ? `, or configure me at ${config.web.baseUrl}` : ''}.`,
            }),
          ],
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }

    const isCommand = message.content.startsWith(prefix)
      ? await handleMessage(client, message, prefix)
      : false;

    if (isCommand) return;

    // Passive features, cheapest first.
    await messages.afk(message).catch(() => {});
    await levels.handleMessage(message).catch(() => {});
    await messages.autorespond(message).catch(() => {});
    await messages.highlights(message).catch(() => {});
    await messages.sticky(message).catch(() => {});
  },
};
