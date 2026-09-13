'use strict';

const { MessageFlags } = require('discord.js');

/**
 * discord.js deprecated `ephemeral: true` in favour of message flags, and
 * `fetchReply` in favour of `withResponse`. These two helpers keep the modern
 * form in one place instead of scattered through every module.
 */

/** Mark a reply payload as ephemeral (only the clicker sees it). */
function eph(payload) {
  const options = typeof payload === 'string' ? { content: payload } : { ...payload };
  delete options.ephemeral;
  const existing = options.flags;
  options.flags = existing ? [existing, MessageFlags.Ephemeral].flat() : MessageFlags.Ephemeral;
  return options;
}

/**
 * Reply to an interaction, translating `ephemeral: true` into the flag form.
 * Modules call this instead of `interaction.reply` so the deprecated option
 * never reaches discord.js.
 */
function respond(interaction, payload) {
  const options = typeof payload === 'string' ? { content: payload } : { ...payload };
  return interaction.reply(options.ephemeral ? eph(options) : options);
}

/** Pull the Message out of whatever `reply({ withResponse: true })` returned. */
function messageFrom(response) {
  if (!response) return null;
  if (response.resource?.message) return response.resource.message;
  return response.interaction ? null : response;
}

module.exports = { eph, respond, messageFrom, MessageFlags };
