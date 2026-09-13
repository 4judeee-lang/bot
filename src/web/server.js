'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const config = require('../config');
const logger = require('../lib/logger');

/**
 * The dashboard. It runs inside the same process as the bot so it can read
 * live guild data (channels, roles, member counts) straight from the cache
 * rather than hammering Discord's API.
 */
function createApp(client) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);

  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(
    '/static',
    express.static(path.join(__dirname, 'public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    }),
  );

  app.use(
    session({
      name: 'vex.sid',
      secret: config.web.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.web.baseUrl.startsWith('https://'),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  // Basic security headers. No inline scripts are used, so the CSP can be tight.
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https://cdn.discordapp.com data:; " +
        "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    );
    next();
  });

  // One CSRF token per session, echoed back in a header by the front end.
  app.use((request, response, next) => {
    if (!request.session.csrf) request.session.csrf = crypto.randomBytes(24).toString('hex');
    response.locals.csrf = request.session.csrf;
    response.locals.user = request.session.user ?? null;
    response.locals.config = config;
    response.locals.bot = client;
    response.locals.path = request.path;
    next();
  });

  // `client` is a reserved EJS compile option, so the client is exposed as `bot`.
  app.locals.bot = client;

  app.use('/auth', require('./routes/auth'));
  app.use('/api', require('./routes/api'));
  app.use('/', require('./routes/pages'));

  app.use((request, response) => {
    response.status(404).render('error', {
      title: 'Not found',
      code: 404,
      message: 'That page does not exist.',
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, request, response, next) => {
    logger.error('Dashboard error', error);
    response.status(500).render('error', {
      title: 'Server error',
      code: 500,
      message: 'Something went wrong on our end.',
    });
  });

  return app;
}

function startServer(client) {
  return new Promise((resolve, reject) => {
    const app = createApp(client);
    const server = app.listen(config.web.port, () => {
      logger.web(`Dashboard listening on ${config.web.baseUrl} (port ${config.web.port})`);
      if (!config.clientSecret) {
        logger.warn('CLIENT_SECRET is not set — dashboard login will not work until it is');
      }
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = { createApp, startServer };
