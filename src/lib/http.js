'use strict';

const logger = require('./logger');

/**
 * Small wrapper around fetch for the commands that talk to third-party APIs.
 *
 * Everything here fails soft: a dead API returns null and the command tells
 * the user politely rather than throwing.
 */
async function fetchJson(url, { timeout = 8000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Vex Discord Bot', Accept: 'application/json', ...headers },
    });
    if (!response.ok) return { ok: false, status: response.status, data: null };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    logger.debug(`HTTP request failed for ${url}: ${error.message}`);
    return { ok: false, status: 0, data: null, error };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchJson };
