'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../lib/db');
const { eph } = require('../../lib/reply');
const { random, randomInt, truncate, relative, now } = require('../../lib/util');
const emojis = require('../../lib/emojis');

const EIGHT_BALL = [
  'It is certain.', 'Without a doubt.', 'You may rely on it.', 'Yes, definitely.',
  'It is decidedly so.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
  'Signs point to yes.', 'Yes.', 'Reply hazy, try again.', 'Ask again later.',
  'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  "Don't count on it.", 'My reply is no.', 'My sources say no.',
  'Outlook not so good.', 'Very doubtful.',
];

/**
 * Deterministic per-pair percentage: the same two people always get the same
 * score, which is much funnier than a number that changes every time.
 */
function pairScore(a, b, salt = 0) {
  const [low, high] = [a, b].sort();
  let hash = salt;
  const key = `${low}:${high}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 101;
}

function bar(percent) {
  const filled = Math.round(percent / 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} **${percent}%**`;
}

module.exports = [
  {
    name: '8ball',
    aliases: ['eightball'],
    category: 'Fun',
    description: 'Ask the magic 8-ball a yes/no question.',
    usage: '<question>',
    examples: ['8ball will it rain tomorrow?'],
    args: [{ name: 'question', type: 'rest', required: true, description: 'your question' }],
    slash: true,
    async run(ctx) {
      return ctx.send({
        embeds: [
          ctx.embed({
            description: `🎱 **${truncate(ctx.args.question, 200)}**\n\n${random(EIGHT_BALL)}`,
          }),
        ],
      });
    },
  },

  {
    name: 'coin',
    aliases: ['toss'],
    category: 'Fun',
    description: 'Flip a coin (no betting).',
    examples: ['coin'],
    async run(ctx) {
      const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
      return ctx.send({ embeds: [ctx.embed({ description: `🪙 **${side}**` })] });
    },
  },

  {
    name: 'roll',
    aliases: ['dice'],
    category: 'Fun',
    description: 'Roll dice, in the usual NdN notation.',
    usage: '[NdN]',
    examples: ['roll', 'roll 2d20', 'roll d6'],
    args: [{ name: 'dice', type: 'string', required: false, default: '1d6', description: 'e.g. 2d20' }],
    async run(ctx) {
      const match = String(ctx.args.dice).match(/^(\d*)d(\d+)$/i);
      if (!match) return ctx.error('Use dice notation like `2d20` or `d6`.');

      const count = Math.min(20, Math.max(1, Number(match[1] || 1)));
      const sides = Math.min(1000, Math.max(2, Number(match[2])));
      const rolls = Array.from({ length: count }, () => randomInt(1, sides));
      const total = rolls.reduce((sum, value) => sum + value, 0);

      return ctx.send({
        embeds: [
          ctx.embed({
            description: `🎲 Rolling **${count}d${sides}**\n\n${rolls.join(' + ')}${count > 1 ? ` = **${total}**` : ` = **${total}**`}`,
          }),
        ],
      });
    },
  },

  {
    name: 'choose',
    aliases: ['pick'],
    category: 'Fun',
    description: 'Pick one of your options at random.',
    usage: '<option | option | ...>',
    examples: ['choose pizza | sushi | tacos'],
    args: [{ name: 'options', type: 'rest', required: true, description: 'options separated by |' }],
    async run(ctx) {
      const options = ctx.args.options.split('|').map((part) => part.trim()).filter(Boolean);
      if (options.length < 2) return ctx.error('Give me at least two options, separated by `|`.');
      return ctx.send({ embeds: [ctx.embed({ description: `🤔 I pick **${truncate(random(options), 200)}**` })] });
    },
  },

  {
    name: 'rps',
    category: 'Fun',
    description: 'Rock, paper, scissors against the bot.',
    usage: '<rock|paper|scissors>',
    examples: ['rps rock'],
    args: [{ name: 'choice', type: 'choice', required: true, choices: ['rock', 'paper', 'scissors'], description: 'your move' }],
    async run(ctx) {
      const options = ['rock', 'paper', 'scissors'];
      const icons = { rock: '🪨', paper: '📄', scissors: '✂️' };
      const mine = random(options);
      const yours = ctx.args.choice;

      const outcome =
        mine === yours ? 'draw' : (yours === 'rock' && mine === 'scissors') || (yours === 'paper' && mine === 'rock') || (yours === 'scissors' && mine === 'paper') ? 'win' : 'lose';

      return ctx.send({
        embeds: [
          ctx.embed({
            color: outcome === 'win' ? ctx.theme.successColor : outcome === 'lose' ? ctx.theme.errorColor : ctx.theme.primary,
            description:
              `You ${icons[yours]} vs ${icons[mine]} me\n\n` +
              `**${outcome === 'draw' ? "It's a draw!" : outcome === 'win' ? 'You win!' : 'I win!'}**`,
          }),
        ],
      });
    },
  },

  {
    name: 'ship',
    category: 'Fun',
    description: 'Calculate the compatibility of two people.',
    usage: '<member> [member]',
    examples: ['ship @user', 'ship @user @other'],
    args: [
      { name: 'first', type: 'user', required: true, description: 'the first person' },
      { name: 'second', type: 'user', required: false, description: 'the second person (defaults to you)' },
    ],
    async run(ctx) {
      const a = ctx.args.first;
      const b = ctx.args.second ?? ctx.user;
      if (a.id === b.id) return ctx.error('Self-love is important, but pick two different people.');

      const score = pairScore(a.id, b.id);
      const name = `${a.username.slice(0, Math.ceil(a.username.length / 2))}${b.username.slice(Math.floor(b.username.length / 2))}`;
      const verdict =
        score > 90 ? 'A perfect match. 💍' :
        score > 70 ? 'There is real potential here. 💕' :
        score > 50 ? 'Could work with effort. 🙂' :
        score > 25 ? 'Probably just friends. 🤝' :
        'Absolutely not. 💔';

      return ctx.send({
        embeds: [
          ctx.embed({
            title: `💘 ${a.username} + ${b.username}`,
            description: `**${name}**\n\n${bar(score)}\n${verdict}`,
          }),
        ],
      });
    },
  },

  {
    name: 'rate',
    category: 'Fun',
    description: 'Have the bot rate anything out of ten.',
    usage: '<thing>',
    examples: ['rate my new pfp'],
    args: [{ name: 'thing', type: 'rest', required: true, description: 'what to rate' }],
    async run(ctx) {
      const score = pairScore(ctx.args.thing.toLowerCase(), 'rate') % 11;
      return ctx.send({
        embeds: [ctx.embed({ description: `I rate **${truncate(ctx.args.thing, 150)}** a solid **${score}/10**.` })],
      });
    },
  },

  {
    name: 'howgay',
    aliases: ['gayrate'],
    category: 'Fun',
    description: 'A completely scientific percentage.',
    usage: '[member]',
    examples: ['howgay', 'howgay @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to measure' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const score = pairScore(user.id, 'rainbow', 7);
      return ctx.send({
        embeds: [ctx.embed({ description: `🏳️‍🌈 **${user.username}** is\n\n${bar(score)}` })],
      });
    },
  },

  {
    name: 'iq',
    category: 'Fun',
    description: 'Measure someone’s IQ with total accuracy.',
    usage: '[member]',
    examples: ['iq @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to measure' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const score = 50 + (pairScore(user.id, 'iq', 3) % 150);
      return ctx.send({ embeds: [ctx.embed({ description: `🧠 **${user.username}** has an IQ of **${score}**.` })] });
    },
  },

  {
    name: 'pp',
    category: 'Fun',
    description: 'The classic.',
    usage: '[member]',
    examples: ['pp @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to measure' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const size = pairScore(user.id, 'pp', 11) % 16;
      return ctx.send({
        embeds: [ctx.embed({ description: `**${user.username}**\n8${'='.repeat(size)}D` })],
      });
    },
  },

  {
    name: 'reverse',
    category: 'Fun',
    description: 'Reverse some text.',
    usage: '<text>',
    examples: ['reverse hello world'],
    guildOnly: false,
    args: [{ name: 'text', type: 'rest', required: true, description: 'the text to flip' }],
    async run(ctx) {
      return ctx.send({ embeds: [ctx.embed({ description: truncate([...ctx.args.text].reverse().join(''), 2000) })] });
    },
  },

  {
    name: 'mock',
    category: 'Fun',
    description: 'mOcK sOmE tExT.',
    usage: '<text>',
    examples: ['mock i love mondays'],
    guildOnly: false,
    args: [{ name: 'text', type: 'rest', required: true, description: 'the text to mock' }],
    async run(ctx) {
      const mocked = [...ctx.args.text].map((char, index) => (index % 2 ? char.toUpperCase() : char.toLowerCase())).join('');
      return ctx.send({ embeds: [ctx.embed({ description: truncate(mocked, 2000) })] });
    },
  },

  {
    name: 'emojify',
    category: 'Fun',
    description: 'Turn text into regional indicator emojis.',
    usage: '<text>',
    examples: ['emojify hello'],
    guildOnly: false,
    args: [{ name: 'text', type: 'rest', required: true, description: 'the text to convert' }],
    async run(ctx) {
      const converted = [...ctx.args.text.toLowerCase()]
        .map((char) => {
          if (/[a-z]/.test(char)) return `:regional_indicator_${char}:`;
          if (/\d/.test(char)) return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][Number(char)].replace(/^/, ':') + ':';
          if (char === ' ') return '  ';
          return char;
        })
        .join(' ');
      if (converted.length > 2000) return ctx.error('That is too long once converted. Try something shorter.');
      return ctx.send({ content: converted });
    },
  },

  {
    name: 'ascii',
    category: 'Fun',
    description: 'Show text in a big code block.',
    usage: '<text>',
    examples: ['ascii hello'],
    guildOnly: false,
    args: [{ name: 'text', type: 'rest', required: true, description: 'the text' }],
    async run(ctx) {
      return ctx.send({ content: `\`\`\`\n${truncate(ctx.args.text, 1900)}\n\`\`\`` });
    },
  },

  {
    name: 'rep',
    category: 'Fun',
    description: 'Give someone a reputation point. Once a day.',
    usage: '<member>',
    examples: ['rep @user'],
    args: [{ name: 'member', type: 'user', required: true, description: 'who to thank' }],
    async run(ctx) {
      if (ctx.args.member.id === ctx.user.id) return ctx.error('You cannot give yourself reputation.');
      if (ctx.args.member.bot) return ctx.error('Bots do not need your approval.');

      const giver = store.db.prepare('SELECT last_given FROM reputation WHERE guild_id = ? AND user_id = ?').get(ctx.guild.id, ctx.user.id);
      const elapsed = now() - (giver?.last_given ?? 0);
      if (elapsed < 86_400) {
        return ctx.error(`You can give reputation again <t:${(giver.last_given ?? 0) + 86_400}:R>.`);
      }

      store.db
        .prepare(
          `INSERT INTO reputation (guild_id, user_id, points) VALUES (?, ?, 1)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET points = points + 1`,
        )
        .run(ctx.guild.id, ctx.args.member.id);
      store.db
        .prepare(
          `INSERT INTO reputation (guild_id, user_id, last_given) VALUES (?, ?, ?)
           ON CONFLICT(guild_id, user_id) DO UPDATE SET last_given = excluded.last_given`,
        )
        .run(ctx.guild.id, ctx.user.id, now());

      const total = store.db.prepare('SELECT points FROM reputation WHERE guild_id = ? AND user_id = ?').get(ctx.guild.id, ctx.args.member.id).points;
      return ctx.success(`You gave **${ctx.args.member.username}** a reputation point — they now have **${total}**.`);
    },
  },

  {
    name: 'reputation',
    aliases: ['reps'],
    category: 'Fun',
    description: 'Check someone’s reputation.',
    usage: '[member]',
    examples: ['reputation @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose reputation' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const row = store.db.prepare('SELECT points FROM reputation WHERE guild_id = ? AND user_id = ?').get(ctx.guild.id, user.id);
      return ctx.info(`**${user.username}** has **${row?.points ?? 0}** reputation point(s).`);
    },
  },

  {
    name: 'marry',
    category: 'Fun',
    description: 'Propose to another member.',
    usage: '<member>',
    examples: ['marry @user'],
    args: [{ name: 'member', type: 'user', required: true, description: 'who to propose to' }],
    async run(ctx) {
      const partner = ctx.args.member;
      if (partner.id === ctx.user.id) return ctx.error('You cannot marry yourself.');
      if (partner.bot) return ctx.error('Bots are married to their work.');

      const existing = store.db
        .prepare('SELECT * FROM marriages WHERE guild_id = ? AND (user_a = ? OR user_b = ?)')
        .get(ctx.guild.id, ctx.user.id, ctx.user.id);
      if (existing) return ctx.error('You are already married. Use `divorce` first.');

      const theirs = store.db
        .prepare('SELECT * FROM marriages WHERE guild_id = ? AND (user_a = ? OR user_b = ?)')
        .get(ctx.guild.id, partner.id, partner.id);
      if (theirs) return ctx.error(`**${partner.username}** is already married.`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('marry:yes').setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('marry:no').setLabel('Decline').setStyle(ButtonStyle.Secondary),
      );

      const proposal = await ctx.send({
        content: `${partner}`,
        embeds: [
          ctx.embed({
            title: '💍 A proposal',
            description: `**${ctx.user.username}** wants to marry you, ${partner}.\nYou have 60 seconds to answer.`,
          }),
        ],
        components: [row],
        allowedMentions: { users: [partner.id] },
      });

      // Only the person being proposed to gets to answer.
      const answer = await proposal
        .awaitMessageComponent({
          time: 60_000,
          filter: (interaction) => {
            if (interaction.user.id !== partner.id) {
              interaction.reply(eph({ content: `Only ${partner.username} can answer this.` })).catch(() => {});
              return false;
            }
            return true;
          },
        })
        .catch(() => null);

      await proposal.edit({ components: [] }).catch(() => {});

      if (!answer) return ctx.send({ embeds: [ctx.theme.warn('No answer in time. Awkward.')] });
      if (answer.customId === 'marry:no') {
        return answer.update({ embeds: [ctx.theme.error(`**${partner.username}** said no. 💔`)], components: [] });
      }
      await answer.deferUpdate().catch(() => {});

      store.db.prepare('INSERT INTO marriages (guild_id, user_a, user_b) VALUES (?, ?, ?)').run(ctx.guild.id, ctx.user.id, partner.id);
      return ctx.success(`🎉 **${ctx.user.username}** and **${partner.username}** are now married!`);
    },
  },

  {
    name: 'divorce',
    category: 'Fun',
    description: 'End a marriage.',
    examples: ['divorce'],
    async run(ctx) {
      const marriage = store.db
        .prepare('SELECT * FROM marriages WHERE guild_id = ? AND (user_a = ? OR user_b = ?)')
        .get(ctx.guild.id, ctx.user.id, ctx.user.id);
      if (!marriage) return ctx.error('You are not married.');

      store.db.prepare('DELETE FROM marriages WHERE guild_id = ? AND user_a = ? AND user_b = ?').run(ctx.guild.id, marriage.user_a, marriage.user_b);
      return ctx.success('💔 Divorced. Sorry it did not work out.');
    },
  },

  {
    name: 'marriage',
    category: 'Fun',
    description: 'Check who someone is married to.',
    usage: '[member]',
    examples: ['marriage @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to check' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const marriage = store.db
        .prepare('SELECT * FROM marriages WHERE guild_id = ? AND (user_a = ? OR user_b = ?)')
        .get(ctx.guild.id, user.id, user.id);
      if (!marriage) return ctx.info(`**${user.username}** is not married.`);

      const partnerId = marriage.user_a === user.id ? marriage.user_b : marriage.user_a;
      return ctx.send({
        embeds: [
          ctx.embed({ description: `💍 **${user.username}** is married to <@${partnerId}>\nSince ${relative(marriage.since * 1000)}` }),
        ],
      });
    },
  },

  {
    name: 'roast',
    category: 'Fun',
    description: 'A light-hearted roast.',
    usage: '[member]',
    examples: ['roast @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to roast' }],
    async run(ctx) {
      const roasts = [
        'writes code that only works on their machine.',
        'has a browser with 47 tabs open and no idea why.',
        'still uses light mode. In this economy.',
        'says "I will fix it later" and never does.',
        'types with two fingers and calls it touch typing.',
        'has more unread notifications than friends.',
        'replies "k" to paragraphs.',
        'thinks the cloud is a place in the sky.',
      ];
      const user = ctx.args.member ?? ctx.user;
      return ctx.send({ embeds: [ctx.embed({ description: `🔥 **${user.username}** ${random(roasts)}` })] });
    },
  },

  {
    name: 'compliment',
    category: 'Fun',
    description: 'Say something nice.',
    usage: '[member]',
    examples: ['compliment @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'who to compliment' }],
    async run(ctx) {
      const compliments = [
        'has genuinely good taste.',
        'makes this server better just by being here.',
        'could explain anything to anyone.',
        'is the reason the group chat is still alive.',
        'has never once been cringe. Not even once.',
        'writes commit messages other people can actually read.',
      ];
      const user = ctx.args.member ?? ctx.user;
      return ctx.send({ embeds: [ctx.embed({ description: `${emojis.sparkle} **${user.username}** ${random(compliments)}` })] });
    },
  },

  {
    name: 'wyr',
    aliases: ['wouldyourather'],
    category: 'Fun',
    description: 'Get a would-you-rather question.',
    examples: ['wyr'],
    async run(ctx) {
      const questions = [
        'have unlimited money but no friends, or unlimited friends but no money?',
        'always be 10 minutes late or always 20 minutes early?',
        'be able to fly but only 1 metre off the ground, or run at 100km/h but only backwards?',
        'never use a search engine again, or never use a messaging app again?',
        'know when you will die, or how you will die?',
        'have every song you hear be your favourite, or never hear music again?',
      ];
      return ctx.send({ embeds: [ctx.embed({ title: '🤷 Would you rather…', description: random(questions) })] });
    },
  },

  {
    name: 'guess',
    category: 'Fun',
    description: 'Guess the number I am thinking of, between 1 and 100.',
    examples: ['guess'],
    cooldown: 10,
    async run(ctx) {
      const target = randomInt(1, 100);
      await ctx.send({
        embeds: [ctx.embed({ description: '🔢 I am thinking of a number between **1** and **100**. You have 5 guesses and 60 seconds.' })],
      });

      const collector = ctx.channel.createMessageCollector({
        filter: (message) => message.author.id === ctx.user.id && /^\d{1,3}$/.test(message.content),
        time: 60_000,
        max: 5,
      });

      let guesses = 0;
      collector.on('collect', async (message) => {
        guesses += 1;
        const value = Number(message.content);
        if (value === target) {
          collector.stop('won');
          await ctx.channel.send({ embeds: [ctx.theme.success(`Got it in **${guesses}** guess(es) — it was **${target}**.`)] });
          return;
        }
        await message.react(value < target ? '⬆️' : '⬇️').catch(() => {});
      });

      collector.on('end', (collected, reason) => {
        if (reason !== 'won') {
          ctx.channel.send({ embeds: [ctx.theme.error(`Out of guesses — it was **${target}**.`)] }).catch(() => {});
        }
      });
      return undefined;
    },
  },
];
