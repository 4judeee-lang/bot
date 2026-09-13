'use strict';

/**
 * Counter channels — voice channels whose name shows a live statistic, e.g.
 * "Members: 1,024". Discord rate limits channel renames hard (2 per 10
 * minutes per channel), so these are refreshed on a slow timer, never on
 * every join.
 */

const store = require('../lib/db');
const { formatNumber } = require('../lib/util');
const logger = require('../lib/logger').scoped('counters');

const PLACEHOLDERS = {
  '{members}': (guild) => formatNumber(guild.memberCount),
  '{humans}': (guild) => formatNumber(guild.members.cache.filter((member) => !member.user.bot).size),
  '{bots}': (guild) => formatNumber(guild.members.cache.filter((member) => member.user.bot).size),
  '{boosts}': (guild) => formatNumber(guild.premiumSubscriptionCount ?? 0),
  '{channels}': (guild) => formatNumber(guild.channels.cache.size),
  '{roles}': (guild) => formatNumber(guild.roles.cache.size - 1),
};

const TOKENS = Object.keys(PLACEHOLDERS);

function list(guildId) {
  return store.getSetting(guildId, 'counters.channels') ?? {};
}

function set(guildId, channelId, template) {
  const all = list(guildId);
  all[channelId] = template;
  store.setSetting(guildId, 'counters.channels', all);
}

function remove(guildId, channelId) {
  const all = list(guildId);
  if (!all[channelId]) return false;
  delete all[channelId];
  store.setSetting(guildId, 'counters.channels', all);
  return true;
}

function render(guild, template) {
  let name = template;
  for (const [token, resolve] of Object.entries(PLACEHOLDERS)) {
    if (name.includes(token)) name = name.split(token).join(resolve(guild));
  }
  return name.slice(0, 100);
}

/** Refresh every counter channel in every guild. Called on a slow timer. */
async function refreshAll(client) {
  for (const guild of client.guilds.cache.values()) {
    const counters = list(guild.id);
    for (const [channelId, template] of Object.entries(counters)) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        remove(guild.id, channelId);
        continue;
      }

      const name = render(guild, template);
      if (channel.name === name) continue;

      try {
        await channel.setName(name, 'Counter channel update');
      } catch (error) {
        logger.debug(`Could not rename counter ${channelId}: ${error.message}`);
      }
    }
  }
}

module.exports = { list, set, remove, render, refreshAll, TOKENS };
