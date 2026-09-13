'use strict';

/**
 * Registers slash commands with Discord.
 *
 *   npm run deploy            → global (takes up to an hour to appear)
 *   npm run deploy -- --dev   → instant, into DEV_GUILD_ID
 *   npm run deploy -- --clear → remove every registered command
 */

const { REST, Routes } = require('discord.js');
const config = require('../src/config');
const { Registry } = require('../src/lib/registry');
const { buildSlashCommands } = require('../src/lib/slash');
const logger = require('../src/lib/logger');

async function main() {
  if (!config.token || !config.clientId) {
    logger.error('DISCORD_TOKEN and CLIENT_ID must both be set in .env');
    process.exit(1);
  }

  const dev = process.argv.includes('--dev');
  const clear = process.argv.includes('--clear');

  if (dev && !config.devGuildId) {
    logger.error('--dev needs DEV_GUILD_ID set in .env');
    process.exit(1);
  }

  const registry = new Registry().load();
  const body = clear ? [] : buildSlashCommands(registry);
  const rest = new REST().setToken(config.token);
  const route = dev
    ? Routes.applicationGuildCommands(config.clientId, config.devGuildId)
    : Routes.applicationCommands(config.clientId);

  logger.info(`${clear ? 'Clearing' : `Registering ${body.length}`} command(s) ${dev ? `in guild ${config.devGuildId}` : 'globally'}…`);

  try {
    const result = await rest.put(route, { body });
    logger.ready(`Done — ${result.length} command(s) live.`);
    if (!clear && !dev) logger.info('Global commands can take up to an hour to show up in clients.');
  } catch (error) {
    logger.error('Registration failed', error);
    process.exit(1);
  }
}

main();
