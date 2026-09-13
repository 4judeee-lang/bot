'use strict';

/**
 * Prints the link that adds this bot to a server, built from the same
 * permission list the bot asks for everywhere else.
 *
 *   npm run invite
 */

const config = require('../src/config');
const { inviteUrl, INVITE_PERMISSION_NAMES } = require('../src/lib/permissions');
const { titleCase } = require('../src/lib/util');

if (!config.clientId) {
  console.error('\nCLIENT_ID is not set in your .env file.');
  console.error('Find it at https://discord.com/developers/applications → your app → OAuth2.\n');
  process.exit(1);
}

console.log('\nOpen this link to add the bot to a server:\n');
console.log(`  ${inviteUrl(config.clientId)}\n`);
console.log('It asks for these permissions and nothing more:\n');

const pretty = INVITE_PERMISSION_NAMES.map((name) => titleCase(name.replace(/([A-Z])/g, ' $1').trim()));
for (let i = 0; i < pretty.length; i += 3) {
  console.log(`  ${pretty.slice(i, i + 3).map((name) => name.padEnd(26)).join('')}`.trimEnd());
}
console.log('\nYou need Manage Server in the server you are adding it to.\n');
