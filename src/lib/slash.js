'use strict';

const { ApplicationCommandOptionType, PermissionsBitField } = require('discord.js');
const { slashOptionType, slashChannelTypes } = require('./arguments');
const { truncate } = require('./util');

/**
 * Turns our command definitions into Discord's slash-command payload.
 *
 * Only commands marked `slash: true` are registered — Discord allows 100
 * top-level commands and we have far more than that, so the prefix versions
 * remain the complete set while slash covers the ones people actually reach
 * for. Multi-word names ("ticket close") become subcommands automatically.
 */

function optionFor(arg) {
  const option = {
    name: arg.name.toLowerCase(),
    description: truncate(arg.description ?? `the ${arg.name}`, 100),
    type: slashOptionType(arg.type),
    required: Boolean(arg.required),
  };

  const channelTypes = slashChannelTypes(arg.type);
  if (channelTypes) option.channel_types = channelTypes;

  if (arg.type === 'choice' && arg.choices?.length) {
    option.choices = arg.choices.slice(0, 25).map((choice) => ({ name: String(choice), value: String(choice) }));
  }
  if (arg.min !== undefined) option.min_value = arg.min;
  if (arg.max !== undefined) option.max_value = arg.max;

  return option;
}

function defaultPermissions(command) {
  if (!command.permissions.length) return undefined;
  return command.permissions
    .reduce((bits, permission) => bits | PermissionsBitField.Flags[permission], 0n)
    .toString();
}

function buildSlashCommands(registry) {
  const roots = new Map();

  for (const command of registry.all()) {
    if (!command.slash) continue;

    const parts = command.name.split(' ');
    const rootName = parts[0];

    if (!roots.has(rootName)) {
      roots.set(rootName, {
        name: rootName,
        description: truncate(command.description, 100),
        options: [],
        dm_permission: !command.guildOnly,
        default_member_permissions: defaultPermissions(command),
      });
    }
    const root = roots.get(rootName);

    // A bare "ban" — the root command itself.
    if (parts.length === 1) {
      root.description = truncate(command.description, 100);
      root.dm_permission = !command.guildOnly;
      root.default_member_permissions = defaultPermissions(command);
      root.options.unshift(...command.args.map(optionFor));
      root.hasRoot = true;
      continue;
    }

    // "ticket close" → /ticket close
    if (parts.length === 2) {
      root.options.push({
        name: parts[1],
        description: truncate(command.description, 100),
        type: ApplicationCommandOptionType.Subcommand,
        options: command.args.map(optionFor),
      });
      continue;
    }

    // "automod word add" → /automod word add
    const groupName = parts[1];
    let group = root.options.find(
      (option) => option.name === groupName && option.type === ApplicationCommandOptionType.SubcommandGroup,
    );
    if (!group) {
      group = {
        name: groupName,
        description: `${groupName} commands`,
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [],
      };
      root.options.push(group);
    }
    group.options.push({
      name: parts[2],
      description: truncate(command.description, 100),
      type: ApplicationCommandOptionType.Subcommand,
      options: command.args.map(optionFor),
    });
  }

  // A root cannot mix its own options with subcommands — subcommands win.
  for (const root of roots.values()) {
    const hasSub = root.options.some((option) =>
      [ApplicationCommandOptionType.Subcommand, ApplicationCommandOptionType.SubcommandGroup].includes(option.type),
    );
    if (hasSub) {
      root.options = root.options.filter((option) =>
        [ApplicationCommandOptionType.Subcommand, ApplicationCommandOptionType.SubcommandGroup].includes(option.type),
      );
    }
    delete root.hasRoot;
    if (root.default_member_permissions === undefined) delete root.default_member_permissions;
  }

  return [...roots.values()];
}

module.exports = { buildSlashCommands };
