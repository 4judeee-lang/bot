'use strict';

const { respond } = require('./reply');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojis = require('./emojis');

/**
 * Ask before doing something destructive.
 *
 * Resolves `true` only if the person who ran the command presses Confirm
 * within the timeout. Anything else — cancel, timeout, someone else pressing
 * the button — resolves `false`, so callers can simply `if (!confirmed) return`.
 */
async function confirm(ctx, {
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  timeout = 30_000,
  fields = [],
} = {}) {
  const embed = ctx.theme.base({
    color: danger ? ctx.theme.warnColor : ctx.theme.primary,
    title: `${emojis.warn} ${title}`,
    description,
    fields,
    footer: { text: `Only ${ctx.user.username} can respond • expires in ${Math.round(timeout / 1000)}s` },
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm:yes')
      .setLabel(confirmLabel)
      .setStyle(danger ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('confirm:no')
      .setLabel(cancelLabel)
      .setStyle(ButtonStyle.Secondary),
  );

  const message = await ctx.send({ embeds: [embed], components: [row] });
  if (!message) return false;

  try {
    const interaction = await message.awaitMessageComponent({
      time: timeout,
      filter: (i) => {
        if (i.user.id !== ctx.user.id) {
          respond(i, {
            content: `${emojis.error} This confirmation belongs to someone else.`,
            ephemeral: true,
          }).catch(() => {});
          return false;
        }
        return true;
      },
    });

    const approved = interaction.customId === 'confirm:yes';
    const result = ctx.theme.base({
      color: approved ? ctx.theme.successColor : ctx.theme.errorColor,
      description: approved
        ? `${emojis.loading} Confirmed — working on it…`
        : `${emojis.error} Cancelled. Nothing was changed.`,
    });

    await interaction.update({ embeds: [result], components: [] }).catch(() => {});
    ctx.confirmationMessage = message;
    return approved;
  } catch {
    const expired = ctx.theme.base({
      color: ctx.theme.errorColor,
      description: `${emojis.cooldown} Confirmation timed out. Nothing was changed.`,
    });
    await message.edit({ embeds: [expired], components: [] }).catch(() => {});
    return false;
  }
}

module.exports = { confirm };
