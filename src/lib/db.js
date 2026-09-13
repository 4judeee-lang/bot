'use strict';

/**
 * SQLite storage layer.
 *
 * Two shapes of data live here:
 *   1. Relational tables (cases, levels, economy, giveaways, ...) — anything
 *      we need to query, sort or join.
 *   2. A generic `settings` key/value table — every toggle the dashboard can
 *      flip. Keys and their defaults are declared once in `settingsSchema.js`
 *      so the bot and the website can never drift apart.
 */

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS guilds (
  guild_id      TEXT PRIMARY KEY,
  prefix        TEXT,
  name          TEXT,
  icon          TEXT,
  joined_at     INTEGER DEFAULT (strftime('%s','now')),
  left_at       INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT NOT NULL,
  key      TEXT NOT NULL,
  value    TEXT,
  PRIMARY KEY (guild_id, key)
);

CREATE TABLE IF NOT EXISTS cases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  case_number  INTEGER NOT NULL,
  type         TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason       TEXT,
  duration     INTEGER,
  expires_at   INTEGER,
  active       INTEGER DEFAULT 1,
  created_at   INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON cases (guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cases_expiry ON cases (active, expires_at);

CREATE TABLE IF NOT EXISTS stored_roles (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  kind     TEXT NOT NULL,
  roles    TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS levels (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  xp         INTEGER DEFAULT 0,
  level      INTEGER DEFAULT 0,
  messages   INTEGER DEFAULT 0,
  voice_time INTEGER DEFAULT 0,
  last_xp    INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_levels_xp ON levels (guild_id, xp DESC);

CREATE TABLE IF NOT EXISTS level_rewards (
  guild_id TEXT NOT NULL,
  level    INTEGER NOT NULL,
  role_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, level, role_id)
);

CREATE TABLE IF NOT EXISTS economy (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  cash       INTEGER DEFAULT 0,
  bank       INTEGER DEFAULT 0,
  last_daily INTEGER DEFAULT 0,
  last_work  INTEGER DEFAULT 0,
  last_crime INTEGER DEFAULT 0,
  last_rob   INTEGER DEFAULT 0,
  streak     INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_economy_net ON economy (guild_id, cash DESC);

CREATE TABLE IF NOT EXISTS shop_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  description TEXT,
  role_id     TEXT,
  stock       INTEGER DEFAULT -1
);

CREATE TABLE IF NOT EXISTS inventory (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  item_id  INTEGER NOT NULL,
  amount   INTEGER DEFAULT 1,
  PRIMARY KEY (guild_id, user_id, item_id)
);

CREATE TABLE IF NOT EXISTS tags (
  guild_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  owner_id   TEXT,
  uses       INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, name)
);

CREATE TABLE IF NOT EXISTS autoresponders (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  trigger  TEXT NOT NULL,
  response TEXT NOT NULL,
  strict   INTEGER DEFAULT 0,
  reply    INTEGER DEFAULT 1,
  delete_trigger INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reaction_roles (
  guild_id   TEXT NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  mode       TEXT DEFAULT 'toggle',
  PRIMARY KEY (message_id, emoji)
);

CREATE TABLE IF NOT EXISTS button_roles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  label      TEXT,
  emoji      TEXT,
  style      TEXT DEFAULT 'Secondary'
);

CREATE TABLE IF NOT EXISTS starboard_entries (
  guild_id        TEXT NOT NULL,
  message_id      TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL,
  star_message_id TEXT,
  stars           INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  claimed_by TEXT,
  topic      TEXT,
  open       INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS giveaways (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  message_id  TEXT,
  prize       TEXT NOT NULL,
  winners     INTEGER DEFAULT 1,
  host_id     TEXT NOT NULL,
  ends_at     INTEGER NOT NULL,
  ended       INTEGER DEFAULT 0,
  required_role TEXT,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  giveaway_id INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  PRIMARY KEY (giveaway_id, user_id)
);

CREATE TABLE IF NOT EXISTS afk (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  reason   TEXT,
  since    INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  guild_id   TEXT,
  channel_id TEXT,
  text       TEXT NOT NULL,
  remind_at  INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS sticky_messages (
  guild_id        TEXT NOT NULL,
  channel_id      TEXT PRIMARY KEY,
  content         TEXT NOT NULL,
  last_message_id TEXT
);

CREATE TABLE IF NOT EXISTS vm_channels (
  channel_id TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS invite_uses (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  invites    INTEGER DEFAULT 0,
  leaves     INTEGER DEFAULT 0,
  bonus      INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS invite_joins (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  inviter_id TEXT,
  code       TEXT,
  joined_at  INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id  TEXT PRIMARY KEY,
  lastfm   TEXT,
  timezone TEXT,
  birthday TEXT,
  bio      TEXT
);

CREATE TABLE IF NOT EXISTS mod_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  note       TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS disabled_commands (
  guild_id   TEXT NOT NULL,
  command    TEXT NOT NULL,
  channel_id TEXT DEFAULT 'all',
  PRIMARY KEY (guild_id, command, channel_id)
);

CREATE TABLE IF NOT EXISTS command_aliases (
  guild_id TEXT NOT NULL,
  alias    TEXT NOT NULL,
  command  TEXT NOT NULL,
  PRIMARY KEY (guild_id, alias)
);

CREATE TABLE IF NOT EXISTS antinuke_whitelist (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS antinuke_actions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_antinuke_window ON antinuke_actions (guild_id, user_id, created_at);

CREATE TABLE IF NOT EXISTS highlights (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  word     TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, word)
);

CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  done       INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS reputation (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  points     INTEGER DEFAULT 0,
  last_given INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS marriages (
  guild_id TEXT NOT NULL,
  user_a   TEXT NOT NULL,
  user_b   TEXT NOT NULL,
  since    INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, user_a)
);

CREATE TABLE IF NOT EXISTS blacklist (
  id     TEXT PRIMARY KEY,
  kind   TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS command_stats (
  command TEXT PRIMARY KEY,
  uses    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS autoroles (
  guild_id TEXT NOT NULL,
  role_id  TEXT NOT NULL,
  kind     TEXT DEFAULT 'member',
  PRIMARY KEY (guild_id, role_id, kind)
);

CREATE TABLE IF NOT EXISTS playlists (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL,
  name     TEXT NOT NULL,
  tracks   TEXT NOT NULL DEFAULT '[]'
);
`);

/* ── settings helpers ────────────────────────────────────────────────── */

const { SETTINGS, defaultsFor } = require('./settingsSchema');

const settingsCache = new Map(); // guildId -> Map(key, value)

const stmt = {
  getSetting: db.prepare('SELECT value FROM settings WHERE guild_id = ? AND key = ?'),
  allSettings: db.prepare('SELECT key, value FROM settings WHERE guild_id = ?'),
  setSetting: db.prepare(`
    INSERT INTO settings (guild_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value
  `),
  delSetting: db.prepare('DELETE FROM settings WHERE guild_id = ? AND key = ?'),
  guild: db.prepare('SELECT * FROM guilds WHERE guild_id = ?'),
  upsertGuild: db.prepare(`
    INSERT INTO guilds (guild_id, name, icon) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET name = excluded.name, icon = excluded.icon, left_at = NULL
  `),
  setPrefix: db.prepare(`
    INSERT INTO guilds (guild_id, prefix) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix
  `),
};

function parse(raw, fallback) {
  if (raw === undefined || raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Read a single setting, falling back to the schema default. */
function getSetting(guildId, key) {
  let cached = settingsCache.get(guildId);
  if (!cached) {
    cached = new Map();
    for (const row of stmt.allSettings.all(guildId)) cached.set(row.key, parse(row.value));
    settingsCache.set(guildId, cached);
  }
  if (cached.has(key)) {
    const value = cached.get(key);
    if (value !== undefined && value !== null) return value;
  }
  return SETTINGS[key] ? structuredClone(SETTINGS[key].default) : undefined;
}

/** Every setting for a guild, merged over the schema defaults. */
function getSettings(guildId) {
  const result = defaultsFor();
  for (const row of stmt.allSettings.all(guildId)) {
    const value = parse(row.value);
    if (value !== undefined && value !== null) result[row.key] = value;
  }
  return result;
}

function setSetting(guildId, key, value) {
  if (value === undefined || value === null) {
    stmt.delSetting.run(guildId, key);
  } else {
    stmt.setSetting.run(guildId, key, JSON.stringify(value));
  }
  settingsCache.delete(guildId);
  return value;
}

function setSettings(guildId, patch) {
  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (value === undefined || value === null) stmt.delSetting.run(guildId, key);
      else stmt.setSetting.run(guildId, key, JSON.stringify(value));
    }
  });
  tx(Object.entries(patch));
  settingsCache.delete(guildId);
}

function resetSettings(guildId) {
  db.prepare('DELETE FROM settings WHERE guild_id = ?').run(guildId);
  settingsCache.delete(guildId);
}

/* ── guild helpers ───────────────────────────────────────────────────── */

const prefixCache = new Map();

function getPrefix(guildId) {
  if (!guildId) return config.defaultPrefix;
  if (prefixCache.has(guildId)) return prefixCache.get(guildId);
  const row = stmt.guild.get(guildId);
  const prefix = row?.prefix || config.defaultPrefix;
  prefixCache.set(guildId, prefix);
  return prefix;
}

function setPrefix(guildId, prefix) {
  stmt.setPrefix.run(guildId, prefix);
  prefixCache.set(guildId, prefix);
}

function rememberGuild(guild) {
  stmt.upsertGuild.run(guild.id, guild.name, guild.icon ?? null);
}

/* ── moderation case helpers ─────────────────────────────────────────── */

function nextCaseNumber(guildId) {
  const row = db
    .prepare('SELECT COALESCE(MAX(case_number), 0) + 1 AS next FROM cases WHERE guild_id = ?')
    .get(guildId);
  return row.next;
}

function addCase({ guildId, type, userId, moderatorId, reason, duration = null, expiresAt = null }) {
  const caseNumber = nextCaseNumber(guildId);
  db.prepare(
    `INSERT INTO cases (guild_id, case_number, type, user_id, moderator_id, reason, duration, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(guildId, caseNumber, type, userId, moderatorId, reason ?? null, duration, expiresAt);
  return caseNumber;
}

module.exports = {
  db,
  getSetting,
  getSettings,
  setSetting,
  setSettings,
  resetSettings,
  getPrefix,
  setPrefix,
  rememberGuild,
  addCase,
  nextCaseNumber,
  invalidate: (guildId) => settingsCache.delete(guildId),
  prefixCache,
};
