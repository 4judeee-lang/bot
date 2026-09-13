# Command guide

Every command, what it does, and how to use it. **286** commands in total.

The default prefix is `.`; change it with `.prefix <new>`. Mentioning the bot always works too.

In the usage lines, `<angle brackets>` are required and `[square brackets]` are optional.

## Contents

- [Configuration](#configuration) — 48 commands
- [Economy](#economy) — 19 commands
- [Fun](#fun) — 27 commands
- [General](#general) — 3 commands
- [Giveaways](#giveaways) — 5 commands
- [Information](#information) — 16 commands
- [Levels](#levels) — 10 commands
- [Moderation](#moderation) — 57 commands
- [Music](#music) — 23 commands
- [Owner](#owner) — 9 commands
- [Roles](#roles) — 22 commands
- [Social](#social) — 6 commands
- [Tickets](#tickets) — 5 commands
- [Utility](#utility) — 34 commands
- [Voice](#voice) — 2 commands
- [Settings reference](#settings-reference)
- [Message variables](#message-variables)

## Configuration

### `.alias`

Server aliases work exactly like the real command. Use `alias remove <name>` to delete one.

**Usage:** `.alias <alias> <command>`

| Argument | Required | What it is |
| --- | --- | --- |
| `alias` | yes | the new name, or `remove` |
| `command` | yes | the command it points at |

**Examples:**

```
.alias yeet ban
.alias remove yeet
```

> You need: `ManageGuild`

### `.aliases`

List this server’s custom command aliases.

**Usage:** `.aliases`

**Examples:**

```
.aliases
```

### `.antinuke`

Antinuke watches for a single person doing something destructive over and over — mass channel or role deletions, mass bans or kicks, webhook spam — and punishes them once they cross the threshold inside a minute. Whitelist people you trust so they are never caught by it.

**Usage:** `.antinuke`

**Examples:**

```
.antinuke
```

> You need: `Administrator`

### `.antinuke disable`

Disarm the antinuke.

**Usage:** `.antinuke disable`

**Examples:**

```
.antinuke disable
```

> You need: `Administrator` · Server owner only

### `.antinuke enable`

Arm the antinuke.

**Usage:** `.antinuke enable`

**Examples:**

```
.antinuke enable
```

> You need: `Administrator` · Server owner only

### `.antinuke unwhitelist`

Remove someone from the antinuke whitelist.

**Usage:** `.antinuke unwhitelist <user>`

| Argument | Required | What it is |
| --- | --- | --- |
| `user` | yes | who to remove |

**Examples:**

```
.antinuke unwhitelist @admin
```

> You need: `Administrator` · Server owner only

### `.antinuke whitelist`

Let someone bypass the antinuke.

**Usage:** `.antinuke whitelist <user>`

| Argument | Required | What it is |
| --- | --- | --- |
| `user` | yes | who to trust |

**Examples:**

```
.antinuke whitelist @admin
```

> You need: `Administrator` · Server owner only

### `.antiraid`

Antiraid reacts to floods of joins — it can lock the server down, or kick/ban the wave. It can also screen every join by account age and avatar.

**Usage:** `.antiraid`

**Examples:**

```
.antiraid
```

> You need: `ManageGuild`

### `.antiraid disable`

Disarm the antiraid.

**Usage:** `.antiraid disable`

**Examples:**

```
.antiraid disable
```

> You need: `ManageGuild`

### `.antiraid enable`

Arm the antiraid.

**Usage:** `.antiraid enable`

**Examples:**

```
.antiraid enable
```

> You need: `ManageGuild`

### `.automod`

Toggle individual filters with `{prefix}automod <filter> <on|off>`.

**Usage:** `.automod`

**Examples:**

```
.automod
```

> You need: `ManageGuild`

### `.automod caps`

Turn the excessive-caps filter on or off.

**Usage:** `.automod caps <on|off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `state` | yes | on or off |

**Examples:**

```
.automod caps on
```

> You need: `ManageGuild`

### `.automod disable`

Turn automod off entirely.

**Usage:** `.automod disable`

**Examples:**

```
.automod disable
```

> You need: `ManageGuild`

### `.automod enable`

Turn the automod master switch on.

**Usage:** `.automod enable`

**Examples:**

```
.automod enable
```

> You need: `ManageGuild`

### `.automod invites`

Block or allow Discord invite links.

**Usage:** `.automod invites <on|off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `state` | yes | on or off |

**Examples:**

```
.automod invites on
```

> You need: `ManageGuild`

### `.automod links`

Block or allow all links.

**Usage:** `.automod links <on|off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `state` | yes | on or off |

**Examples:**

```
.automod links on
```

> You need: `ManageGuild`

### `.automod spam`

Turn the anti-spam filter on or off.

**Usage:** `.automod spam <on|off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `state` | yes | on or off |

**Examples:**

```
.automod spam on
```

> You need: `ManageGuild`

### `.automod word add`

Add a word to the blocked list.

**Usage:** `.automod word add <word>`

**Aliases:** `.filter add`

| Argument | Required | What it is |
| --- | --- | --- |
| `word` | yes | the word or phrase to block |

**Examples:**

```
.automod word add badword
```

> You need: `ManageGuild`

### `.automod word remove`

Remove a word from the blocked list.

**Usage:** `.automod word remove <word>`

**Aliases:** `.filter remove`

| Argument | Required | What it is |
| --- | --- | --- |
| `word` | yes | the word to unblock |

**Examples:**

```
.automod word remove badword
```

> You need: `ManageGuild`

### `.automod words`

Show the blocked word list.

**Usage:** `.automod words`

**Examples:**

```
.automod words
```

> You need: `ManageGuild`

### `.boost`

Set the channel where boosts are celebrated.

**Usage:** `.boost <channel>`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel to post in |

**Examples:**

```
.boost #general
```

> You need: `ManageGuild`

### `.boost message`

Set the boost thank-you message.

**Usage:** `.boost message <message>`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the message, or `preview` to see the current one |

**Examples:**

```
.boost message thanks {user.mention} 💜
```

> You need: `ManageGuild`

### `.config`

Run on its own to see the categories. Pass a category to see its settings and their current values. Change one with `{prefix}set <key> <value>`, or use the website where everything is a form field.

**Usage:** `.config [category]`

**Aliases:** `.settings`, `.cfg`

| Argument | Required | What it is |
| --- | --- | --- |
| `category` | no | which category to open |

**Examples:**

```
.config
.config levels
.config automod
```

> You need: `ManageGuild`

### `.counter add`

The channel name is rewritten to show the number. Use one of these placeholders in the template: `{members}` `{humans}` `{bots}` `{boosts}` `{channels}` `{roles}`.

Discord only allows a channel to be renamed twice every ten minutes, so counters refresh on a ten-minute timer rather than instantly. Locking the channel so nobody can join it is a good idea.

**Usage:** `.counter add <channel> <template>`

**Aliases:** `.statschannel add`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel to rename |
| `template` | yes | the name, containing a placeholder |

**Examples:**

```
.counter add "Member Count" Members: {members}
.counter add #stats {humans} humans
```

> You need: `ManageGuild` · Bot needs: `ManageChannels`

### `.counter create`

The quick way to get a counter: makes the channel, locks it so nobody can join, and sets it up.

**Usage:** `.counter create [template]`

| Argument | Required | What it is |
| --- | --- | --- |
| `template` | no | the name template |

**Examples:**

```
.counter create
.counter create Members: {members}
```

> You need: `ManageGuild` · Bot needs: `ManageChannels`

### `.counter list`

Show the counter channels in this server.

**Usage:** `.counter list`

**Aliases:** `.counters`

**Examples:**

```
.counter list
```

> You need: `ManageGuild`

### `.counter remove`

Stop a channel being a counter (the name stays as it is).

**Usage:** `.counter remove <channel>`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the counter channel |

**Examples:**

```
.counter remove #stats
```

> You need: `ManageGuild`

### `.dashboard`

Get the link to this server’s dashboard.

**Usage:** `.dashboard`

**Aliases:** `.panel`, `.website`

**Examples:**

```
.dashboard
```

### `.disable`

Disable a command in this server, or in one channel.

**Usage:** `.disable <command> [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `command` | yes | command to disable |
| `channel` | no | only in this channel |

**Examples:**

```
.disable ship
.disable play #general
```

> You need: `ManageGuild`

### `.disabled`

List the commands that are switched off here.

**Usage:** `.disabled`

**Examples:**

```
.disabled
```

> You need: `ManageGuild`

### `.enable`

Re-enable a disabled command.

**Usage:** `.enable <command> [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `command` | yes | command to enable |
| `channel` | no | the channel it was disabled in |

**Examples:**

```
.enable ship
```

> You need: `ManageGuild`

### `.goodbye`

Set the channel where leaving members are announced.

**Usage:** `.goodbye <channel>`

**Aliases:** `.leave`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel to post in |

**Examples:**

```
.goodbye #general
```

> You need: `ManageGuild`

### `.goodbye message`

Set the leave message.

**Usage:** `.goodbye message <message>`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the message, or `preview` to see the current one |

**Examples:**

```
.goodbye message {user.name} has left.
```

> You need: `ManageGuild`

### `.goodbye off`

Stop announcing when members leave.

**Usage:** `.goodbye off`

**Examples:**

```
.goodbye off
```

> You need: `ManageGuild`

### `.logs`

One channel catches everything by default. To split them up, set `logs.moderation`, `logs.messages`, `logs.members`, `logs.server` or `logs.voice` individually with the `set` command.

**Usage:** `.logs <channel>`

**Aliases:** `.logging`, `.setlogs`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel to post in |

**Examples:**

```
.logs #audit-log
```

> You need: `ManageGuild`

### `.logs off`

Turn logging off.

**Usage:** `.logs off`

**Examples:**

```
.logs off
```

> You need: `ManageGuild`

### `.module`

Turn a whole command category on or off.

**Usage:** `.module <category> <on|off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `category` | yes | category name, e.g. fun |
| `state` | yes | on or off |

**Examples:**

```
.module fun off
.module economy on
```

> You need: `ManageGuild`

### `.prefix`

Mentioning the bot always works as a prefix too, so you can never lock yourself out.

**Usage:** `.prefix [new prefix]`

| Argument | Required | What it is |
| --- | --- | --- |
| `prefix` | no | the new prefix (max 5 characters) |

**Examples:**

```
.prefix
.prefix !
```

### `.reset`

Restore a setting to its default value.

**Usage:** `.reset <key | all>`

| Argument | Required | What it is |
| --- | --- | --- |
| `key` | yes | the setting key, or `all` |

**Examples:**

```
.reset embed.color
.reset all
```

> You need: `ManageGuild`

### `.set`

Keys look like `levels.enabled` or `embed.color` — `config <category>` lists them all with their current values. Booleans accept on/off, true/false or yes/no. Channels and roles accept a mention, an ID or a name. List settings (like blocked words) accept comma separated values. Use `reset <key>` to restore the default.

**Usage:** `.set <key> <value>`

| Argument | Required | What it is |
| --- | --- | --- |
| `key` | yes | the setting key, e.g. levels.enabled |
| `value` | yes | the new value |

**Examples:**

```
.set levels.enabled on
.set embed.color #ff0066
.set logs.channel #mod-logs
```

> You need: `ManageGuild`

### `.setjail`

Choose the channel jailed members can see.

**Usage:** `.setjail <channel>`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the jail channel |

**Examples:**

```
.setjail #jail
```

> You need: `ManageGuild`

### `.starboard`

Messages that get enough star reactions are reposted to the starboard channel, with a live star count.

**Usage:** `.starboard <channel> [threshold]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel to post in |
| `threshold` | no | stars needed (default 3) |

**Examples:**

```
.starboard #starboard
.starboard #starboard 5
```

> You need: `ManageGuild`

### `.starboard emoji`

Change the emoji that counts as a star.

**Usage:** `.starboard emoji <emoji>`

| Argument | Required | What it is |
| --- | --- | --- |
| `emoji` | yes | the emoji to use |

**Examples:**

```
.starboard emoji 🌟
```

> You need: `ManageGuild`

### `.starboard off`

Turn the starboard off.

**Usage:** `.starboard off`

**Examples:**

```
.starboard off
```

> You need: `ManageGuild`

### `.variables`

These work in welcome, leave, boost, level-up, autoresponder, ticket and sticky messages.

For an embed, start the message with `{embed}` and separate parts with `$v`, e.g.
`{embed}{color: #8b5cf6}$v{title: Hello}$v{description: Welcome {user.mention}}`

**Usage:** `.variables`

**Examples:**

```
.variables
```

### `.welcome`

Turns welcome messages on and points them at a channel. Write the message with `welcome message`. Variables like `{user.mention}` and `{guild.count}` are filled in — see `variables` for the full list.

**Usage:** `.welcome <channel>`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel to post in |

**Examples:**

```
.welcome #general
```

> You need: `ManageGuild`

### `.welcome message`

Set the welcome message, plain text or an embed script.

**Usage:** `.welcome message <message>`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the message, or `preview` to see the current one |

**Examples:**

```
.welcome message Welcome {user.mention}!
.welcome message preview
```

> You need: `ManageGuild`

### `.welcome off`

Stop greeting new members.

**Usage:** `.welcome off`

**Examples:**

```
.welcome off
```

> You need: `ManageGuild`

## Economy

### `.addmoney`

Give a member money out of thin air.

**Usage:** `.addmoney <member> <amount>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to pay |
| `amount` | yes | how much (negative to take) |

**Examples:**

```
.addmoney @user 1000
```

> You need: `Administrator`

### `.balance`

Check how much you (or someone else) has.

**Usage:** `.balance [member]`

**Aliases:** `.bal`, `.money`, `.wallet`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose balance to check |

**Examples:**

```
.balance
.balance @user
```

### `.buy`

Buy something from the shop.

**Usage:** `.buy <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the item ID from `shop` |

**Examples:**

```
.buy 3
```

### `.coinflip`

Bet on heads or tails.

**Usage:** `.coinflip <heads|tails> <amount>`

**Aliases:** `.cf`, `.flip`

| Argument | Required | What it is |
| --- | --- | --- |
| `side` | yes | heads or tails |
| `amount` | yes | how much to bet |

**Examples:**

```
.coinflip heads 250
```

### `.crime`

Risk a fine for a bigger payout. Once every two hours.

**Usage:** `.crime`

**Examples:**

```
.crime
```

### `.daily`

Each day in a row adds 10% to the payout, up to double. Missing a day resets the streak.

**Usage:** `.daily`

**Examples:**

```
.daily
```

### `.deposit`

Move cash into the bank, where it cannot be stolen.

**Usage:** `.deposit <amount>`

**Aliases:** `.dep`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | yes | how much, or `all` / `half` |

**Examples:**

```
.deposit 1000
.deposit all
```

### `.gamble`

Roll higher than the house and you double up. It is a coin flip with extra steps — the house edge is small but real.

**Usage:** `.gamble <amount>`

**Aliases:** `.bet`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | yes | how much to bet |

**Examples:**

```
.gamble 500
.gamble all
```

### `.inventory`

See what you have bought.

**Usage:** `.inventory [member]`

**Aliases:** `.inv`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose inventory |

**Examples:**

```
.inventory
```

### `.pay`

Send cash to another member.

**Usage:** `.pay <member> <amount>`

**Aliases:** `.give`, `.transfer`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to pay |
| `amount` | yes | how much, or `all` / `half` |

**Examples:**

```
.pay @user 500
.pay @user all
```

### `.reseteconomy`

Wipe all balances in the server.

**Usage:** `.reseteconomy`

**Examples:**

```
.reseteconomy
```

> You need: `Administrator` · Server owner only

### `.richest`

The richest members in the server.

**Usage:** `.richest`

**Aliases:** `.baltop`, `.moneylb`

**Examples:**

```
.richest
```

### `.rob`

Try to steal cash from another member. Fails often.

**Usage:** `.rob <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to rob |

**Examples:**

```
.rob @user
```

### `.shop`

Browse what is for sale in this server.

**Usage:** `.shop`

**Examples:**

```
.shop
```

### `.shop add`

If you attach a role, buying the item grants that role immediately.

**Usage:** `.shop add <price> <name> | [description] | [role]`

| Argument | Required | What it is |
| --- | --- | --- |
| `price` | yes | cost in currency |
| `rest` | yes | name | description | role |

**Examples:**

```
.shop add 5000 VIP | access to #vip | @VIP
```

> You need: `ManageGuild`

### `.shop remove`

Remove an item from the shop.

**Usage:** `.shop remove <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the item ID |

**Examples:**

```
.shop remove 3
```

> You need: `ManageGuild`

### `.slots`

Play the slot machine.

**Usage:** `.slots <amount>`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | yes | how much to bet |

**Examples:**

```
.slots 200
```

### `.withdraw`

Take cash back out of the bank.

**Usage:** `.withdraw <amount>`

**Aliases:** `.with`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | yes | how much, or `all` / `half` |

**Examples:**

```
.withdraw 1000
.withdraw all
```

### `.work`

Do a job for some cash. Once per hour.

**Usage:** `.work`

**Examples:**

```
.work
```

## Fun

### `.8ball`

Ask the magic 8-ball a yes/no question.

**Usage:** `.8ball <question>`

**Aliases:** `.eightball`

| Argument | Required | What it is |
| --- | --- | --- |
| `question` | yes | your question |

**Examples:**

```
.8ball will it rain tomorrow?
```

### `.advice`

Some unsolicited advice.

**Usage:** `.advice`

**Examples:**

```
.advice
```

### `.ascii`

Show text in a big code block.

**Usage:** `.ascii <text>`

| Argument | Required | What it is |
| --- | --- | --- |
| `text` | yes | the text |

**Examples:**

```
.ascii hello
```

### `.cat`

A random picture of a cat.

**Usage:** `.cat`

**Examples:**

```
.cat
```

### `.choose`

Pick one of your options at random.

**Usage:** `.choose <option | option | ...>`

**Aliases:** `.pick`

| Argument | Required | What it is |
| --- | --- | --- |
| `options` | yes | options separated by | |

**Examples:**

```
.choose pizza | sushi | tacos
```

### `.coin`

Flip a coin (no betting).

**Usage:** `.coin`

**Aliases:** `.toss`

**Examples:**

```
.coin
```

### `.compliment`

Say something nice.

**Usage:** `.compliment [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to compliment |

**Examples:**

```
.compliment @user
```

### `.divorce`

End a marriage.

**Usage:** `.divorce`

**Examples:**

```
.divorce
```

### `.dog`

A random picture of a dog.

**Usage:** `.dog`

**Examples:**

```
.dog
```

### `.emojify`

Turn text into regional indicator emojis.

**Usage:** `.emojify <text>`

| Argument | Required | What it is |
| --- | --- | --- |
| `text` | yes | the text to convert |

**Examples:**

```
.emojify hello
```

### `.guess`

Guess the number I am thinking of, between 1 and 100.

**Usage:** `.guess`

**Examples:**

```
.guess
```

### `.howgay`

A completely scientific percentage.

**Usage:** `.howgay [member]`

**Aliases:** `.gayrate`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to measure |

**Examples:**

```
.howgay
.howgay @user
```

### `.iq`

Measure someone’s IQ with total accuracy.

**Usage:** `.iq [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to measure |

**Examples:**

```
.iq @user
```

### `.joke`

A (mostly) clean joke.

**Usage:** `.joke`

**Examples:**

```
.joke
```

### `.marriage`

Check who someone is married to.

**Usage:** `.marriage [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to check |

**Examples:**

```
.marriage @user
```

### `.marry`

Propose to another member.

**Usage:** `.marry <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to propose to |

**Examples:**

```
.marry @user
```

### `.mock`

mOcK sOmE tExT.

**Usage:** `.mock <text>`

| Argument | Required | What it is |
| --- | --- | --- |
| `text` | yes | the text to mock |

**Examples:**

```
.mock i love mondays
```

### `.pp`

The classic.

**Usage:** `.pp [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to measure |

**Examples:**

```
.pp @user
```

### `.rate`

Have the bot rate anything out of ten.

**Usage:** `.rate <thing>`

| Argument | Required | What it is |
| --- | --- | --- |
| `thing` | yes | what to rate |

**Examples:**

```
.rate my new pfp
```

### `.rep`

Give someone a reputation point. Once a day.

**Usage:** `.rep <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to thank |

**Examples:**

```
.rep @user
```

### `.reputation`

Check someone’s reputation.

**Usage:** `.reputation [member]`

**Aliases:** `.reps`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose reputation |

**Examples:**

```
.reputation @user
```

### `.reverse`

Reverse some text.

**Usage:** `.reverse <text>`

| Argument | Required | What it is |
| --- | --- | --- |
| `text` | yes | the text to flip |

**Examples:**

```
.reverse hello world
```

### `.roast`

A light-hearted roast.

**Usage:** `.roast [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to roast |

**Examples:**

```
.roast @user
```

### `.roll`

Roll dice, in the usual NdN notation.

**Usage:** `.roll [NdN]`

**Aliases:** `.dice`

| Argument | Required | What it is |
| --- | --- | --- |
| `dice` | no | e.g. 2d20 |

**Examples:**

```
.roll
.roll 2d20
.roll d6
```

### `.rps`

Rock, paper, scissors against the bot.

**Usage:** `.rps <rock|paper|scissors>`

| Argument | Required | What it is |
| --- | --- | --- |
| `choice` | yes | your move |

**Examples:**

```
.rps rock
```

### `.ship`

Calculate the compatibility of two people.

**Usage:** `.ship <member> [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `first` | yes | the first person |
| `second` | no | the second person (defaults to you) |

**Examples:**

```
.ship @user
.ship @user @other
```

### `.wyr`

Get a would-you-rather question.

**Usage:** `.wyr`

**Aliases:** `.wouldyourather`

**Examples:**

```
.wyr
```

## General

### `.guide`

Everything the bot can do, written out properly — including the setup walkthrough for each module.

**Usage:** `.guide`

**Examples:**

```
.guide
```

### `.help`

Run without arguments to open the interactive category browser. Pass a command name to see exactly what it does, what each argument means, which permissions it needs, and worked examples.

**Usage:** `.help [command]`

**Aliases:** `.h`, `.commands`, `.cmds`

| Argument | Required | What it is |
| --- | --- | --- |
| `command` | no | the command you want explained |

**Examples:**

```
.help
.help ban
.help antinuke whitelist
```

### `.searchcommands`

Useful when you know what you want to do but not what the command is called.

**Usage:** `.searchcommands <query>`

**Aliases:** `.findcmd`, `.search commands`

| Argument | Required | What it is |
| --- | --- | --- |
| `query` | yes | what to search for |

**Examples:**

```
.searchcommands ban
.searchcommands colour
```

## Giveaways

### `.giveaway cancel`

Cancel a giveaway without picking a winner.

**Usage:** `.giveaway cancel <message id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the giveaway message ID |

**Examples:**

```
.giveaway cancel 123456789012345678
```

> You need: `ManageGuild`

### `.giveaway end`

End a giveaway early and draw the winners now.

**Usage:** `.giveaway end <message id>`

**Aliases:** `.gend`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the giveaway message ID |

**Examples:**

```
.giveaway end 123456789012345678
```

> You need: `ManageGuild`

### `.giveaway list`

Show the giveaways running right now.

**Usage:** `.giveaway list`

**Aliases:** `.glist`

**Examples:**

```
.giveaway list
```

### `.giveaway reroll`

Draw a new winner for a finished giveaway.

**Usage:** `.giveaway reroll <message id> [winners]`

**Aliases:** `.greroll`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the giveaway message ID |
| `count` | no | how many new winners |

**Examples:**

```
.giveaway reroll 123456789012345678
```

> You need: `ManageGuild`

### `.giveaway start`

The entry count updates live. When the timer runs out I pick the winners at random and ping them. Use `giveaway reroll` if a winner does not claim.

**Usage:** `.giveaway start <duration> <winners> <prize>`

**Aliases:** `.gstart`

| Argument | Required | What it is |
| --- | --- | --- |
| `duration` | yes | how long it runs, e.g. 1h or 3d |
| `winners` | yes | how many winners |
| `prize` | yes | what they win |

**Examples:**

```
.giveaway start 1h 1 Nitro Classic
.giveaway start 3d 3 Steam key
```

> You need: `ManageGuild`

## Information

### `.avatar`

Show someone’s avatar in full size.

**Usage:** `.avatar [member]`

**Aliases:** `.av`, `.pfp`, `.icon`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose avatar (defaults to you) |

**Examples:**

```
.avatar
.avatar @user
```

### `.banner`

Show someone’s profile banner.

**Usage:** `.banner [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose banner |

**Examples:**

```
.banner
.banner @user
```

### `.boosters`

List everyone boosting the server.

**Usage:** `.boosters`

**Examples:**

```
.boosters
```

### `.botinfo`

Statistics about the bot itself.

**Usage:** `.botinfo`

**Aliases:** `.about`, `.stats`, `.uptime`

**Examples:**

```
.botinfo
```

### `.channelinfo`

Details about a channel.

**Usage:** `.channelinfo [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel |

**Examples:**

```
.channelinfo
.channelinfo #general
```

### `.emojiinfo`

Details about a custom emoji, including a full-size image.

**Usage:** `.emojiinfo <emoji>`

| Argument | Required | What it is |
| --- | --- | --- |
| `emoji` | yes | the emoji to inspect |

**Examples:**

```
.emojiinfo :partyparrot:
```

### `.emojis`

List every custom emoji in the server.

**Usage:** `.emojis`

**Aliases:** `.emotes`

**Examples:**

```
.emojis
```

### `.firstmessage`

Jump to the very first message in a channel.

**Usage:** `.firstmessage [channel]`

**Aliases:** `.firstmsg`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel |

**Examples:**

```
.firstmessage
.firstmessage #general
```

### `.invite`

Get the link to add this bot to another server.

**Usage:** `.invite`

**Examples:**

```
.invite
```

### `.membercount`

How many members this server has.

**Usage:** `.membercount`

**Aliases:** `.members`, `.mc`

**Examples:**

```
.membercount
```

### `.ping`

Check the bot’s latency.

**Usage:** `.ping`

**Examples:**

```
.ping
```

### `.roleinfo`

Details about a role.

**Usage:** `.roleinfo <role>`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | the role to inspect |

**Examples:**

```
.roleinfo Moderator
```

### `.servericon`

Show this server’s icon.

**Usage:** `.servericon`

**Examples:**

```
.servericon
```

### `.serverinfo`

Statistics and settings for this server.

**Usage:** `.serverinfo`

**Aliases:** `.si`, `.guildinfo`, `.server`

**Examples:**

```
.serverinfo
```

### `.steal`

Copy an emoji from another server into this one.

**Usage:** `.steal <emoji> [name]`

**Aliases:** `.addemoji`

| Argument | Required | What it is |
| --- | --- | --- |
| `emoji` | yes | the emoji to copy |
| `name` | no | a new name for it |

**Examples:**

```
.steal :cooldance:
.steal :cooldance: dancing
```

> You need: `ManageGuildExpressions` · Bot needs: `ManageGuildExpressions`

### `.userinfo`

Everything about a member — roles, dates, permissions and their record.

**Usage:** `.userinfo [member]`

**Aliases:** `.ui`, `.whois`, `.user`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | who to look up (defaults to you) |

**Examples:**

```
.userinfo
.userinfo @user
```

## Levels

### `.addxp`

Give or take XP from a member.

**Usage:** `.addxp <member> <amount>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to adjust |
| `amount` | yes | how much XP (negative to remove) |

**Examples:**

```
.addxp @user 500
.addxp @user -200
```

> You need: `ManageGuild`

### `.leaderboard`

The server XP leaderboard.

**Usage:** `.leaderboard`

**Aliases:** `.lb`, `.levels`, `.top`

**Examples:**

```
.leaderboard
```

### `.levelrole add`

With role stacking on (the default) members keep older level roles; turn `levels.stackRoles` off to swap them instead.

**Usage:** `.levelrole add <level> <role>`

**Aliases:** `.levelreward add`

| Argument | Required | What it is |
| --- | --- | --- |
| `level` | yes | the level they must reach |
| `role` | yes | the role to give |

**Examples:**

```
.levelrole add 5 Regular
.levelrole add 20 Veteran
```

> You need: `ManageGuild` · Bot needs: `ManageRoles`

### `.levelrole list`

Show every level reward.

**Usage:** `.levelrole list`

**Aliases:** `.levelroles`

**Examples:**

```
.levelrole list
```

### `.levelrole remove`

Stop giving a role at a level.

**Usage:** `.levelrole remove <level>`

| Argument | Required | What it is |
| --- | --- | --- |
| `level` | yes | the level to clear |

**Examples:**

```
.levelrole remove 5
```

> You need: `ManageGuild`

### `.levels setup`

Turn levelling on and choose where level-ups are announced.

**Usage:** `.levels setup [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | where to announce (defaults to wherever they spoke) |

**Examples:**

```
.levels setup
.levels setup #level-ups
```

> You need: `ManageGuild`

### `.rank`

Show your level, XP and position on the leaderboard.

**Usage:** `.rank [member]`

**Aliases:** `.level`, `.xp`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose rank (defaults to you) |

**Examples:**

```
.rank
.rank @user
```

### `.resetlevels`

Wipe all XP in the server, or for one member.

**Usage:** `.resetlevels [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | reset only this member |

**Examples:**

```
.resetlevels
.resetlevels @user
```

> You need: `Administrator`

### `.setlevel`

Set a member’s level directly.

**Usage:** `.setlevel <member> <level>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | whose level to set |
| `level` | yes | the level to give them |

**Examples:**

```
.setlevel @user 10
```

> You need: `ManageGuild`

### `.voiceleaderboard`

Who has spent the most time in voice channels.

**Usage:** `.voiceleaderboard`

**Aliases:** `.vclb`

**Examples:**

```
.voiceleaderboard
```

## Moderation

### `.ban`

Bans the member and records a case. Add a duration (for example `7d`) to make it temporary — I will unban them automatically when it expires. Works on people who have already left the server if you pass their ID.

**Usage:** `.ban <member> [duration] [reason]`

**Aliases:** `.b`

| Argument | Required | What it is |
| --- | --- | --- |
| `user` | yes | member or user ID to ban |
| `duration` | no | how long, e.g. 7d — omit for permanent |
| `reason` | no | why you are doing this |

**Examples:**

```
.ban @user raiding
.ban 123456789012345678 7d ban evasion
.ban @user 12h spam
```

> You need: `BanMembers` · Bot needs: `BanMembers`

### `.bans`

List everyone currently banned from the server.

**Usage:** `.bans`

**Aliases:** `.banlist`

**Examples:**

```
.bans
```

> You need: `BanMembers` · Bot needs: `BanMembers`

### `.case`

Look up one moderation case in detail.

**Usage:** `.case <number>`

| Argument | Required | What it is |
| --- | --- | --- |
| `number` | yes | the case number |

**Examples:**

```
.case 42
```

> You need: `ModerateMembers`

### `.channelcreate`

Create a channel.

**Usage:** `.channelcreate <name> [text|voice]`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | name for the channel |
| `kind` | no | channel type |

**Examples:**

```
.channelcreate announcements
.channelcreate Music voice
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.channeldelete`

Delete a channel.

**Usage:** `.channeldelete [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel to delete |

**Examples:**

```
.channeldelete #old
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.clearwarns`

Clear every warning a member has.

**Usage:** `.clearwarns <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | whose warnings to wipe |

**Examples:**

```
.clearwarns @user
```

> You need: `ManageGuild`

### `.deafen`

Server-deafen a member in voice.

**Usage:** `.deafen <member>`

**Aliases:** `.vdeafen`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to deafen |

**Examples:**

```
.deafen @user
```

> You need: `DeafenMembers` · Bot needs: `DeafenMembers`

### `.delnote`

Delete a staff note by its ID.

**Usage:** `.delnote <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | note ID shown by `notes` |

**Examples:**

```
.delnote 7
```

> You need: `ModerateMembers`

### `.delwarn`

Delete a single warning by its case number.

**Usage:** `.delwarn <case>`

**Aliases:** `.unwarn`, `.removewarn`

| Argument | Required | What it is |
| --- | --- | --- |
| `case` | yes | case number shown in `warnings` |

**Examples:**

```
.delwarn 12
```

> You need: `ModerateMembers`

### `.forcenick`

Use `unforcenick` to release them. Handy for people who keep setting offensive nicknames.

**Usage:** `.forcenick <member> <nickname>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to lock |
| `nickname` | yes | the nickname they are stuck with |

**Examples:**

```
.forcenick @user Timeout
```

> You need: `ManageNicknames` · Bot needs: `ManageNicknames`

### `.hardban`

For people who must never come back. The ban is recorded permanently; if another moderator unbans them, use `unhardban` first or the ban is simply re-applied.

**Usage:** `.hardban <user> [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `user` | yes | user to permanently ban |
| `reason` | no | why you are doing this |

**Examples:**

```
.hardban @user ban evasion
```

> You need: `Administrator` · Bot needs: `BanMembers`

### `.hide`

Hide a channel from @everyone.

**Usage:** `.hide [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel |

**Examples:**

```
.hide
.hide #staff
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.history`

Show every moderation action taken against a member.

**Usage:** `.history [member]`

**Aliases:** `.modlogs`, `.cases`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose history to show |

**Examples:**

```
.history @user
```

> You need: `ModerateMembers`

### `.imute`

Applies a per-channel permission override denying Attach Files and Embed Links.

**Usage:** `.imute <member> [duration] [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to mute |
| `duration` | no | how long |
| `reason` | no | why |

**Examples:**

```
.imute @user 1h
```

> You need: `ModerateMembers` · Bot needs: `ManageChannels`

### `.iunmute`

Let a member post images again.

**Usage:** `.iunmute <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to unmute |

**Examples:**

```
.iunmute @user
```

> You need: `ModerateMembers` · Bot needs: `ManageChannels`

### `.jail`

Creates a Jailed role the first time you use it. Their previous roles are stored and given back by `unjail`. Set the jail channel with `setjail #channel`.

**Usage:** `.jail <member> [duration] [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to jail |
| `duration` | no | how long, e.g. 1h |
| `reason` | no | why |

**Examples:**

```
.jail @user
.jail @user 1h under review
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.kick`

Remove a member from the server. They can rejoin with a new invite.

**Usage:** `.kick <member> [reason]`

**Aliases:** `.k`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to kick |
| `reason` | no | why you are doing this |

**Examples:**

```
.kick @user breaking rule 3
```

> You need: `KickMembers` · Bot needs: `KickMembers`

### `.lock`

Denies Send Messages for @everyone. Staff roles with an explicit allow are unaffected.

**Usage:** `.lock [channel] [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel (defaults to here) |
| `reason` | no | why |

**Examples:**

```
.lock
.lock #general raid in progress
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.lockdown`

The emergency switch during a raid. `lockdown end` reverses it.

**Usage:** `.lockdown [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `reason` | no | why, or `end` to lift it |

**Examples:**

```
.lockdown raid
.lockdown end
```

> You need: `Administrator` · Bot needs: `ManageChannels`

### `.massban`

Pass a list of user IDs separated by spaces. Always asks for confirmation.

**Usage:** `.massban <ids...>`

| Argument | Required | What it is |
| --- | --- | --- |
| `ids` | yes | space separated user IDs |

**Examples:**

```
.massban 111111111111111111 222222222222222222
```

> You need: `Administrator` · Bot needs: `BanMembers`

### `.modstats`

See how many actions a moderator has taken.

**Usage:** `.modstats [moderator]`

| Argument | Required | What it is |
| --- | --- | --- |
| `moderator` | no | which moderator (defaults to you) |

**Examples:**

```
.modstats
.modstats @mod
```

> You need: `ModerateMembers`

### `.move`

Move a member into another voice channel.

**Usage:** `.move <member> [channel]`

**Aliases:** `.drag`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to move |
| `channel` | no | where to (defaults to your channel) |

**Examples:**

```
.move @user General
.move @user
```

> You need: `MoveMembers` · Bot needs: `MoveMembers`

### `.moveall`

Move everyone from one voice channel to another.

**Usage:** `.moveall <from> <to>`

**Aliases:** `.dragall`

| Argument | Required | What it is |
| --- | --- | --- |
| `from` | yes | channel to empty |
| `to` | yes | channel to fill |

**Examples:**

```
.moveall Lobby General
```

> You need: `MoveMembers` · Bot needs: `MoveMembers`

### `.nickname`

Change or clear a member’s nickname.

**Usage:** `.nickname <member> [nickname]`

**Aliases:** `.nick`, `.setnick`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to rename |
| `nickname` | no | the new nickname — leave empty to reset |

**Examples:**

```
.nickname @user Dave
.nickname @user
```

> You need: `ManageNicknames` · Bot needs: `ManageNicknames`

### `.note`

Notes are only visible to moderators and are never sent to the member.

**Usage:** `.note <member> <note>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who the note is about |
| `note` | yes | the note text |

**Examples:**

```
.note @user keeps toeing the line in #general
```

> You need: `ModerateMembers`

### `.notes`

Read the staff notes on a member.

**Usage:** `.notes <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | whose notes to read |

**Examples:**

```
.notes @user
```

> You need: `ModerateMembers`

### `.nsfw`

Toggle a channel’s age-restricted flag.

**Usage:** `.nsfw [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel |

**Examples:**

```
.nsfw
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.nuke`

Clones the channel with the same name, permissions, topic and position, then deletes the original. The only way to clear a channel with more than 14 days of history. Always asks first.

**Usage:** `.nuke [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel to nuke |

**Examples:**

```
.nuke
.nuke #spam
```

> You need: `Administrator` · Bot needs: `ManageChannels`

### `.purge`

Scans the most recent messages in the channel and deletes up to the amount you asked for. Discord does not allow bulk deletion of messages older than 14 days, and pinned messages are always kept.

Subcommands narrow it down: `purge bots`, `purge images`, `purge links`, `purge embeds`, `purge contains <text>`.

**Usage:** `.purge <amount> [member]`

**Aliases:** `.clear`, `.prune`, `.c`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | yes | how many to delete (1-100) |
| `member` | no | only delete this member’s messages |

**Examples:**

```
.purge 50
.purge 20 @user
```

> You need: `ManageMessages` · Bot needs: `ManageMessages`

### `.purge bots`

Delete recent messages sent by bots.

**Usage:** `.purge bots [amount]`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | no | how many messages to scan (max 100) |

**Examples:**

```
.purge bots
.purge bots 20
```

> You need: `ManageMessages` · Bot needs: `ManageMessages`

### `.purge contains`

Delete recent messages containing a word or phrase.

**Usage:** `.purge contains <text>`

| Argument | Required | What it is |
| --- | --- | --- |
| `text` | yes | text to match (case insensitive) |

**Examples:**

```
.purge contains discord.gg
```

> You need: `ManageMessages` · Bot needs: `ManageMessages`

### `.purge embeds`

Delete recent messages that contain an embed.

**Usage:** `.purge embeds [amount]`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | no | how many messages to scan (max 100) |

**Examples:**

```
.purge embeds
```

> You need: `ManageMessages` · Bot needs: `ManageMessages`

### `.purge images`

Delete recent messages that contain an attachment.

**Usage:** `.purge images [amount]`

**Aliases:** `.purge attachments`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | no | how many messages to scan (max 100) |

**Examples:**

```
.purge images 30
```

> You need: `ManageMessages` · Bot needs: `ManageMessages`

### `.purge links`

Delete recent messages containing a link.

**Usage:** `.purge links [amount]`

| Argument | Required | What it is |
| --- | --- | --- |
| `amount` | no | how many messages to scan (max 100) |

**Examples:**

```
.purge links
```

> You need: `ManageMessages` · Bot needs: `ManageMessages`

### `.reason`

Change the reason stored on a case.

**Usage:** `.reason <case> <reason>`

| Argument | Required | What it is |
| --- | --- | --- |
| `case` | yes | case number to edit |
| `reason` | yes | the new reason |

**Examples:**

```
.reason 42 actually it was ban evasion
```

> You need: `ModerateMembers`

### `.restoreroles`

Only works for members stripped by this bot, and only for roles that still exist and sit below me.

**Usage:** `.restoreroles <member>`

**Aliases:** `.unstrip`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to restore |

**Examples:**

```
.restoreroles @user
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.rmute`

Stop a member from adding reactions.

**Usage:** `.rmute <member> [duration] [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to mute |
| `duration` | no | how long |
| `reason` | no | why |

**Examples:**

```
.rmute @user 30m
```

> You need: `ModerateMembers` · Bot needs: `ManageChannels`

### `.rolemute`

Creates a Muted role the first time you use it and denies it permission to speak in every channel. Useful when you want mutes longer than 28 days, or a role people can see.

**Usage:** `.rolemute <member> [duration] [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to mute |
| `duration` | no | optional length, e.g. 30d |
| `reason` | no | why you are doing this |

**Examples:**

```
.rolemute @user 30d
.rolemute @user harassment
```

> You need: `ModerateMembers` · Bot needs: `ManageRoles`

### `.roleunmute`

Remove the Muted role from a member.

**Usage:** `.roleunmute <member> [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to unmute |
| `reason` | no | why you are doing this |

**Examples:**

```
.roleunmute @user
```

> You need: `ModerateMembers` · Bot needs: `ManageRoles`

### `.runmute`

Let a member add reactions again.

**Usage:** `.runmute <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to unmute |

**Examples:**

```
.runmute @user
```

> You need: `ModerateMembers` · Bot needs: `ManageChannels`

### `.slowmode`

Set how often members can send a message in a channel.

**Usage:** `.slowmode <duration> [channel]`

**Aliases:** `.slow`

| Argument | Required | What it is |
| --- | --- | --- |
| `duration` | yes | delay per message, e.g. 10s (max 6h), or 0 to disable |
| `channel` | no | which channel |

**Examples:**

```
.slowmode 10s
.slowmode 0
.slowmode 5m #general
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.softban`

The tidy way to kick someone and wipe the mess they made. Deletes the last 7 days of their messages.

**Usage:** `.softban <member> [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to softban |
| `reason` | no | why you are doing this |

**Examples:**

```
.softban @user spam flood
```

> You need: `BanMembers` · Bot needs: `BanMembers`

### `.strip`

Takes all roles I am able to remove. Roles above me in the hierarchy, managed/bot roles and @everyone cannot be touched by anyone, so those stay.

**Always asks for confirmation before it does anything.** Stripped roles are remembered, so `restoreroles @user` can put a single member back exactly as they were.

`strip all` strips every member in the server and is limited to the server owner — it is the emergency button for when a role has been handed out to everyone by mistake or during a nuke.

**Usage:** `.strip <member | all> [reason]`

**Aliases:** `.stripstaff`, `.clearroles`

| Argument | Required | What it is |
| --- | --- | --- |
| `target` | yes | a member, or the word `all` |
| `reason` | no | why |

**Examples:**

```
.strip @user
.strip @user compromised account
.strip all
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.timeout`

Uses Discord’s native timeout, which survives rejoining and needs no role. Maximum length is 28 days. If you would rather use a Muted role, use `rolemute` instead.

**Usage:** `.timeout <member> <duration> [reason]`

**Aliases:** `.to`, `.mute`, `.shutup`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to time out |
| `duration` | yes | how long, e.g. 10m, 2h, 7d (max 28d) |
| `reason` | no | why you are doing this |

**Examples:**

```
.timeout @user 10m calm down
.timeout @user 1d spamming
```

> You need: `ModerateMembers` · Bot needs: `ModerateMembers`

### `.topic`

Set or clear a channel’s topic.

**Usage:** `.topic <topic>`

| Argument | Required | What it is |
| --- | --- | --- |
| `topic` | yes | the new topic, or `clear` |

**Examples:**

```
.topic general chat — be nice
.topic clear
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.unban`

Pass the user ID — banned users cannot be mentioned. `unban list` shows every current ban.

**Usage:** `.unban <user> [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `user` | yes | user ID to unban |
| `reason` | no | why you are doing this |

**Examples:**

```
.unban 123456789012345678 appealed
```

> You need: `BanMembers` · Bot needs: `BanMembers`

### `.unbanall`

Hard bans are skipped. Asks for confirmation, and can take a while on large ban lists.

**Usage:** `.unbanall`

**Examples:**

```
.unbanall
```

> You need: `Administrator` · Bot needs: `BanMembers` · Server owner only

### `.unforcenick`

Release a member from a forced nickname.

**Usage:** `.unforcenick <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to release |

**Examples:**

```
.unforcenick @user
```

> You need: `ManageNicknames` · Bot needs: `ManageNicknames`

### `.unhardban`

Remove a hard ban so the user can be unbanned normally.

**Usage:** `.unhardban <user>`

| Argument | Required | What it is |
| --- | --- | --- |
| `user` | yes | user to clear |

**Examples:**

```
.unhardban 123456789012345678
```

> You need: `Administrator`

### `.unhide`

Make a hidden channel visible again.

**Usage:** `.unhide [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel |

**Examples:**

```
.unhide
.unhide #staff
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.unjail`

Release a member from jail and restore their roles.

**Usage:** `.unjail <member> [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to release |
| `reason` | no | why |

**Examples:**

```
.unjail @user
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.unlock`

Allow everyone to send messages again.

**Usage:** `.unlock [channel]`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | no | which channel (defaults to here) |

**Examples:**

```
.unlock
.unlock #general
```

> You need: `ManageChannels` · Bot needs: `ManageChannels`

### `.untimeout`

End a member’s timeout early.

**Usage:** `.untimeout <member> [reason]`

**Aliases:** `.unmute`, `.unto`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to release |
| `reason` | no | why you are doing this |

**Examples:**

```
.untimeout @user appealed
```

> You need: `ModerateMembers` · Bot needs: `ModerateMembers`

### `.voicekick`

Disconnect a member from voice.

**Usage:** `.voicekick <member> [reason]`

**Aliases:** `.vckick`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to disconnect |
| `reason` | no | why |

**Examples:**

```
.voicekick @user
```

> You need: `MoveMembers` · Bot needs: `MoveMembers`

### `.voicemute`

Server-mute a member in voice.

**Usage:** `.voicemute <member> [reason]`

**Aliases:** `.vmute`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to mute |
| `reason` | no | why |

**Examples:**

```
.voicemute @user
```

> You need: `MuteMembers` · Bot needs: `MuteMembers`

### `.warn`

Warnings are stored permanently and shown by `warnings`. Set `moderation.warnThreshold` to punish automatically once someone collects enough of them.

**Usage:** `.warn <member> [reason]`

**Aliases:** `.w`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | member to warn |
| `reason` | no | why you are doing this |

**Examples:**

```
.warn @user stop posting that
```

> You need: `ModerateMembers`

### `.warnings`

List a member’s active warnings.

**Usage:** `.warnings [member]`

**Aliases:** `.warns`, `.infractions`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose warnings to show (defaults to you) |

**Examples:**

```
.warnings
.warnings @user
```

> You need: `ModerateMembers`

## Music

### `.clearqueue`

Empty the queue without stopping the current track.

**Usage:** `.clearqueue`

**Aliases:** `.cq`

**Examples:**

```
.clearqueue
```

### `.dj`

Set the DJ role that controls playback when others are listening.

**Usage:** `.dj <role | off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | the role, or `off` |

**Examples:**

```
.dj @DJ
.dj off
```

> You need: `ManageGuild`

### `.grab`

DM yourself the track that is playing.

**Usage:** `.grab`

**Aliases:** `.save`

**Examples:**

```
.grab
```

### `.join`

Make the bot join your voice channel.

**Usage:** `.join`

**Aliases:** `.summon`

**Examples:**

```
.join
```

> Bot needs: `Connect`, `Speak`

### `.loop`

Loop the current track, the whole queue, or nothing.

**Usage:** `.loop <off|track|queue>`

**Aliases:** `.repeat`

| Argument | Required | What it is |
| --- | --- | --- |
| `mode` | yes | off, track or queue |

**Examples:**

```
.loop track
.loop queue
.loop off
```

### `.musicchannel`

Restrict music commands to one channel.

**Usage:** `.musicchannel <channel | off>`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the channel, or `off` |

**Examples:**

```
.musicchannel #music
.musicchannel off
```

> You need: `ManageGuild`

### `.nowplaying`

Show the track that is playing right now.

**Usage:** `.nowplaying`

**Aliases:** `.np`, `.current`

**Examples:**

```
.nowplaying
```

### `.pause`

Pause playback.

**Usage:** `.pause`

**Examples:**

```
.pause
```

### `.play`

Accepts a YouTube link, a YouTube playlist, a Spotify track/album/playlist link, or plain search terms. Spotify links are matched to the closest YouTube result, since Spotify does not allow direct streaming.

**Usage:** `.play <song or link>`

**Aliases:** `.p`

| Argument | Required | What it is |
| --- | --- | --- |
| `query` | yes | search terms or a link |

**Examples:**

```
.play never gonna give you up
.play https://youtu.be/dQw4w9WgXcQ
```

> Bot needs: `Connect`, `Speak`

### `.playlist delete`

Delete one of your playlists.

**Usage:** `.playlist delete <name>`

**Aliases:** `.playlist remove`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | which playlist |

**Examples:**

```
.playlist delete focus
```

### `.playlist list`

Show the playlists you have saved.

**Usage:** `.playlist list`

**Aliases:** `.playlists`

**Examples:**

```
.playlist list
```

### `.playlist load`

Queue everything in one of your playlists.

**Usage:** `.playlist load <name>`

**Aliases:** `.playlist play`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | which playlist |

**Examples:**

```
.playlist load focus
```

> Bot needs: `Connect`, `Speak`

### `.playlist save`

Saves the track that is playing plus everything queued behind it. Playlists belong to you, not to the server, so you can load them anywhere the bot is.

**Usage:** `.playlist save <name>`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | a name for the playlist |

**Examples:**

```
.playlist save focus
.playlist save "friday night"
```

### `.playlist show`

List the tracks inside one of your playlists.

**Usage:** `.playlist show <name>`

**Aliases:** `.playlist view`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | which playlist |

**Examples:**

```
.playlist show focus
```

### `.queue`

Show what is playing and what is coming up.

**Usage:** `.queue`

**Aliases:** `.q`

**Examples:**

```
.queue
```

### `.remove`

Remove one track from the queue by its position.

**Usage:** `.remove <position>`

| Argument | Required | What it is |
| --- | --- | --- |
| `position` | yes | position shown in `queue` |

**Examples:**

```
.remove 3
```

### `.resume`

Resume playback.

**Usage:** `.resume`

**Aliases:** `.unpause`

**Examples:**

```
.resume
```

### `.search`

Search YouTube and pick from the results.

**Usage:** `.search <query>`

| Argument | Required | What it is |
| --- | --- | --- |
| `query` | yes | what to search for |

**Examples:**

```
.search lofi beats
```

> Bot needs: `Connect`, `Speak`

### `.shuffle`

Shuffle the queue.

**Usage:** `.shuffle`

**Examples:**

```
.shuffle
```

### `.skip`

Skip the current track.

**Usage:** `.skip`

**Aliases:** `.sk`, `.next`

**Examples:**

```
.skip
```

### `.skipto`

Jump straight to a track in the queue.

**Usage:** `.skipto <position>`

**Aliases:** `.jump`

| Argument | Required | What it is |
| --- | --- | --- |
| `position` | yes | position to jump to |

**Examples:**

```
.skipto 5
```

### `.stop`

Stop playing, clear the queue and leave the voice channel.

**Usage:** `.stop`

**Aliases:** `.disconnect`, `.dc`

**Examples:**

```
.stop
```

### `.volume`

Show or change the playback volume.

**Usage:** `.volume [1-150]`

**Aliases:** `.vol`

| Argument | Required | What it is |
| --- | --- | --- |
| `level` | no | the new volume, 1 to 150 |

**Examples:**

```
.volume
.volume 80
```

## Owner

### `.announce`

Send a message to every server’s system channel.

**Usage:** `.announce <message>`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | what to announce |

**Examples:**

```
.announce Downtime tonight at 9pm UTC
```

> Bot owners only

### `.blacklist`

Block a user or server from using the bot.

**Usage:** `.blacklist <id> [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | user or guild ID |
| `reason` | no | why |

**Examples:**

```
.blacklist 123456789012345678 abuse
```

> Bot owners only

### `.blacklisted`

List every blacklisted user and server.

**Usage:** `.blacklisted`

**Examples:**

```
.blacklisted
```

> Bot owners only

### `.dbstats`

Row counts for every table in the database.

**Usage:** `.dbstats`

**Examples:**

```
.dbstats
```

> Bot owners only

### `.leaveserver`

Make the bot leave a server.

**Usage:** `.leaveserver <guild id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `guild` | yes | the server ID |

**Examples:**

```
.leaveserver 123456789012345678
```

> Bot owners only

### `.reload`

Reload every command file without restarting the bot.

**Usage:** `.reload`

**Examples:**

```
.reload
```

> Bot owners only

### `.servers`

List every server the bot is in.

**Usage:** `.servers`

**Aliases:** `.guilds`

**Examples:**

```
.servers
```

> Bot owners only

### `.setstatus`

Change the bot’s presence.

**Usage:** `.setstatus <playing|watching|listening> <text>`

| Argument | Required | What it is |
| --- | --- | --- |
| `kind` | yes | activity type |
| `text` | yes | the status text |

**Examples:**

```
.setstatus watching the server
```

> Bot owners only

### `.unblacklist`

Remove a blacklist entry.

**Usage:** `.unblacklist <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the ID to clear |

**Examples:**

```
.unblacklist 123456789012345678
```

> Bot owners only

## Roles

### `.addinvites`

Add or remove bonus invites for someone.

**Usage:** `.addinvites <member> <amount>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to adjust |
| `amount` | yes | how many (negative to remove) |

**Examples:**

```
.addinvites @user 5
```

> You need: `ManageGuild`

### `.autorole add`

Automatically give a role to everyone who joins.

**Usage:** `.autorole add <role> [bots]`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | role to grant on join |
| `kind` | no | apply to humans or bots |

**Examples:**

```
.autorole add Member
.autorole add BotRole bots
```

> You need: `ManageGuild` · Bot needs: `ManageRoles`

### `.autorole list`

Show which roles are handed out on join.

**Usage:** `.autorole list`

**Examples:**

```
.autorole list
```

> You need: `ManageGuild`

### `.autorole remove`

Stop giving a role out automatically.

**Usage:** `.autorole remove <role>`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | role to stop granting |

**Examples:**

```
.autorole remove Member
```

> You need: `ManageGuild`

### `.buttonrole`

Give up to five roles separated by `|`. Members press a button to add the role and press it again to remove it. The buttons keep working after a restart.

**Usage:** `.buttonrole <title> | <role> | [role] …`

**Aliases:** `.br`

| Argument | Required | What it is |
| --- | --- | --- |
| `input` | yes | title | role | role … |

**Examples:**

```
.buttonrole Pick your pings | @Announcements | @Events
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.inrole`

List everyone who has a given role.

**Usage:** `.inrole <role>`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | the role to inspect |

**Examples:**

```
.inrole Moderator
```

### `.inviteleaderboard`

Who has invited the most people.

**Usage:** `.inviteleaderboard`

**Aliases:** `.invitelb`, `.topinvites`

**Examples:**

```
.inviteleaderboard
```

### `.inviter`

Find out who invited a member.

**Usage:** `.inviter <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to look up |

**Examples:**

```
.inviter @user
```

### `.invites`

See how many people someone has invited.

**Usage:** `.invites [member]`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | no | whose invites to check |

**Examples:**

```
.invites
.invites @user
```

> Bot needs: `ManageGuild`

### `.reactionrole add`

Reacting adds the role, removing the reaction takes it away. The message must be in this server — copy its ID with Developer Mode on.

**Usage:** `.reactionrole add <message id> <emoji> <role>`

**Aliases:** `.rr add`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the message ID to watch |
| `emoji` | yes | the emoji people react with |
| `role` | yes | the role to give |

**Examples:**

```
.reactionrole add 123456789012345678 🎮 Gamer
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`, `AddReactions`

### `.reactionrole list`

List every reaction role in the server.

**Usage:** `.reactionrole list`

**Aliases:** `.rr list`

**Examples:**

```
.reactionrole list
```

> You need: `ManageRoles`

### `.reactionrole remove`

Stop a reaction from giving a role.

**Usage:** `.reactionrole remove <message id> <emoji>`

**Aliases:** `.rr remove`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the message ID |
| `emoji` | yes | the emoji to unbind |

**Examples:**

```
.reactionrole remove 123456789012345678 🎮
```

> You need: `ManageRoles`

### `.role`

If the member already has the role it is removed, otherwise it is added.

**Usage:** `.role <member> <role>`

**Aliases:** `.r`, `.giverole`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to change |
| `role` | yes | the role to toggle |

**Examples:**

```
.role @user Member
.role @user @Muted
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.roleall`

Asks for confirmation first. Use `roleall humans` or `roleall bots` to target only one group.

**Usage:** `.roleall <role> [humans|bots]`

**Aliases:** `.massrole`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | the role to hand out |
| `filter` | no | who to include |

**Examples:**

```
.roleall Member
.roleall BotRole bots
```

> You need: `Administrator` · Bot needs: `ManageRoles`

### `.rolecolor`

Change a role’s colour.

**Usage:** `.rolecolor <role> <colour>`

**Aliases:** `.rolecolour`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | the role to recolour |
| `color` | yes | hex colour like #ff0000 |

**Examples:**

```
.rolecolor VIP #ff0000
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.rolecreate`

Create a new role.

**Usage:** `.rolecreate <name> [colour]`

**Aliases:** `.createrole`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | name for the new role |
| `color` | no | hex colour like #f1c40f |

**Examples:**

```
.rolecreate Members
.rolecreate VIP #f1c40f
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.roledelete`

Delete a role.

**Usage:** `.roledelete <role>`

**Aliases:** `.deleterole`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | role to delete |

**Examples:**

```
.roledelete OldRole
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.rolehoist`

Toggle whether a role is displayed separately in the member list.

**Usage:** `.rolehoist <role>`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | role to toggle |

**Examples:**

```
.rolehoist Staff
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.rolemention`

Toggle whether anyone can mention a role.

**Usage:** `.rolemention <role>`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | role to toggle |

**Examples:**

```
.rolemention Announcements
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.rolename`

Rename a role.

**Usage:** `.rolename <role> <name>`

**Aliases:** `.renamerole`

| Argument | Required | What it is |
| --- | --- | --- |
| `role` | yes | role to rename |
| `name` | yes | the new name |

**Examples:**

```
.rolename VIP Supporter
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

### `.roles`

List every role in the server with its member count.

**Usage:** `.roles`

**Aliases:** `.rolelist`

**Examples:**

```
.roles
```

### `.temprole`

Give someone a role that is removed again after a set time.

**Usage:** `.temprole <member> <role> <duration>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to give it to |
| `role` | yes | the role |
| `duration` | yes | how long, e.g. 7d |

**Examples:**

```
.temprole @user VIP 7d
.temprole @user Muted 2h
```

> You need: `ManageRoles` · Bot needs: `ManageRoles`

## Social

### `.lastfm`

Save your username once with `lastfm set <name>` and then this works on its own.

**Usage:** `.lastfm [username]`

**Aliases:** `.fm`

| Argument | Required | What it is |
| --- | --- | --- |
| `username` | no | a Last.fm username — omit to use your saved one |

**Examples:**

```
.lastfm
.lastfm rj
```

### `.lastfm clear`

Forget your saved Last.fm username.

**Usage:** `.lastfm clear`

**Examples:**

```
.lastfm clear
```

### `.lastfm profile`

Show a Last.fm profile and scrobble count.

**Usage:** `.lastfm profile [username]`

**Aliases:** `.fm profile`

| Argument | Required | What it is |
| --- | --- | --- |
| `username` | no | a Last.fm username — omit to use your saved one |

**Examples:**

```
.lastfm profile
```

### `.lastfm set`

Save your Last.fm username so you can leave it off other commands.

**Usage:** `.lastfm set <username>`

**Aliases:** `.fm set`

| Argument | Required | What it is |
| --- | --- | --- |
| `username` | yes | your Last.fm username |

**Examples:**

```
.lastfm set rj
```

### `.lastfm topartists`

Your most played artists on Last.fm.

**Usage:** `.lastfm topartists [username]`

**Aliases:** `.fm topartists`

| Argument | Required | What it is |
| --- | --- | --- |
| `username` | no | a Last.fm username — omit to use your saved one |

**Examples:**

```
.lastfm topartists
```

### `.lastfm toptracks`

Your most played tracks on Last.fm.

**Usage:** `.lastfm toptracks [username]`

**Aliases:** `.fm toptracks`

| Argument | Required | What it is |
| --- | --- | --- |
| `username` | no | a Last.fm username — omit to use your saved one |

**Examples:**

```
.lastfm toptracks
```

## Tickets

### `.ticket add`

Add a member to the ticket you are in.

**Usage:** `.ticket add <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to add |

**Examples:**

```
.ticket add @user
```

> You need: `ManageMessages`

### `.ticket close`

Close the ticket you are in.

**Usage:** `.ticket close`

**Examples:**

```
.ticket close
```

> You need: `ManageMessages`

### `.ticket off`

Disable tickets.

**Usage:** `.ticket off`

**Examples:**

```
.ticket off
```

> You need: `ManageGuild`

### `.ticket remove`

Remove a member from the ticket you are in.

**Usage:** `.ticket remove <member>`

| Argument | Required | What it is |
| --- | --- | --- |
| `member` | yes | who to remove |

**Examples:**

```
.ticket remove @user
```

> You need: `ManageMessages`

### `.ticket setup`

Creates the panel in the channel you name. New tickets appear in the category you choose and the support role is added to every one of them.

**Usage:** `.ticket setup <channel> <category> [support role]`

**Aliases:** `.tickets setup`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | where the panel goes |
| `category` | yes | category new tickets are created in |
| `role` | no | support role added to every ticket |

**Examples:**

```
.ticket setup #support Tickets @Staff
```

> You need: `ManageGuild` · Bot needs: `ManageChannels`

## Utility

### `.afk`

Your AFK clears itself the next time you send a message, and you are told how long you were gone.

**Usage:** `.afk [reason]`

| Argument | Required | What it is |
| --- | --- | --- |
| `reason` | no | what you are doing |

**Examples:**

```
.afk
.afk sleeping
```

### `.autoresponder add`

Matches anywhere in a message by default. Supports message variables and embed scripts.

**Usage:** `.autoresponder add <trigger> | <response>`

**Aliases:** `.ar add`

| Argument | Required | What it is |
| --- | --- | --- |
| `input` | yes | trigger | response |

**Examples:**

```
.autoresponder add hello | hey there {user.mention}
```

> You need: `ManageGuild`

### `.autoresponder list`

List this server’s autoresponders.

**Usage:** `.autoresponder list`

**Aliases:** `.ar list`, `.autoresponders`

**Examples:**

```
.autoresponder list
```

> You need: `ManageGuild`

### `.autoresponder remove`

Delete an autoresponder by its ID.

**Usage:** `.autoresponder remove <id>`

**Aliases:** `.ar remove`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the ID from the list |

**Examples:**

```
.autoresponder remove 2
```

> You need: `ManageGuild`

### `.calculate`

Supports + - * / % ^ and brackets. Nothing else is allowed, so it cannot run arbitrary code.

**Usage:** `.calculate <expression>`

**Aliases:** `.calc`, `.math`

| Argument | Required | What it is |
| --- | --- | --- |
| `expression` | yes | the sum to work out |

**Examples:**

```
.calc 2 + 2 * 10
.calc (45/9)^2
```

### `.clearsnipes`

Wipe the snipe history for this channel.

**Usage:** `.clearsnipes`

**Examples:**

```
.clearsnipes
```

> You need: `ManageMessages`

### `.color`

Preview a hex colour.

**Usage:** `.color <hex>`

**Aliases:** `.colour`

| Argument | Required | What it is |
| --- | --- | --- |
| `hex` | yes | a hex colour, or `random` |

**Examples:**

```
.color #8b5cf6
.color random
```

### `.define`

Look a word up in a proper dictionary.

**Usage:** `.define <word>`

**Aliases:** `.dictionary`

| Argument | Required | What it is |
| --- | --- | --- |
| `word` | yes | the word to define |

**Examples:**

```
.define serendipity
```

### `.delreminder`

Cancel a reminder by its ID.

**Usage:** `.delreminder <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the reminder ID from `reminders` |

**Examples:**

```
.delreminder 4
```

### `.editsnipe`

Show what a recently edited message used to say.

**Usage:** `.editsnipe [index]`

**Aliases:** `.es`

| Argument | Required | What it is |
| --- | --- | --- |
| `index` | no | how far back to look |

**Examples:**

```
.editsnipe
```

### `.embed`

Uses the same script as welcome messages:
`{embed}{color: #8b5cf6}$v{title: Hello}$v{description: Some text}`

Run `variables` to see every part and variable you can use. Building it on the dashboard is easier — it has a live preview and copies the script for you.

**Usage:** `.embed <script>`

| Argument | Required | What it is |
| --- | --- | --- |
| `script` | yes | the embed script |

**Examples:**

```
.embed {embed}{title: Rules}$v{description: Be nice}
```

> You need: `ManageMessages`

### `.highlight add`

Like a keyword notification. I only DM you if you can actually see the channel it was said in.

**Usage:** `.highlight add <word>`

| Argument | Required | What it is |
| --- | --- | --- |
| `word` | yes | the word to watch for |

**Examples:**

```
.highlight add my-project
```

### `.highlight list`

Show the words you are watching.

**Usage:** `.highlight list`

**Aliases:** `.highlights`

**Examples:**

```
.highlight list
```

### `.highlight remove`

Stop watching a word.

**Usage:** `.highlight remove <word>`

| Argument | Required | What it is |
| --- | --- | --- |
| `word` | yes | the word to stop watching |

**Examples:**

```
.highlight remove my-project
```

### `.poll`

Separate options with `|` for a multiple-choice poll, up to 9 options. Without options it is a yes/no poll.

**Usage:** `.poll <question> [| option | option]`

| Argument | Required | What it is |
| --- | --- | --- |
| `question` | yes | the question, and options after a | |

**Examples:**

```
.poll pizza tonight?
.poll dinner? | pizza | sushi | tacos
```

> You need: `ManageMessages` · Bot needs: `AddReactions`

### `.reactionsnipe`

Show the most recent reaction added in this channel.

**Usage:** `.reactionsnipe [index]`

**Aliases:** `.rs`

| Argument | Required | What it is |
| --- | --- | --- |
| `index` | no | how far back to look |

**Examples:**

```
.reactionsnipe
```

### `.remind`

If your DMs are closed I will post the reminder in the channel you set it in instead.

**Usage:** `.remind <when> <what>`

**Aliases:** `.remindme`, `.reminder`

| Argument | Required | What it is |
| --- | --- | --- |
| `when` | yes | how far away, e.g. 30m or 2d |
| `what` | yes | what to remind you about |

**Examples:**

```
.remind 30m take the pizza out
.remind 2d renew the domain
```

### `.reminders`

List your pending reminders.

**Usage:** `.reminders`

**Examples:**

```
.reminders
```

### `.say`

Make the bot repeat something.

**Usage:** `.say <text>`

**Aliases:** `.echo`

| Argument | Required | What it is |
| --- | --- | --- |
| `text` | yes | what to say |

**Examples:**

```
.say hello everyone
```

> You need: `ManageMessages`

### `.snipe`

Pass a number to look further back — `snipe 3` shows the third most recent. Snipes are kept for one hour.

**Usage:** `.snipe [index]`

**Aliases:** `.s`

| Argument | Required | What it is |
| --- | --- | --- |
| `index` | no | how far back to look |

**Examples:**

```
.snipe
.snipe 2
```

### `.sticky`

I repost it whenever it scrolls away. Use `sticky remove` to stop.

**Usage:** `.sticky <message>`

| Argument | Required | What it is |
| --- | --- | --- |
| `message` | yes | the message to stick |

**Examples:**

```
.sticky Read the rules before posting
```

> You need: `ManageMessages`

### `.sticky remove`

Stop the sticky message in this channel.

**Usage:** `.sticky remove`

**Examples:**

```
.sticky remove
```

> You need: `ManageMessages`

### `.tag`

Tags are per-server. Create them with `tag create`, and they support all the message variables.

**Usage:** `.tag <name>`

**Aliases:** `.t`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | the tag name |

**Examples:**

```
.tag rules
```

### `.tag create`

Save a new tag.

**Usage:** `.tag create <name> <content>`

**Aliases:** `.tag add`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | a short name for the tag |
| `content` | yes | the text to save |

**Examples:**

```
.tag create rules Be nice. No spam.
```

> You need: `ManageMessages`

### `.tag delete`

Delete a tag.

**Usage:** `.tag delete <name>`

**Aliases:** `.tag remove`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | the tag to delete |

**Examples:**

```
.tag delete rules
```

> You need: `ManageMessages`

### `.tag edit`

Change what a tag says.

**Usage:** `.tag edit <name> <content>`

| Argument | Required | What it is |
| --- | --- | --- |
| `name` | yes | the tag to edit |
| `content` | yes | the new text |

**Examples:**

```
.tag edit rules Updated rules here
```

> You need: `ManageMessages`

### `.tags`

List every tag in this server.

**Usage:** `.tags`

**Aliases:** `.taglist`

**Examples:**

```
.tags
```

### `.timestamp`

Turn a duration into a Discord timestamp you can paste anywhere.

**Usage:** `.timestamp <duration>`

**Aliases:** `.ts`

| Argument | Required | What it is |
| --- | --- | --- |
| `duration` | yes | how far in the future, e.g. 2h |

**Examples:**

```
.timestamp 2h
.timestamp 3d
```

### `.todo`

Show your to-do list.

**Usage:** `.todo`

**Examples:**

```
.todo
```

### `.todo add`

Add something to your personal to-do list.

**Usage:** `.todo add <task>`

| Argument | Required | What it is |
| --- | --- | --- |
| `task` | yes | what to add |

**Examples:**

```
.todo add finish the bot
```

### `.todo done`

Tick off a to-do item.

**Usage:** `.todo done <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the item ID |

**Examples:**

```
.todo done 3
```

### `.todo remove`

Delete a to-do item.

**Usage:** `.todo remove <id>`

| Argument | Required | What it is |
| --- | --- | --- |
| `id` | yes | the item ID |

**Examples:**

```
.todo remove 3
```

### `.urban`

Results are user-written and often rude. Best kept to channels where that is fine.

**Usage:** `.urban <term>`

**Aliases:** `.ud`, `.urbandictionary`

| Argument | Required | What it is |
| --- | --- | --- |
| `term` | yes | what to look up |

**Examples:**

```
.urban yeet
```

### `.weather`

Needs an OpenWeather API key on the bot. Give a city, or "city, country code" to be specific.

**Usage:** `.weather <place>`

| Argument | Required | What it is |
| --- | --- | --- |
| `place` | yes | city name, optionally with a country code |

**Examples:**

```
.weather london
.weather paris, fr
```

## Voice

### `.voicemaster interface`

Post the button panel for controlling temporary voice channels.

**Usage:** `.voicemaster interface`

**Aliases:** `.vm interface`

**Examples:**

```
.voicemaster interface
```

> You need: `ManageGuild`

### `.voicemaster setup`

Anyone who joins the hub channel gets their own voice channel that they control, and it is deleted automatically when the last person leaves.

**Usage:** `.voicemaster setup <hub channel> [category]`

**Aliases:** `.vm setup`

| Argument | Required | What it is |
| --- | --- | --- |
| `channel` | yes | the join-to-create channel |
| `category` | no | where new channels are made |

**Examples:**

```
.voicemaster setup "Join to create"
```

> You need: `ManageGuild` · Bot needs: `ManageChannels`

## Settings reference

Change any of these with `.set <key> <value>`, or from the dashboard where each one is a form field.

### General

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `general.deleteInvocation` | boolean | `false` | Delete the message that triggered a prefix command. |
| `general.dmOnPunish` | boolean | `true` | Send a DM explaining the action when a member is punished. |
| `general.silentErrors` | boolean | `false` | React with ❌ instead of replying when a command errors. |
| `general.disabledCategories` | strings | — | Command categories that are switched off in this server. |

### Appearance

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `embed.color` | color | `"#8b5cf6"` | Used by every neutral/informational embed the bot sends. |
| `embed.success` | color | `"#3ba55d"` | Colour for confirmations, e.g. after a member is banned. |
| `embed.error` | color | `"#ed4245"` | Colour shown when a command fails or is used incorrectly. |
| `embed.warn` | color | `"#faa61a"` | Colour for warnings and confirmation prompts. |
| `embed.footer` | string | — | Appended to the footer of most embeds. Leave empty for none. |
| `embed.thumbnails` | boolean | `true` | Show avatars/icons as thumbnails on info embeds. |
| `embed.emojis` | boolean | `true` | Prefix success/error replies with an emoji. |

### Welcome

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `welcome.enabled` | boolean | `false` | Greet members when they join. |
| `welcome.channel` | channel | — | Where welcome messages are posted. |
| `welcome.message` | template | `"{embed}{color: #8b5cf6}$v{title: Welcome!}$v{description: W` | Plain text, or an embed script. Variables like {user.mention} are replaced. |
| `welcome.deleteAfter` | number | `0` | Auto-delete the welcome message. 0 keeps it forever. |
| `welcome.dm` | template | — | Optional direct message sent to new members. Empty disables it. |

### Goodbye

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `goodbye.enabled` | boolean | `false` | Post a message when a member leaves. |
| `goodbye.channel` | channel | — | Where leave messages are posted. |
| `goodbye.message` | template | `"**{user.name}** just left {guild.name}. We are now {guild.c` | Plain text or an embed script. |

### Boost

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `boost.enabled` | boolean | `false` | Thank members who boost the server. |
| `boost.channel` | channel | — | Where boost messages are posted. |
| `boost.message` | template | `"{embed}{color: #f47fff}$v{description: 💜 {user.mention} ju` | Plain text or an embed script. |

### Levels

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `levels.enabled` | boolean | `false` | Award XP for chatting and hand out level roles. |
| `levels.channel` | channel | — | Where level-up announcements go. Empty = the channel they spoke in. |
| `levels.message` | template | `"{user.mention} reached level **{level}**! 🎉"` | Supports {level}, {xp} and all user/guild variables. |
| `levels.announce` | select | `"channel"` | Where to announce a level up, or turn announcements off. |
| `levels.xpPerMessage` | number | `15` | Base XP granted per message (a small random bonus is added). |
| `levels.cooldown` | number | `60` | Minimum delay between two XP-earning messages. |
| `levels.multiplier` | number | `1` | Multiplies all XP gained in this server. |
| `levels.stackRoles` | boolean | `true` | Keep old level roles instead of replacing them. |
| `levels.ignoredChannels` | channels | — | No XP is earned in these channels. |
| `levels.ignoredRoles` | roles | — | Members with these roles earn no XP. |

### Logging

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `logs.enabled` | boolean | `false` | Master switch for every log type below. |
| `logs.channel` | channel | — | Used for any log type without its own channel. |
| `logs.moderation` | channel | — | Bans, kicks, mutes, warns, purges. |
| `logs.messages` | channel | — | Edited and deleted messages. |
| `logs.members` | channel | — | Joins, leaves, nickname and role changes. |
| `logs.server` | channel | — | Channel, role and emoji changes. |
| `logs.voice` | channel | — | Voice joins, leaves and moves. |
| `logs.ignoredChannels` | channels | — | Activity in these channels is never logged. |

### Automod

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `automod.enabled` | boolean | `false` | Master switch for the automatic content filters. |
| `automod.invites` | boolean | `false` | Delete messages containing Discord invite links. |
| `automod.links` | boolean | `false` | Delete messages containing any URL. |
| `automod.spam` | boolean | `false` | Punish members who send messages too quickly. |
| `automod.spamThreshold` | number | `5` | Messages within 5 seconds before anti-spam triggers. |
| `automod.caps` | boolean | `false` | Delete messages that are mostly uppercase. |
| `automod.capsThreshold` | number | `70` | Percentage of uppercase letters that counts as shouting. |
| `automod.mentions` | number | `0` | Mentions allowed per message. 0 disables the check. |
| `automod.emojis` | number | `0` | Emojis allowed per message. 0 disables the check. |
| `automod.words` | strings | — | Messages containing any of these words are deleted. |
| `automod.action` | select | `"delete"` | What happens to a member who trips a filter. |
| `automod.timeoutDuration` | number | `300` | How long the timeout punishment lasts. |
| `automod.exemptRoles` | roles | — | Members with these roles bypass automod. |
| `automod.exemptChannels` | channels | — | Automod never runs in these channels. |

### Antinuke

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `antinuke.enabled` | boolean | `false` | Watch for destructive admin actions and stop them. |
| `antinuke.punishment` | select | `"strip"` | What happens to someone who trips the antinuke. |
| `antinuke.threshold` | number | `3` | Destructive actions allowed within 60 seconds. |
| `antinuke.channelDelete` | boolean | `true` | Count mass channel deletions. |
| `antinuke.roleDelete` | boolean | `true` | Count mass role deletions. |
| `antinuke.bans` | boolean | `true` | Count rapid bans by a single moderator. |
| `antinuke.kicks` | boolean | `true` | Count rapid kicks by a single moderator. |
| `antinuke.webhooks` | boolean | `true` | Webhooks are the usual delivery method for nuke spam. |
| `antinuke.botAdd` | boolean | `false` | Kick any bot added by someone who is not whitelisted. |
| `antinuke.logChannel` | channel | — | Where antinuke alerts are posted. |

### Antiraid

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `antiraid.enabled` | boolean | `false` | React automatically to floods of new members. |
| `antiraid.joinThreshold` | number | `8` | Joins within 10 seconds that count as a raid. |
| `antiraid.action` | select | `"lockdown"` | What to do when a raid is detected. |
| `antiraid.minAccountAge` | number | `0` | Kick accounts younger than this. 0 disables the check. |
| `antiraid.noAvatar` | boolean | `false` | Kick joining members who have no custom avatar. |

### Starboard

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `starboard.enabled` | boolean | `false` | Repost popular messages to a highlights channel. |
| `starboard.channel` | channel | — | Where starred messages are reposted. |
| `starboard.emoji` | string | `"⭐"` | The reaction that counts as a star. |
| `starboard.threshold` | number | `3` | Stars needed before a message is reposted. |
| `starboard.selfStar` | boolean | `false` | Count the author’s own star. |
| `starboard.ignoredChannels` | channels | — | Messages here never reach the starboard. |

### Tickets

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `tickets.enabled` | boolean | `false` | Let members open private support channels. |
| `tickets.category` | category | — | New ticket channels are created here. |
| `tickets.supportRole` | role | — | Role granted access to every ticket. |
| `tickets.logChannel` | channel | — | Where transcripts are posted when a ticket closes. |
| `tickets.openMessage` | template | `"{embed}{color: #8b5cf6}$v{title: Support ticket}$v{descript` | Posted inside a new ticket. |
| `tickets.limit` | number | `1` | How many tickets one member may have open at once. |

### Economy

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `economy.enabled` | boolean | `true` | Currency, gambling, daily rewards and the shop. |
| `economy.symbol` | string | `"💵"` | Shown next to every balance. |
| `economy.currencyName` | string | `"coins"` | What your currency is called. |
| `economy.dailyAmount` | number | `500` | Base amount handed out by the daily command. |
| `economy.startingBalance` | number | `100` | What a member begins with. |

### Music

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `music.enabled` | boolean | `true` | Voice playback commands. |
| `music.djRole` | role | — | Required for skip/stop/volume when the queue is busy. |
| `music.defaultVolume` | number | `60` | Volume a fresh player starts at. |
| `music.maxQueue` | number | `200` | How many tracks can be queued at once. |
| `music.leaveOnEmpty` | boolean | `true` | Disconnect when the last listener leaves. |
| `music.textChannel` | channel | — | Restrict music commands to one channel. Empty = anywhere. |

### VoiceMaster

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `voicemaster.enabled` | boolean | `false` | Members get their own temporary voice channel. |
| `voicemaster.joinChannel` | channel | — | Joining this channel creates a personal one. |
| `voicemaster.category` | category | — | Where temporary channels are created. |
| `voicemaster.nameTemplate` | string | `"{user.name}'s channel"` | Name given to a new temporary channel. |
| `voicemaster.userLimit` | number | `0` | 0 means unlimited. |

### Moderation

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `moderation.muteRole` | role | — | Role applied by the mute command. Created automatically if unset. |
| `moderation.jailRole` | role | — | Role applied by the jail command. |
| `moderation.jailChannel` | channel | — | The only channel jailed members can see. |
| `moderation.warnThreshold` | number | `0` | Apply the punishment below at this many warns. 0 disables it. |
| `moderation.warnPunishment` | select | `"timeout"` | Applied once the warn threshold is reached. |
| `moderation.protectedRoles` | roles | — | Members with these roles cannot be punished by the bot. |
| `moderation.confirmDestructive` | boolean | `true` | Ask before strip, nuke, mass-ban and similar commands. |

### Autorole

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `autorole.enabled` | boolean | `false` | Give roles automatically when a member joins. |
| `autorole.roles` | roles | — | Granted to every human who joins. |
| `autorole.botRoles` | roles | — | Granted to bots that are added. |
| `autorole.delay` | number | `0` | Wait before granting roles — useful against raids. |

### Fun

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `fun.enabled` | boolean | `true` | Games, images and the silly commands. |
| `fun.snipeEnabled` | boolean | `true` | Let members recover recently deleted messages. |
| `fun.snipeIgnored` | channels | — | Deleted messages here are never stored. |
| `fun.afkEnabled` | boolean | `true` | Members can mark themselves away. |

## Message variables

These work in welcome, leave, boost, level-up, autoresponder, ticket and sticky messages.

| Variable | Value |
| --- | --- |
| `{user.mention}` | Pings the member (@name) |
| `{user.name}` | Username, without the tag |
| `{user.display}` | Server nickname, or username |
| `{user.tag}` | Full username#0000 handle |
| `{user.id}` | Their user ID |
| `{user.avatar}` | URL of their avatar |
| `{user.created}` | When the account was made |
| `{user.joined}` | When they joined the server |
| `{guild.name}` | Server name |
| `{guild.id}` | Server ID |
| `{guild.icon}` | URL of the server icon |
| `{guild.count}` | Current member count |
| `{guild.boosts}` | Number of boosts |
| `{guild.tier}` | Boost tier (0-3) |
| `{guild.owner}` | Server owner’s name |
| `{channel.name}` | Channel the message is posted in |
| `{channel.mention}` | Clickable channel link |
| `{level}` | New level (level-up messages only) |
| `{xp}` | Current XP (level-up messages only) |
| `{inviter.name}` | Who invited them (welcome messages only) |
| `{date}` | Today’s date |
| `{time}` | Current time |

### Embed scripts

Start a message with `{embed}` and separate parts with `$v`:

```
{embed}{color: #8b5cf6}$v{title: Welcome!}$v{description: Hi {user.mention}}$v{thumbnail: {user.avatar}}
```

Available parts: `content` `color` `title` `url` `description` `thumbnail` `image` `author` `footer` `field` `timestamp` `button`.

`author`, `footer` and `field` take several values separated by `&&`:

```
{footer: Some text && https://example.com/icon.png}
{field: Name && Value && true}
```

