# Vex

An all-in-one Discord bot — moderation, music, levels, economy, logging, automod, anti-nuke,
tickets, giveaways and more — with a web dashboard where **every** setting is a form field.

**286 commands · 112 settings · one process.**

---

## What it does

| Module | What you get |
| --- | --- |
| **Moderation** | ban / tempban / softban / hardban, kick, timeout, role-mute, jail, warn, purge (with filters), lock, lockdown, slowmode, nuke, mass-ban. Every action gets a numbered case, a mod-log entry and an optional DM to the member. Temporary punishments lift themselves. |
| **`strip`** | Pulls every role the bot can manage off a member — **always behind a confirmation**. Stripped roles are remembered so `restoreroles` can put them back exactly. `strip all` does the whole server (server owner only). |
| **Anti-nuke** | Watches for one person mass-deleting channels or roles, mass-banning/kicking, or spraying webhooks, and strips/kicks/bans them past a threshold. Whitelist the admins you trust. |
| **Anti-raid** | Reacts to join floods with a lockdown, kick or ban, and can screen joins by account age and avatar. |
| **Automod** | Invites, links, spam, caps, mass mentions, emoji spam and your own word list. Choose the punishment; exempt roles and channels bypass it. |
| **Logging** | Messages, members, roles, channels, voice and moderation — one channel, or five separate ones. |
| **Levels** | XP for chatting, leaderboards, voice-time tracking, and roles granted automatically at the levels you choose (stacking or replacing). |
| **Economy** | Cash and bank, daily streaks, work, crime, rob, pay, gambling, slots, and a shop that can grant roles. |
| **Music** | YouTube and Spotify links or plain search, a real queue, loop modes, volume, shuffle, skip-to, saved playlists, and an optional DJ role. |
| **Tickets** | Button-driven private support channels with claiming and transcripts. |
| **Giveaways** | Button entry with a live count, automatic drawing, reroll and cancel. |
| **VoiceMaster** | Join-to-create temporary voice channels, with lock/hide/claim buttons. |
| **Welcome / leave / boost** | Plain-text or embed messages with variables, plus autoroles and welcome DMs. |
| **Utility** | Snipe, edit-snipe, reaction-snipe, AFK, reminders, to-do lists, tags, highlights, autoresponders, sticky messages, polls, an embed builder, colour previews and a calculator. |
| **Fun** | 8-ball, dice, rock-paper-scissors, ship, rate, marry, reputation, guessing games and the rest. |
| **Information** | userinfo, serverinfo, roleinfo, channelinfo, avatar, banner, emoji info and stealing, invite tracking. |
| **Counters** | Voice channels whose name shows a live member/boost/role count, refreshed on a timer. |
| **Social** | Last.fm now-playing and top artists/tracks, weather, dictionary and Urban Dictionary lookups. |

Everything is per-server and everything can be switched off.

---

## Setup

### 1. Requirements

- **Node.js 20 or newer**
- A Discord application — <https://discord.com/developers/applications>

### 2. Install

```bash
git clone <this repo>
cd bot
npm install
cp .env.example .env
```

### 3. Fill in `.env`

At minimum:

```ini
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
```

For the dashboard, also set `CLIENT_SECRET`, a long random `SESSION_SECRET`, and `BASE_URL`.
Then add `<BASE_URL>/auth/callback` as a redirect URI under **OAuth2** in the Developer Portal.

### 4. Turn on the privileged intents

In the Developer Portal → **Bot**, enable:

- **Server Members Intent** — needed for welcome messages, autoroles, anti-raid and member logs
- **Message Content Intent** — needed for prefix commands, automod, levels and snipe

### 5. Invite the bot

Run `.invite` once it is online, or build the URL yourself. The bot asks only for the permissions
it actually uses — no Administrator shortcut.

### 6. Start it

```bash
npm start           # bot + dashboard
npm run bot         # bot only
npm run web         # dashboard only (front-end work; no Discord connection)
npm run deploy      # register slash commands globally
npm run deploy -- --dev   # register them instantly into DEV_GUILD_ID
```

---

## First five minutes in a new server

```
.prefix !            set your prefix
.help                browse every command
.logs #mod-logs      turn on logging
.welcome #general    greet new members
.levels setup        turn on XP
.antinuke enable     arm the anti-nuke (server owner)
.dashboard           get the link to configure the rest visually
```

---

## Commands

Every command is documented three ways, all generated from the same source so they cannot drift:

- **In Discord** — `.help <command>` explains what it does, every argument, permissions and examples
- **On the web** — `/guide`, searchable, with the full settings reference
- **In the repo** — [`docs/COMMANDS.md`](docs/COMMANDS.md), regenerate with `npm run docs`

Commands work as both prefix (`.ban`) and, where registered, slash commands (`/ban`).
Mentioning the bot always works as a prefix, so you cannot lock yourself out.

In usage lines, `<angle brackets>` are required and `[square brackets]` are optional.

---

## The dashboard

Sign in with Discord and pick any server where you have **Manage Server**.

- Every one of the 112 settings is rendered from a single schema — a toggle, a channel picker,
  a role picker, a colour picker or a number, whichever fits
- Message templates get a **live preview** that runs the same renderer the bot uses, so what you
  see is exactly what gets posted
- Changes are staged and saved in one batch, with a save bar that will not let you leave silently
- Works properly on a phone — the sidebar becomes a scrollable row and the save bar spans the screen
- Follows your system light/dark preference

Adding a new setting to the whole system is one entry in `src/lib/settingsSchema.js`: the bot reads
it, the dashboard renders it, the docs describe it and the validator checks it.

---

## Message variables

Welcome, leave, boost, level-up, autoresponder, ticket and sticky messages all support variables:

```
Welcome {user.mention} to {guild.name} — you are member #{guild.count}!
```

For an embed, start with `{embed}` and separate the parts with `$v`:

```
{embed}{color: #8b5cf6}$v{title: Welcome!}$v{description: Hi {user.mention}}$v{thumbnail: {user.avatar}}
```

Run `.variables` for the full list, or see the guide.

---

## Project layout

```
src/
├── index.js              entry point
├── config.js             environment configuration
├── bot/client.js         discord.js client, command + event loading
├── commands/             every command, grouped by category
├── events/               gateway event handlers
├── modules/              feature logic (levels, automod, music, tickets, …)
├── lib/                  framework: registry, dispatcher, context, embeds, db
└── web/                  dashboard (express + ejs, no build step)
scripts/
├── validate.js           checks every command before the bot runs
├── selftest.js           63 checks over the logic that needs no Discord
├── uitest.js             34 browser checks over the dashboard
├── deploy-commands.js    slash command registration
└── generate-docs.js      writes docs/COMMANDS.md
```

### Writing a command

Commands declare what they need and the framework does the rest — argument parsing, permission
checks, cooldowns, prefix/slash handling and error reporting:

```js
module.exports = {
  name: 'greet',
  category: 'Fun',
  description: 'Say hello to someone.',
  usage: '<member> [message]',
  examples: ['greet @friend', 'greet @friend good morning'],
  permissions: ['SendMessages'],
  args: [
    { name: 'member', type: 'member', required: true, description: 'who to greet' },
    { name: 'message', type: 'rest', required: false, default: 'hello!', description: 'what to say' },
  ],
  slash: true,
  async run(ctx) {
    return ctx.success(`${ctx.args.member}, ${ctx.args.message}`);
  },
};
```

Argument types: `string` `rest` `number` `integer` `boolean` `duration` `user` `member` `role`
`channel` `textchannel` `voicechannel` `category` `emoji` `choice`.

`ctx` gives you `success` / `error` / `warn` / `info` / `embed` / `send`, plus `ctx.confirm()` for
destructive actions and `ctx.paginateRows()` for lists. Run `npm test` and the validator will catch
a malformed command before Discord ever sees it.

---

## Testing

```bash
npm test        # validate every command, then 63 logic + end-to-end checks
npm run check   # command validation only
npm run test:ui # 34 browser checks against the dashboard (needs Playwright)
```

`npm test` covers duration parsing, the XP curve, template rendering, settings validation, economy
maths, command resolution, argument parsing (including the awkward optional-duration case), the
slash payload limits, and running real commands through the dispatcher against a mocked Discord.

`npm run test:ui` drives the real pages in Chromium: it asserts that nothing scrolls sideways at
390px, 768px and 1280px, that no page throws a JavaScript error, and that the settings UI actually
populates its pickers, stages edits, saves them in one batch and discards them again. It needs
Playwright, which is not a dependency — install it with `npm i -D playwright && npx playwright
install chromium`. Without it the script exits cleanly rather than failing.

These browser checks earned their keep: they caught a grid `min-width` bug that made the dashboard
scroll sideways on a phone, a `padding` shorthand that silently removed the page's side gutters, and
a toggle switch whose own track was swallowing clicks.

---

## Notes

- **Storage** is SQLite (`data/vex.db`) — nothing external to run. Back up that one file.
- **Music** uses `play-dl`. YouTube occasionally tightens its extraction; if playback stops working,
  update that package first. The bot degrades gracefully and says so rather than failing silently.
- **Privacy** — deleted-message snipes live in memory only, expire after an hour, and can be turned
  off per server or per channel.

## Licence

MIT.
