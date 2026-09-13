# Running Vex on a Mac

A complete walkthrough, from a Mac with nothing installed to a bot online in your server.
Allow about 20 minutes the first time.

Everything in a grey box is a command to paste into **Terminal**
(press `⌘ + Space`, type `Terminal`, press Enter).

---

## Step 1 — Install Node.js

Vex needs **Node.js 20 or newer**. Check whether you already have it:

```bash
node -v
```

If that prints something like `v22.11.0`, skip to step 2. If it says *command not found*, or the
number is lower than 20, install it:

**Easiest way — the official installer**

1. Go to <https://nodejs.org>
2. Download the **LTS** version
3. Open the `.pkg` file and click through the installer
4. **Quit Terminal completely (`⌘ + Q`) and reopen it**, then run `node -v` again

**Or with Homebrew**, if you already use it:

```bash
brew install node
```

If you do not have Homebrew and want it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

At the end it prints two `echo ... >> ~/.zprofile` commands — run them, or Homebrew will not be on
your PATH. Then `brew install node`.

## Step 2 — Install the Xcode command line tools

These give you `git`, and the compiler that one of the dependencies may need:

```bash
xcode-select --install
```

A window pops up — click **Install** and wait. If it says *already installed*, you are fine.

## Step 3 — Download the code

Two ways. **The ZIP is simpler**; git is better if you want `git pull` to fetch updates later.

### Option A — download the ZIP (simplest)

1. Open <https://github.com/4judeee-lang/bot/tree/claude/focused-newton-wshk0g> and sign in
2. Click the green **Code** button → **Download ZIP**
   (or go straight there:
   <https://github.com/4judeee-lang/bot/archive/refs/heads/claude/focused-newton-wshk0g.zip>)
3. Double-click the file in **Downloads** — macOS unzips it into a folder beside it
4. Rename that folder to `vex`, drag it into **Documents**, then in Terminal:

```bash
cd ~/Documents/vex
ls
```

`ls` should list `package.json`, `src`, `scripts` and `docs`. If it says *No such file or
directory*, the folder is somewhere else — drag the folder onto the Terminal window after typing
`cd ` (with the space) and it fills in the path for you.

> The ZIP has no git history, so `git pull` will not work later. To update, download a fresh ZIP and
> copy your `.env` file and the `data/` folder across — those hold your settings and all your
> server's data.

### Option B — clone with git (keeps updates easy)

```bash
cd ~/Documents
git clone https://github.com/4judeee-lang/bot.git vex
cd vex
git checkout claude/focused-newton-wshk0g
```

The repo is private, so git asks for your GitHub login. If it asks for a **password**, GitHub no
longer accepts your account password — you need a token:

1. <https://github.com/settings/tokens> → **Generate new token (classic)**
2. Tick the **repo** scope, generate it, copy it
3. Paste that token when git asks for the password

## Step 4 — Install the dependencies

Make sure you are in the project folder first (`cd ~/Documents/vex`), then:

```bash
npm install
```

This takes a minute or two and prints a lot. As long as the last lines do not say `ERR!`, it worked.

Optional but recommended — `ffmpeg` makes music playback work with more sources:

```bash
brew install ffmpeg
```

## Step 5 — Create your bot on Discord

1. Go to <https://discord.com/developers/applications> and sign in
2. Click **New Application**, give it a name (this is your bot's name), click **Create**
3. In the left sidebar click **Bot**
4. Click **Reset Token** → **Yes, do it** → **Copy**. **Keep this tab open** — you need this token in
   a moment, and Discord will not show it again
5. Scroll down to **Privileged Gateway Intents** and turn **on**:
   - **Server Members Intent** — welcome messages, autoroles, anti-raid, member logs
   - **Message Content Intent** — prefix commands, automod, levels, snipe
   - Click **Save Changes** at the bottom
6. In the left sidebar click **OAuth2**:
   - Copy the **Client ID**
   - Under **Client Secret** click **Reset Secret** → copy it
   - Under **Redirects** click **Add Redirect**, paste exactly:
     ```
     http://localhost:3000/auth/callback
     ```
     then **Save Changes**

## Step 6 — Get your own Discord user ID

This makes you the bot's owner, which unlocks the owner-only commands.

1. In Discord: **Settings** (cog, bottom left) → **Advanced** → turn on **Developer Mode**
2. Right-click your own name anywhere → **Copy User ID**

## Step 7 — Fill in the settings file

Make your own copy of the example settings:

```bash
cp .env.example .env
```

Generate a random secret for the dashboard login and copy it:

```bash
openssl rand -hex 32
```

Now open the file in TextEdit:

```bash
open -e .env
```

Fill in these five lines with what you collected — no quotes, no spaces around the `=`:

```ini
DISCORD_TOKEN=the-bot-token-from-step-5
CLIENT_ID=the-client-id-from-step-5
CLIENT_SECRET=the-client-secret-from-step-5
SESSION_SECRET=the-random-string-you-just-generated
OWNER_IDS=your-user-id-from-step-6
```

Save with `⌘ + S` and close the window.

> Never share this file or post its contents anywhere. If the token leaks, go back to the Developer
> Portal and hit **Reset Token**.

## Step 8 — Start it

```bash
npm start
```

You should see the Vex banner, then:

```
ready  Logged in as YourBot#1234
info   Serving 0 guild(s) ...
web    Dashboard listening on http://localhost:3000
```

**Leave this Terminal window open.** The bot runs for as long as it is open. `Control + C` stops it.

## Step 9 — Add the bot to your server

Open a **second** Terminal tab (`⌘ + T`) — do not close the first one — and print your invite link:

```bash
cd ~/Documents/vex
npm run invite
```

It prints a link and the exact list of permissions it will ask for. Copy the link, paste it into
your browser, choose your server, and click **Authorise**. You need **Manage Server** in that
server to add a bot.

Back in Discord, type in any channel:

```
.help
```

If the bot replies, you are done. 🎉

## Step 10 — Turn on slash commands (optional)

Prefix commands (`.ban`) work immediately. To also get `/ban`:

```bash
npm run deploy
```

Global commands can take up to an hour to appear in Discord. For instant results while you are
setting things up, put your server's ID in `.env` as `DEV_GUILD_ID=` (right-click your server icon →
Copy Server ID) and run:

```bash
npm run deploy -- --dev
```

## Step 11 — Open the dashboard

While the bot is running, visit:

```
http://localhost:3000
```

Click **Sign in**, authorise, and pick your server. Every setting — level channels, embed colours,
welcome messages, automod, logging — is a form field there.

---

## Day-to-day use

| What you want | What to do |
| --- | --- |
| Start the bot | `cd ~/Documents/vex` then `npm start` |
| Stop the bot | Click the Terminal window, press `Control + C` |
| Update to the newest code | `cd ~/Documents/vex && git pull && npm install` (git install only — with the ZIP, download a fresh one and copy your `.env` and `data/` across) |
| See what broke | The Terminal window prints every error as it happens |

### Stop the Mac sleeping and killing the bot

A closed lid or a sleeping Mac stops the bot. To keep it awake while it runs, start it like this
instead:

```bash
caffeinate -i npm start
```

That keeps the Mac awake until you press `Control + C`. (With the lid closed it still sleeps unless
the Mac is plugged into power and an external display — a laptop is not a great permanent host.
For a bot that is up 24/7, put it on a cheap VPS or a Raspberry Pi later.)

### Keep it running in the background

If you would rather not keep a Terminal window open:

```bash
npm install -g pm2
cd ~/Documents/vex
pm2 start src/index.js --name vex
pm2 logs vex        # watch the output
pm2 restart vex     # after updating the code
pm2 stop vex        # stop it
```

---

## When something goes wrong

**`command not found: node`**
Node is not installed, or you did not reopen Terminal after installing it. Quit Terminal with
`⌘ + Q`, reopen, try `node -v` again.

**`command not found: npm start`** or `Could not read package.json`
You are in the wrong folder. Run `cd ~/Documents/vex` first. `pwd` tells you where you are.

**`Error: Cannot find module 'discord.js'`**
`npm install` did not finish. Run it again in the project folder.

**`DISCORD_TOKEN is not set`**
The `.env` file is missing or the token line is empty. Check with `cat .env`. Make sure the file is
called exactly `.env` — TextEdit sometimes saves it as `.env.txt`. Fix that with:
```bash
mv .env.txt .env
```

**`Used disallowed intents`**
Step 5.5 was missed. Go back to the Developer Portal → **Bot** → turn on both privileged intents →
**Save Changes**, then restart the bot.

**The bot is online but ignores `.help`**
Message Content Intent is off (see above), or the bot cannot see/send in that channel. Check the
channel's permissions. Mentioning the bot always works: `@YourBot` replies with the current prefix.

**`EADDRINUSE: address already in use :::3000`**
Something else is on port 3000 — often a second copy of the bot. Either close the other Terminal
window, or change `WEB_PORT=3001` in `.env` (and update `BASE_URL` and the Discord redirect URI to
match).

**Dashboard login fails with "could not be verified"**
The redirect URI in the Developer Portal must match `BASE_URL` exactly, including `http://` and the
port: `http://localhost:3000/auth/callback`.

**Music joins but plays nothing**
Install ffmpeg (`brew install ffmpeg`) and restart. If it still fails, YouTube has likely changed
its extraction again — update the library with `npm i play-dl@latest`.

**`better-sqlite3` fails to build during `npm install`**
Run `xcode-select --install` (step 2), then `npm install` again.

---

## Checking everything works without Discord

These run offline and need no token:

```bash
npm test        # validates every command, then 63 logic checks
npm run web     # dashboard on its own at http://localhost:3000
npm run docs    # regenerates docs/COMMANDS.md
```
