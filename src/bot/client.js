'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Partials, Collection, Options } = require('discord.js');
const { Registry } = require('../lib/registry');
const logger = require('../lib/logger');

/**
 * Builds the discord.js client and wires up commands, events and the shared
 * in-memory caches the modules use.
 */
function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildExpressions,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.GuildMember,
      Partials.User,
    ],
    allowedMentions: { parse: ['users'], repliedUser: false },
    // Keep memory sane on large servers without losing what the bot needs.
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 100,
      PresenceManager: 0,
      ReactionManager: 50,
    }),
  });

  client.registry = new Registry().load();

  /** Short-lived caches used by snipe, anti-spam, afk and voice tracking. */
  client.caches = {
    snipes: new Collection(), // channelId -> deleted message[]
    editSnipes: new Collection(), // channelId -> edit[]
    reactionSnipes: new Collection(), // channelId -> reaction[]
    spam: new Collection(), // `${guild}:${user}` -> timestamps[]
    joins: new Collection(), // guildId -> timestamps[]
    invites: new Collection(), // guildId -> Collection(code, uses)
    voiceSessions: new Collection(), // `${guild}:${user}` -> joinedAt
    afkReturn: new Collection(),
  };

  client.music = null; // attached in ready once voice deps are loaded

  loadEvents(client);
  return client;
}

function loadEvents(client) {
  const directory = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(directory)) return;

  let count = 0;
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.js'))) {
    const exported = require(path.join(directory, file));
    // A file may export one listener or an array of them.
    for (const event of Array.isArray(exported) ? exported : [exported]) {
      if (!event?.name || typeof event.run !== 'function') {
        logger.warn(`Skipping malformed event export in ${file}`);
        continue;
      }
      const handler = (...args) =>
        Promise.resolve(event.run(client, ...args)).catch((error) =>
          logger.error(`Event "${event.name}" failed`, error),
        );
      if (event.once) client.once(event.name, handler);
      else client.on(event.name, handler);
      count += 1;
    }
  }
  logger.info(`Registered ${count} event listeners`);
}

module.exports = { createClient };
