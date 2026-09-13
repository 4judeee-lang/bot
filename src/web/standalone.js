'use strict';

/**
 * Runs the dashboard on its own, without connecting to Discord.
 *
 * Useful for working on the front end: pages render, settings load and save
 * against the database, but anything that needs live guild data (channel and
 * role pickers) will be empty because there is no bot client attached.
 */

const { Collection } = require('discord.js');
const { startServer } = require('./server');
const { Registry } = require('../lib/registry');
const logger = require('../lib/logger');

const stub = {
  user: { id: '0', username: 'Vex', tag: 'Vex#0000', displayAvatarURL: () => '' },
  guilds: { cache: new Collection() },
  registry: new Registry().load(),
};

startServer(stub)
  .then(() => logger.warn('Running without a Discord connection — guild data will be empty.'))
  .catch((error) => {
    logger.error('Failed to start', error);
    process.exit(1);
  });
