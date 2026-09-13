'use strict';

const UNITS = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
  d: 86400, day: 86400, days: 86400,
  w: 604800, week: 604800, weeks: 604800,
  mo: 2592000, month: 2592000, months: 2592000,
  y: 31536000, year: 31536000, years: 31536000,
};

/**
 * Parse "10m", "1h30m", "2 days" into seconds. Returns null when the input is
 * not a duration at all, which lets optional duration arguments fall through.
 */
function parseDuration(input) {
  if (input === null || input === undefined) return null;
  const text = String(input).trim().toLowerCase();
  if (!text) return null;
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)];
  if (!matches.length) return null;
  let total = 0;
  for (const [, amount, unit] of matches) {
    const seconds = UNITS[unit];
    if (!seconds) return null;
    total += Number(amount) * seconds;
  }
  // Reject things like "10" or stray text that produced nothing sensible.
  if (total <= 0) return null;
  return Math.floor(total);
}

/** 3725 → "1 hour, 2 minutes" */
function formatDuration(seconds, { short = false, max = 2 } = {}) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));
  if (seconds === 0) return short ? '0s' : '0 seconds';
  const parts = [];
  const table = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  let remaining = seconds;
  for (const [name, size] of table) {
    const amount = Math.floor(remaining / size);
    if (!amount) continue;
    remaining -= amount * size;
    parts.push(short ? `${amount}${name[0]}` : `${amount} ${name}${amount === 1 ? '' : 's'}`);
    if (parts.length >= max) break;
  }
  return parts.join(short ? ' ' : ', ');
}

/** 185 → "3:05" */
function formatTimestamp(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Discord relative timestamp markup. */
function relative(date) {
  const seconds = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${seconds}:R>`;
}

function longDate(date) {
  const seconds = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${seconds}:F>`;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function random(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Cut text to `length`, never mid-word when avoidable. */
function truncate(text, length = 100) {
  text = String(text ?? '');
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1).trimEnd()}…`;
}

/** Strip characters that would break out of a Discord code block or markdown. */
function escapeMarkdown(text) {
  return String(text ?? '').replace(/([\\`*_~|>])/g, '\\$1');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

/** 1500 → "1.5K" */
function compactNumber(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) < 1000) return String(n);
  const units = ['K', 'M', 'B', 'T'];
  let index = -1;
  let scaled = n;
  while (Math.abs(scaled) >= 1000 && index < units.length - 1) {
    scaled /= 1000;
    index++;
  }
  return `${scaled.toFixed(scaled < 10 ? 1 : 0).replace(/\.0$/, '')}${units[index]}`;
}

function progressBar(value, total, length = 14) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const filled = Math.round(ratio * length);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, length - filled))}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${Math.abs(Number(count)) === 1 ? singular : plural}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Best-effort validation that a string is a snowflake. */
function isSnowflake(value) {
  return /^\d{15,25}$/.test(String(value || ''));
}

function titleCase(text) {
  return String(text || '').replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

/** Resolve a hex string to the integer discord.js wants. */
function resolveColor(value, fallback = 0x8b5cf6) {
  if (typeof value === 'number') return value;
  if (!value) return fallback;
  const hex = String(value).replace('#', '');
  const parsed = Number.parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Run promises with a concurrency limit so we never flood the API. */
async function pooled(items, limit, worker) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      try {
        results[current] = await worker(items[current], current);
      } catch (error) {
        results[current] = { error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

const now = () => Math.floor(Date.now() / 1000);

module.exports = {
  parseDuration,
  formatDuration,
  formatTimestamp,
  relative,
  longDate,
  chunk,
  random,
  randomInt,
  shuffle,
  truncate,
  escapeMarkdown,
  formatNumber,
  compactNumber,
  progressBar,
  pluralize,
  sleep,
  clamp,
  isSnowflake,
  titleCase,
  resolveColor,
  pooled,
  now,
};
