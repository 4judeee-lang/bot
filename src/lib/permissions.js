'use strict';

const { PermissionsBitField } = require('discord.js');

/**
 * The permissions the bot asks for when it is invited.
 *
 * Everything here is needed by a feature that ships in the bot, and nothing
 * more — no Administrator shortcut, so a server owner can read the list on
 * the invite screen and see exactly what they are granting.
 *
 * Both `.invite` and the dashboard's "add the bot" link build their URL from
 * this one list, so they can never ask for different things.
 */
const INVITE_PERMISSION_NAMES = [
  // messaging
  'ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'EmbedLinks',
  'AttachFiles', 'ReadMessageHistory', 'AddReactions', 'UseExternalEmojis',
  // moderation
  'ManageMessages', 'ManageChannels', 'ManageRoles', 'ManageNicknames',
  'ManageGuildExpressions', 'KickMembers', 'BanMembers', 'ModerateMembers',
  'ManageGuild', 'ViewAuditLog', 'ManageWebhooks',
  // voice
  'Connect', 'Speak', 'MuteMembers', 'DeafenMembers', 'MoveMembers',
];

const INVITE_PERMISSIONS = INVITE_PERMISSION_NAMES
  .reduce((bits, flag) => bits | PermissionsBitField.Flags[flag], 0n)
  .toString();

/** The full invite URL for a given application ID. */
function inviteUrl(clientId) {
  if (!clientId) return null;
  return (
    `https://discord.com/oauth2/authorize?client_id=${clientId}` +
    `&permissions=${INVITE_PERMISSIONS}&scope=bot%20applications.commands`
  );
}

module.exports = { INVITE_PERMISSION_NAMES, INVITE_PERMISSIONS, inviteUrl };
