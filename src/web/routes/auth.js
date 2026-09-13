'use strict';

const crypto = require('node:crypto');
const express = require('express');
const config = require('../../config');
const logger = require('../../lib/logger');

const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';
const SCOPES = ['identify', 'guilds'];

function redirectUri() {
  return `${config.web.baseUrl}/auth/callback`;
}

/** Step one: bounce the user to Discord. */
router.get('/login', (request, response) => {
  if (!config.clientId || !config.clientSecret) {
    return response.status(503).render('error', {
      title: 'Login unavailable',
      code: 503,
      message: 'This bot has no OAuth2 credentials configured, so dashboard login is disabled.',
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  request.session.oauthState = state;
  request.session.returnTo = typeof request.query.next === 'string' && request.query.next.startsWith('/') ? request.query.next : '/dashboard';

  const url = new URL(`${DISCORD_API}/oauth2/authorize`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'none');

  return response.redirect(url.toString());
});

/** Step two: swap the code for a token and load the user. */
router.get('/callback', async (request, response) => {
  const { code, state, error: oauthError } = request.query;

  if (oauthError) {
    return response.status(400).render('error', {
      title: 'Login cancelled',
      code: 400,
      message: 'You declined the authorisation request.',
    });
  }

  // State must match what we issued, or this is a forged callback.
  if (!code || !state || state !== request.session.oauthState) {
    return response.status(400).render('error', {
      title: 'Login failed',
      code: 400,
      message: 'That login attempt could not be verified. Please try again.',
    });
  }
  delete request.session.oauthState;

  try {
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri(),
      }),
    });

    if (!tokenResponse.ok) throw new Error(`token exchange returned ${tokenResponse.status}`);
    const token = await tokenResponse.json();

    const [userResponse, guildsResponse] = await Promise.all([
      fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${token.access_token}` } }),
      fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${token.access_token}` } }),
    ]);

    if (!userResponse.ok) throw new Error(`user lookup returned ${userResponse.status}`);
    const user = await userResponse.json();
    const guilds = guildsResponse.ok ? await guildsResponse.json() : [];

    request.session.user = {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      discriminator: user.discriminator,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`,
    };

    // MANAGE_GUILD (0x20) is what we require to configure a server.
    request.session.guilds = guilds
      .filter((guild) => guild.owner || (BigInt(guild.permissions) & 0x20n) === 0x20n)
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null,
        owner: Boolean(guild.owner),
      }));

    const destination = request.session.returnTo ?? '/dashboard';
    delete request.session.returnTo;
    return response.redirect(destination);
  } catch (error) {
    logger.error('OAuth callback failed', error);
    return response.status(500).render('error', {
      title: 'Login failed',
      code: 500,
      message: 'Discord did not accept that login. Please try again in a moment.',
    });
  }
});

router.get('/logout', (request, response) => {
  request.session.destroy(() => response.redirect('/'));
});

module.exports = router;
