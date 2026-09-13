'use strict';

const config = require('./config');
const logger = require('./lib/logger');
const { createClient } = require('./bot/client');

const BANNER = `
   ██╗   ██╗███████╗██╗  ██╗
   ██║   ██║██╔════╝╚██╗██╔╝
   ██║   ██║█████╗   ╚███╔╝
   ╚██╗ ██╔╝██╔══╝   ██╔██╗
    ╚████╔╝ ███████╗██╔╝ ██╗
     ╚═══╝  ╚══════╝╚═╝  ╚═╝  all-in-one discord utility
`;

async function main() {
  console.log(BANNER);

  if (!config.token) {
    logger.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const client = createClient();
  logger.info(`Loaded ${client.registry.size} commands across ${client.registry.categories.size} categories`);

  const wantsWeb = config.web.enabled && !process.argv.includes('--no-web');
  if (wantsWeb) {
    const { startServer } = require('./web/server');
    try {
      await startServer(client);
    } catch (error) {
      logger.error('Dashboard failed to start — the bot will keep running', error);
    }
  }

  await client.login(config.token);

  const shutdown = async (signal) => {
    logger.warn(`${signal} received — shutting down`);
    try {
      client.music?.destroyAll?.();
      await client.destroy();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));
  process.on('uncaughtException', (error) => logger.error('Uncaught exception', error));
}

main().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});
