'use strict';

require('dotenv').config();

const path = require('node:path');

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function list(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',

  defaultPrefix: process.env.DEFAULT_PREFIX || '.',
  ownerIds: list(process.env.OWNER_IDS),
  devGuildId: process.env.DEV_GUILD_ID || '',
  supportServer: process.env.SUPPORT_SERVER || '',

  web: {
    enabled: bool(process.env.WEB_ENABLED, true),
    port: Number(process.env.WEB_PORT || 3000),
    baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    sessionSecret: process.env.SESSION_SECRET || 'vex-insecure-development-secret',
  },

  api: {
    lastfm: process.env.LASTFM_API_KEY || '',
    weather: process.env.WEATHER_API_KEY || '',
  },

  databasePath: path.resolve(process.env.DATABASE_PATH || './data/vex.db'),

  /** Fallback colours. Servers override `primary` from the dashboard. */
  colors: {
    primary: process.env.DEFAULT_COLOR || '#8b5cf6',
    success: '#3ba55d',
    error: '#ed4245',
    warn: '#faa61a',
    neutral: '#2b2d31',
  },
};

module.exports = config;
