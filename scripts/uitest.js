'use strict';

/**
 * Browser checks for the dashboard.
 *
 * Spins up the views with fake guild data, drives them with Playwright and
 * asserts the things a unit test cannot see: no horizontal overflow at phone
 * width, no JavaScript errors, and the settings UI actually staging and
 * saving changes.
 *
 * Playwright is optional — install it with `npm i -D playwright` (plus
 * `npx playwright install chromium`) and run `node scripts/uitest.js`.
 * Without it the script exits cleanly so CI does not break.
 */

process.env.DATABASE_PATH = process.env.DATABASE_PATH || './data/uitest.db';

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.log('Playwright is not installed — skipping browser checks.');
  console.log('  npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

const path = require('node:path');
const express = require('express');
const { SETTINGS, CATEGORIES, CATEGORY_META, defaultsFor } = require('../src/lib/settingsSchema');
const { VARIABLES } = require('../src/lib/variables');
const { Registry } = require('../src/lib/registry');
const config = require('../src/config');

const PORT = Number(process.env.UITEST_PORT || 3999);
const BASE = `http://127.0.0.1:${PORT}`;

const registry = new Registry().load();

const categories = CATEGORIES.map((name) => ({
  name,
  ...CATEGORY_META[name],
  settings: Object.entries(SETTINGS)
    .filter(([, meta]) => meta.category === name)
    .map(([key, meta]) => ({ key, ...meta })),
})).filter((category) => category.settings.length);

/* ── a server that renders the real views with fake data ─────────────── */

const FAKE_GUILD = {
  id: '1',
  name: 'Test Server',
  icon: null,
  memberCount: 12043,
  prefix: '.',
  channels: [
    { id: '100', name: 'general', type: 'text', parent: null },
    { id: '101', name: 'mod-logs', type: 'text', parent: null },
    { id: '102', name: 'Voice Chat', type: 'voice', parent: null },
    { id: '103', name: 'Tickets', type: 'category', parent: null },
  ],
  roles: [
    { id: '200', name: 'Admin', color: '#ff0000', assignable: false },
    { id: '201', name: 'Member', color: '#00ff00', assignable: true },
  ],
};

let lastSaved = null;

function buildServer() {
  const app = express();
  app.use(express.json());
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'src', 'web', 'views'));
  app.use('/static', express.static(path.join(__dirname, '..', 'src', 'web', 'public')));

  const base = {
    csrf: 'test-token',
    config,
    user: { username: 'tester', globalName: 'Tester', avatar: '' },
  };

  app.get('/', (request, response) =>
    response.render('index', {
      ...base,
      path: '/',
      title: 'Vex',
      stats: { guilds: 128, users: 94213, commands: registry.size },
    }),
  );

  app.get('/guide', (request, response) =>
    response.render('guide', {
      ...base,
      path: '/guide',
      title: 'Command guide',
      total: registry.size,
      prefix: '.',
      variables: VARIABLES,
      settingsCategories: categories,
      categories: [...registry.categories.entries()]
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
        })),
    }),
  );

  app.get('/dashboard', (request, response) =>
    response.render('servers', {
      ...base,
      path: '/dashboard',
      title: 'Your servers',
      inviteBase: 'https://discord.com/oauth2/authorize',
      guilds: [
        { id: '1', name: 'Test Server', icon: null, owner: true, present: true, memberCount: 12043 },
        { id: '2', name: 'A Server With A Deliberately Very Long Name', icon: null, owner: false, present: false, memberCount: null },
      ],
    }),
  );

  app.get('/dashboard/1', (request, response) =>
    response.render('guild', {
      ...base,
      path: '/dashboard/1',
      title: 'Test Server — dashboard',
      guild: FAKE_GUILD,
      prefix: '.',
      categories,
      variables: VARIABLES,
    }),
  );

  // Stubbed API.
  app.get('/api/guilds/1', (request, response) => response.json({ guild: FAKE_GUILD, settings: defaultsFor() }));
  app.get('/api/guilds/1/stats', (request, response) =>
    response.json({
      members: 12043, cases: 87, rankedMembers: 340, openTickets: 2, giveaways: 1, autoresponders: 1,
      levelRewards: [{ level: 5, role_id: '201' }],
      topMembers: [{ user_id: '9', name: 'ada', level: 42, xp: 91000, avatar: null }],
      recentCases: [{ case_number: 87, type: 'ban', user_id: '9', name: 'spammer', reason: 'spam', created_at: 1700000000 }],
    }),
  );
  app.get('/api/guilds/1/autoresponders', (request, response) =>
    response.json({ items: [{ id: 1, trigger: 'hello', response: 'hey there' }] }),
  );
  app.patch('/api/guilds/1/settings', (request, response) => {
    lastSaved = request.body;
    response.json({ saved: Object.keys(request.body), errors: {}, settings: { ...defaultsFor(), ...request.body } });
  });

  return app;
}

/* ── checks ──────────────────────────────────────────────────────────── */

let failures = 0;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const server = buildServer().listen(PORT);
  const browser = await chromium.launch();
  const errors = [];

  const newPage = async (width, height, scheme = 'dark') => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${width}px: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
        errors.push(`${width}px: ${message.text()}`);
      }
    });
    return { context, page };
  };

  /* layout: nothing may scroll sideways */
  console.log('\nlayout');
  for (const route of ['/', '/guide', '/dashboard', '/dashboard/1']) {
    for (const [label, width] of [['phone', 390], ['tablet', 768], ['desktop', 1280]]) {
      const { context, page } = await newPage(width, 900);
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${route} has no sideways scroll on ${label}`, overflow <= 1, `${overflow}px wider than the viewport`);
      await context.close();
    }
  }

  /* the settings UI */
  console.log('\nsettings UI');
  {
    const { context, page } = await newPage(1280, 1000);
    await page.goto(`${BASE}/dashboard/1`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const channels = await page.$$eval('#f-logs\\.channel option', (options) => options.map((o) => o.textContent.trim()));
    check('channel pickers are populated from the API', channels.includes('# mod-logs'));

    const roles = await page.$$eval('#f-moderation\\.muteRole option', (options) => options.map((o) => o.textContent.trim()));
    check('roles above the bot are flagged', roles.some((text) => text.includes('above the bot')));

    check('stats render', (await page.textContent('[data-stat="members"]')) === '12,043');

    await page.click('button[data-panel="levels"]');
    await page.waitForTimeout(150);
    check('level rewards are listed', (await page.$$('#level-rewards .row-item')).length === 1);

    await page.click('#f-levels\\.enabled');
    await page.waitForTimeout(200);
    check('changing a setting reveals the save bar', await page.$eval('#save-bar', (e) => e.classList.contains('is-visible')));
    check('the switch label follows the state', (await page.textContent('#f-levels\\.enabled ~ .state')).trim() === 'On');

    await page.click('button[data-panel="appearance"]');
    await page.fill('[data-color-text="embed.color"]', '#ff0066');
    await page.waitForTimeout(150);
    check('typing a hex drives the colour picker', (await page.inputValue('#f-embed\\.color')) === '#ff0066');

    await page.click('button[data-panel="levels"]');
    await page.selectOption('[data-adder-for="levels.ignoredChannels"]', '100');
    await page.click('[data-add="levels.ignoredChannels"]');
    await page.waitForTimeout(150);
    const chips = await page.$$eval('[data-chips="levels.ignoredChannels"] .chip', (c) => c.map((x) => x.textContent));
    check('list settings add chips', chips.length === 1 && chips[0].includes('#general'), JSON.stringify(chips));

    await page.click('[data-chips="levels.ignoredChannels"] .chip button');
    await page.waitForTimeout(150);
    check('chips can be removed', (await page.$$('[data-chips="levels.ignoredChannels"] .chip')).length === 0);

    await page.click('button[data-panel="welcome"]');
    await page.fill('#f-welcome\\.message', '');
    await page.click('[data-insert="welcome.message"][data-variable="{user.mention}"]');
    await page.waitForTimeout(150);
    check('variable chips insert into the editor', (await page.inputValue('#f-welcome\\.message')) === '{user.mention}');

    await page.click('#save-changes');
    await page.waitForTimeout(400);
    check(
      'saving posts every staged change at once',
      lastSaved?.['levels.enabled'] === true && lastSaved?.['embed.color'] === '#ff0066',
      JSON.stringify(lastSaved),
    );
    check('the save bar hides once saved', !(await page.$eval('#save-bar', (e) => e.classList.contains('is-visible'))));
    check('a toast confirms the save', /Saved \d+ change/.test(await page.textContent('.toast').catch(() => '')));

    await page.click('button[data-panel="levels"]');
    await page.fill('#f-levels\\.cooldown', '999');
    await page.waitForTimeout(150);
    await page.click('#discard-changes');
    await page.waitForTimeout(250);
    check('discarding restores the saved value', (await page.inputValue('#f-levels\\.cooldown')) === '60');

    await context.close();
  }

  /* the command guide */
  console.log('\ncommand guide');
  {
    const { context, page } = await newPage(1280, 900);
    await page.goto(`${BASE}/guide`, { waitUntil: 'domcontentloaded' });

    const total = (await page.$$('.cmd:not([hidden])')).length;
    check('every command is listed', total === registry.size, `${total} of ${registry.size}`);

    await page.fill('#cmd-search', 'ban');
    await page.waitForTimeout(250);
    const filtered = (await page.$$('.cmd:not([hidden])')).length;
    check('search narrows the list', filtered > 0 && filtered < total, `${filtered} of ${total}`);
    check('search says how many matched', /\d+ commands? match/.test(await page.textContent('#search-summary')));

    await page.fill('#cmd-search', 'zzzznothing');
    await page.waitForTimeout(250);
    check('an empty search explains itself', await page.$eval('#no-results', (e) => !e.hidden));

    await page.fill('#cmd-search', '');
    await page.waitForTimeout(250);
    check('clearing the search restores the list', (await page.$$('.cmd:not([hidden])')).length === total);

    await context.close();
  }

  /* mobile navigation */
  console.log('\nmobile navigation');
  {
    const { context, page } = await newPage(390, 844);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    await page.click('.nav-toggle');
    await page.waitForTimeout(400);
    check('the menu opens', await page.$eval('#site-nav', (e) => e.classList.contains('is-open')));
    check('the toggle reports its state', (await page.getAttribute('.nav-toggle', 'aria-expanded')) === 'true');

    await page.click('.nav-toggle');
    await page.waitForTimeout(400);
    check('the menu closes again', await page.$eval('#site-nav', (e) => !e.classList.contains('is-open')));

    await context.close();
  }

  await browser.close();
  server.close();

  if (errors.length) {
    failures += errors.length;
    console.log('\nJavaScript errors:');
    for (const error of [...new Set(errors)]) console.log(`  • ${error}`);
  } else {
    console.log('\nNo JavaScript errors on any page.');
  }

  if (failures) {
    console.log(`\n✗ ${failures} problem(s).\n`);
    process.exit(1);
  }
  console.log('\n✓ Dashboard looks and behaves correctly.\n');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
