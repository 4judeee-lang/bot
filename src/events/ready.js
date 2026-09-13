'use strict';

const { ActivityType } = require('discord.js');
const store = require('../lib/db');
const logger = require('../lib/logger');
const tasks = require('../modules/tasks');
const invites = require('../modules/invites');
const { MusicManager } = require('../modules/music');
const config = require('../config');

module.exports = {
  name: 'clientReady',
  once: true,
  async run(client) {
    logger.ready(`Logged in as ${client.user.tag}`);
    logger.info(
      `Serving ${client.guilds.cache.size} guild(s) and ${client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0).toLocaleString()} members`,
    );

    client.music = new MusicManager(client);
    if (!client.music.available) logger.warn('play-dl unavailable — music playback is disabled');

    for (const guild of client.guilds.cache.values()) store.rememberGuild(guild);

    await invites.cacheAll(client);
    tasks.start(client);

    const presences = [
      () => ({ name: `${config.defaultPrefix}help • ${client.guilds.cache.size} servers`, type: ActivityType.Listening }),
      () => ({ name: `${client.users.cache.size.toLocaleString()} users`, type: ActivityType.Watching }),
      () => ({ name: `${config.web.baseUrl.replace(/^https?:\/\//, '')}`, type: ActivityType.Playing }),
    ];

    let index = 0;
    const rotate = () => {
      client.user.setPresence({ activities: [presences[index % presences.length]()], status: 'online' });
      index += 1;
    };
    rotate();
    const timer = setInterval(rotate, 120_000);
    timer.unref?.();
  },
};
