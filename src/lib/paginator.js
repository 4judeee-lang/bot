'use strict';

const { respond } = require('./reply');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
} = require('discord.js');
const emojis = require('./emojis');

/**
 * Button paginator shared by every multi-page view.
 *
 * Only the person who ran the command can turn pages; everyone else gets an
 * ephemeral nudge rather than silence, which is far less confusing.
 */
async function paginate(ctx, pages, { timeout = 120_000, startPage = 0 } = {}) {
  if (!pages.length) throw new Error('paginate() called with no pages');
  if (pages.length === 1) return ctx.send({ embeds: [pages[0]] });

  let index = Math.min(Math.max(0, startPage), pages.length - 1);

  const buttons = (disabled = false) => {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('page:first')
        .setEmoji(emojis.first)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || index === 0),
      new ButtonBuilder()
        .setCustomId('page:prev')
        .setEmoji(emojis.previous)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || index === 0),
      new ButtonBuilder()
        .setCustomId('page:counter')
        .setLabel(`${index + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('page:next')
        .setEmoji(emojis.next)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || index === pages.length - 1),
      new ButtonBuilder()
        .setCustomId('page:last')
        .setEmoji(emojis.last)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || index === pages.length - 1),
    );
    return row;
  };

  // With a lot of pages, buttons alone get tedious — offer a jump menu too.
  const selectRow = () => {
    if (pages.length <= 5 || pages.length > 25) return null;
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('page:jump')
        .setPlaceholder('Jump to a page…')
        .addOptions(
          pages.map((_, i) => ({
            label: `Page ${i + 1}`,
            value: String(i),
            default: i === index,
          })),
        ),
    );
  };

  const render = (disabled = false) => {
    const components = [buttons(disabled)];
    const select = selectRow();
    if (select) {
      if (disabled) select.components[0].setDisabled(true);
      components.push(select);
    }
    return { embeds: [pages[index]], components };
  };

  const message = await ctx.send(render());
  if (!message) return null;

  const collector = message.createMessageComponentCollector({ time: timeout });

  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== ctx.user.id) {
      return respond(interaction, {
        content: `${emojis.error} Run the command yourself to page through these results.`,
        ephemeral: true,
      });
    }

    if (interaction.componentType === ComponentType.StringSelect) {
      index = Number(interaction.values[0]);
    } else {
      switch (interaction.customId) {
        case 'page:first': index = 0; break;
        case 'page:prev': index = Math.max(0, index - 1); break;
        case 'page:next': index = Math.min(pages.length - 1, index + 1); break;
        case 'page:last': index = pages.length - 1; break;
        default: break;
      }
    }

    collector.resetTimer();
    return interaction.update(render()).catch(() => {});
  });

  collector.on('end', () => {
    message.edit(render(true)).catch(() => {});
  });

  return message;
}

module.exports = { paginate };
