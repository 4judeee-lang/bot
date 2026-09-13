'use strict';

const starboard = require('../modules/starboard');
const roles = require('../modules/roles');

module.exports = {
  name: 'messageReactionRemove',
  async run(client, reaction, user) {
    if (user.bot) return;
    await roles.handleReaction(reaction, user, false).catch(() => {});
    await starboard.sync(client, reaction).catch(() => {});
  },
};
