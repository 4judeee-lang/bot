'use strict';

const express = require('express');
const { SETTINGS, CATEGORIES, CATEGORY_META } = require('../../lib/settingsSchema');
const { VARIABLES } = require('../../lib/variables');
const store = require('../../lib/db');
const config = require('../../config');
const { inviteUrl } = require('../../lib/permissions');

const router = express.Router();

function requireLogin(request, response, next) {
  if (!request.session.user) return response.redirect(`/auth/login?next=${encodeURIComponent(request.originalUrl)}`);
  return next();
}

/** Group the settings schema by category for the dashboard forms. */
function settingsByCategory() {
  return CATEGORIES.map((category) => ({
    name: category,
    ...CATEGORY_META[category],
    settings: Object.entries(SETTINGS)
      .filter(([, meta]) => meta.category === category)
      .map(([key, meta]) => ({ key, ...meta })),
  })).filter((category) => category.settings.length);
}

router.get('/', (request, response) => {
  const client = request.app.locals.bot;
  response.render('index', {
    title: 'Vex — the all-in-one Discord bot',
    stats: {
      guilds: client?.guilds.cache.size ?? 0,
      users: client?.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0) ?? 0,
      commands: client?.registry.size ?? 0,
    },
  });
});

router.get('/guide', (request, response) => {
  const client = request.app.locals.bot;
  const registry = client?.registry;

  const categories = registry
    ? [...registry.categories.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, commands]) => ({
          name,
          commands: commands.map((command) => ({
            name: command.name,
            description: command.description,
            details: command.details ?? null,
            usage: command.usage,
            aliases: command.aliases,
            examples: command.examples,
            args: command.args.map((arg) => ({
              name: arg.name,
              type: arg.type,
              required: Boolean(arg.required),
              description: arg.description ?? null,
            })),
            permissions: command.permissions,
            botPermissions: command.botPermissions,
            ownerOnly: Boolean(command.ownerOnly),
            serverOwnerOnly: Boolean(command.serverOwnerOnly),
            cooldown: command.cooldown,
          })),
        }))
    : [];

  response.render('guide', {
    title: 'Command guide',
    categories,
    total: registry?.size ?? 0,
    prefix: config.defaultPrefix,
    variables: VARIABLES,
    settingsCategories: settingsByCategory(),
  });
});

router.get('/dashboard', requireLogin, (request, response) => {
  const client = request.app.locals.bot;
  const managed = (request.session.guilds ?? []).map((guild) => ({
    ...guild,
    present: Boolean(client?.guilds.cache.has(guild.id)),
    memberCount: client?.guilds.cache.get(guild.id)?.memberCount ?? null,
  }));

  managed.sort((a, b) => Number(b.present) - Number(a.present) || a.name.localeCompare(b.name));

  response.render('servers', {
    title: 'Your servers',
    guilds: managed,
    inviteBase: inviteUrl(config.clientId),
  });
});

router.get('/dashboard/:guildId', requireLogin, (request, response) => {
  const { guildId } = request.params;
  const client = request.app.locals.bot;

  const allowed = (request.session.guilds ?? []).find((guild) => guild.id === guildId);
  if (!allowed) {
    return response.status(403).render('error', {
      title: 'No access',
      code: 403,
      message: 'You need the Manage Server permission in that server to configure it.',
    });
  }

  const guild = client?.guilds.cache.get(guildId);
  if (!guild) {
    return response.status(404).render('error', {
      title: 'Bot not in server',
      code: 404,
      message: 'Add the bot to that server first, then come back.',
    });
  }

  return response.render('guild', {
    title: `${guild.name} — dashboard`,
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      memberCount: guild.memberCount,
    },
    prefix: store.getPrefix(guild.id),
    categories: settingsByCategory(),
    variables: VARIABLES,
  });
});

module.exports = router;
