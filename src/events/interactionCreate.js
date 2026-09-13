'use strict';

const { respond, eph } = require('../lib/reply');
const { handleInteraction } = require('../lib/dispatcher');
const tickets = require('../modules/tickets');
const giveaways = require('../modules/giveaways');
const voicemaster = require('../modules/voicemaster');
const roles = require('../modules/roles');
const { themeFor } = require('../lib/embeds');
const logger = require('../lib/logger');

/**
 * Buttons whose ids we own. Paginator and confirm buttons are handled by
 * their own collectors, so they are deliberately not listed here.
 */
async function routeButton(interaction) {
  const id = interaction.customId;

  if (id.startsWith('ticket:')) return tickets.handleButton(interaction);
  if (id === 'giveaway:enter') return giveaways.enter(interaction);
  if (id.startsWith('vm:')) return voicemaster.handleButton(interaction);
  if (id.startsWith('role:')) return roles.handleButton(interaction);
  return undefined;
}

module.exports = {
  name: 'interactionCreate',
  async run(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        return await handleInteraction(client, interaction);
      }

      if (interaction.isButton()) {
        return await routeButton(interaction);
      }

      if (interaction.isAutocomplete()) {
        const command = client.registry.get(interaction.commandName);
        if (command?.autocomplete) return await command.autocomplete(interaction);
        return await interaction.respond([]);
      }
    } catch (error) {
      logger.error(`Interaction "${interaction.customId ?? interaction.commandName}" failed`, error);
      const theme = themeFor(interaction.guild?.id);
      const payload = eph({ embeds: [theme.error('Something went wrong handling that.')] });
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await respond(interaction, payload).catch(() => {});
      }
    }
    return undefined;
  },
};
