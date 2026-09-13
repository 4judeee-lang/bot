'use strict';

const starboard = require('../modules/starboard');
const roles = require('../modules/roles');
const { remember } = require('../modules/messages');

module.exports = {
  name: 'messageReactionAdd',
  async run(client, reaction, user) {
    if (user.bot) return;

    await roles.handleReaction(reaction, user, true).catch(() => {});
    await starboard.sync(client, reaction).catch(() => {});

    if (reaction.message?.channel?.id) {
      remember(client.caches.reactionSnipes, reaction.message.channel.id, {
        emoji: reaction.emoji.toString(),
        user: { id: user.id, tag: user.tag },
        messageUrl: reaction.message.url,
        at: Date.now(),
      });
    }
  },
};
