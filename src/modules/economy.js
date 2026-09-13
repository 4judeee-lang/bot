'use strict';

const store = require('../lib/db');
const { randomInt, now } = require('../lib/util');

const DAY = 86_400;

function symbol(guildId) {
  return store.getSetting(guildId, 'economy.symbol') ?? '💵';
}

function currencyName(guildId) {
  return store.getSetting(guildId, 'economy.currencyName') ?? 'coins';
}

/** Format an amount the way this server likes to see it. */
function money(guildId, amount) {
  return `${symbol(guildId)} **${Number(amount || 0).toLocaleString('en-US')}**`;
}

function account(guildId, userId) {
  const row = store.db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (row) return row;

  const starting = store.getSetting(guildId, 'economy.startingBalance') ?? 100;
  store.db.prepare('INSERT INTO economy (guild_id, user_id, cash) VALUES (?, ?, ?)').run(guildId, userId, starting);
  return store.db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function balance(guildId, userId) {
  const row = account(guildId, userId);
  return { cash: row.cash, bank: row.bank, total: row.cash + row.bank };
}

function addCash(guildId, userId, amount) {
  account(guildId, userId);
  store.db.prepare('UPDATE economy SET cash = MAX(0, cash + ?) WHERE guild_id = ? AND user_id = ?').run(Math.round(amount), guildId, userId);
  return balance(guildId, userId);
}

function transfer(guildId, fromId, toId, amount) {
  const from = balance(guildId, fromId);
  if (from.cash < amount) return { ok: false, reason: 'not enough cash on hand' };
  const tx = store.db.transaction(() => {
    addCash(guildId, fromId, -amount);
    addCash(guildId, toId, amount);
  });
  tx();
  return { ok: true };
}

function deposit(guildId, userId, amount) {
  const row = account(guildId, userId);
  const value = amount === 'all' ? row.cash : Math.min(row.cash, Math.round(amount));
  if (value <= 0) return { ok: false, reason: 'nothing to deposit' };
  store.db.prepare('UPDATE economy SET cash = cash - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?').run(value, value, guildId, userId);
  return { ok: true, amount: value };
}

function withdraw(guildId, userId, amount) {
  const row = account(guildId, userId);
  const value = amount === 'all' ? row.bank : Math.min(row.bank, Math.round(amount));
  if (value <= 0) return { ok: false, reason: 'nothing to withdraw' };
  store.db.prepare('UPDATE economy SET cash = cash + ?, bank = bank - ? WHERE guild_id = ? AND user_id = ?').run(value, value, guildId, userId);
  return { ok: true, amount: value };
}

/** Shared cooldown helper for daily/work/crime/rob. */
function cooldown(guildId, userId, column, seconds) {
  const row = account(guildId, userId);
  const last = row[column] ?? 0;
  const remaining = last + seconds - now();
  return { ready: remaining <= 0, remaining: Math.max(0, remaining) };
}

function touch(guildId, userId, column) {
  store.db.prepare(`UPDATE economy SET ${column} = ? WHERE guild_id = ? AND user_id = ?`).run(now(), guildId, userId);
}

function daily(guildId, userId) {
  const gate = cooldown(guildId, userId, 'last_daily', DAY);
  if (!gate.ready) return { ok: false, remaining: gate.remaining };

  const row = account(guildId, userId);
  const base = store.getSetting(guildId, 'economy.dailyAmount') ?? 500;
  // Claiming on consecutive days builds a streak worth up to +100%.
  const continued = now() - (row.last_daily ?? 0) < DAY * 2;
  const streak = continued ? (row.streak ?? 0) + 1 : 1;
  const bonus = Math.min(streak * 0.1, 1);
  const amount = Math.round(base * (1 + bonus));

  store.db.prepare('UPDATE economy SET streak = ? WHERE guild_id = ? AND user_id = ?').run(streak, guildId, userId);
  addCash(guildId, userId, amount);
  touch(guildId, userId, 'last_daily');
  return { ok: true, amount, streak, bonus: Math.round(bonus * 100) };
}

const WORK_JOBS = [
  'delivered pizzas', 'walked dogs', 'streamed for 6 hours', 'fixed a production outage',
  'mowed lawns', 'sold digital art', 'wrote a cursed regex', 'moderated a huge server',
  'flipped sneakers', 'tutored maths', 'made coffee for an entire office', 'tested a video game',
];

function work(guildId, userId) {
  const gate = cooldown(guildId, userId, 'last_work', 3600);
  if (!gate.ready) return { ok: false, remaining: gate.remaining };
  const amount = randomInt(100, 600);
  addCash(guildId, userId, amount);
  touch(guildId, userId, 'last_work');
  return { ok: true, amount, job: WORK_JOBS[randomInt(0, WORK_JOBS.length - 1)] };
}

function crime(guildId, userId) {
  const gate = cooldown(guildId, userId, 'last_crime', 7200);
  if (!gate.ready) return { ok: false, remaining: gate.remaining };
  touch(guildId, userId, 'last_crime');

  const success = Math.random() < 0.55;
  const amount = randomInt(200, 1500);
  if (success) {
    addCash(guildId, userId, amount);
    return { ok: true, success: true, amount };
  }
  const fine = Math.min(balance(guildId, userId).cash, amount);
  addCash(guildId, userId, -fine);
  return { ok: true, success: false, amount: fine };
}

function rob(guildId, robberId, targetId) {
  const gate = cooldown(guildId, robberId, 'last_rob', 7200);
  if (!gate.ready) return { ok: false, remaining: gate.remaining };

  const target = balance(guildId, targetId);
  if (target.cash < 100) return { ok: false, reason: 'they have nothing worth taking' };
  touch(guildId, robberId, 'last_rob');

  if (Math.random() < 0.45) {
    const stolen = randomInt(Math.floor(target.cash * 0.1), Math.floor(target.cash * 0.4));
    addCash(guildId, targetId, -stolen);
    addCash(guildId, robberId, stolen);
    return { ok: true, success: true, amount: stolen };
  }

  const fine = Math.min(balance(guildId, robberId).cash, randomInt(100, 500));
  addCash(guildId, robberId, -fine);
  return { ok: true, success: false, amount: fine };
}

function leaderboard(guildId, limit = 100) {
  return store.db
    .prepare('SELECT *, (cash + bank) AS net FROM economy WHERE guild_id = ? ORDER BY net DESC LIMIT ?')
    .all(guildId, limit);
}

/* ── shop ────────────────────────────────────────────────────────────── */

function items(guildId) {
  return store.db.prepare('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC').all(guildId);
}

function addItem(guildId, { name, price, description, roleId = null, stock = -1 }) {
  const info = store.db
    .prepare('INSERT INTO shop_items (guild_id, name, price, description, role_id, stock) VALUES (?, ?, ?, ?, ?, ?)')
    .run(guildId, name, price, description ?? null, roleId, stock);
  return info.lastInsertRowid;
}

function removeItem(guildId, id) {
  return store.db.prepare('DELETE FROM shop_items WHERE guild_id = ? AND id = ?').run(guildId, id).changes > 0;
}

function buy(guildId, userId, itemId) {
  const item = store.db.prepare('SELECT * FROM shop_items WHERE guild_id = ? AND id = ?').get(guildId, itemId);
  if (!item) return { ok: false, reason: 'that item does not exist' };
  if (item.stock === 0) return { ok: false, reason: 'that item is out of stock' };

  const wallet = balance(guildId, userId);
  if (wallet.cash < item.price) return { ok: false, reason: 'you cannot afford that' };

  const tx = store.db.transaction(() => {
    addCash(guildId, userId, -item.price);
    store.db
      .prepare(
        `INSERT INTO inventory (guild_id, user_id, item_id, amount) VALUES (?, ?, ?, 1)
         ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET amount = amount + 1`,
      )
      .run(guildId, userId, item.id);
    if (item.stock > 0) store.db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ?').run(item.id);
  });
  tx();

  return { ok: true, item };
}

function inventory(guildId, userId) {
  return store.db
    .prepare(
      `SELECT shop_items.*, inventory.amount FROM inventory
       JOIN shop_items ON shop_items.id = inventory.item_id
       WHERE inventory.guild_id = ? AND inventory.user_id = ?`,
    )
    .all(guildId, userId);
}

module.exports = {
  symbol,
  currencyName,
  money,
  account,
  balance,
  addCash,
  transfer,
  deposit,
  withdraw,
  daily,
  work,
  crime,
  rob,
  cooldown,
  leaderboard,
  items,
  addItem,
  removeItem,
  buy,
  inventory,
};
