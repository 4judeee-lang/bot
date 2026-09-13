'use strict';

const store = require('../../lib/db');
const giveaways = require('../../modules/giveaways');
const { formatDuration, truncate, relative } = require('../../lib/util');
const emojis = require('../../lib/emojis');

module.exports = [
  {
    name: 'giveaway start',
    aliases: ['gstart'],
    category: 'Giveaways',
    description: 'Start a giveaway people enter with a button.',
    details:
      'The entry count updates live. When the timer runs out I pick the winners at random and ping them. ' +
      'Use `giveaway reroll` if a winner does not claim.',
    usage: '<duration> <winners> <prize>',
    examples: ['giveaway start 1h 1 Nitro Classic', 'giveaway start 3d 3 Steam key'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'duration', type: 'duration', required: true, description: 'how long it runs, e.g. 1h or 3d' },
      { name: 'winners', type: 'integer', required: true, description: 'how many winners' },
      { name: 'prize', type: 'rest', required: true, description: 'what they win' },
    ],
    async run(ctx) {
      const { duration, winners, prize } = ctx.args;
      if (duration < 60) return ctx.error('Giveaways must run for at least **1 minute**.');
      if (duration > 31_536_000) return ctx.error('Giveaways cannot run for more than **1 year**.');
      if (winners < 1 || winners > 20) return ctx.error('Pick between **1** and **20** winners.');

      const { message } = await giveaways.create(ctx, { prize: truncate(prize, 200), seconds: duration, winners });
      return ctx.success(`Giveaway started — ends in **${formatDuration(duration)}**. [Jump](${message.url})`);
    },
  },

  {
    name: 'giveaway end',
    aliases: ['gend'],
    category: 'Giveaways',
    description: 'End a giveaway early and draw the winners now.',
    usage: '<message id>',
    examples: ['giveaway end 123456789012345678'],
    permissions: ['ManageGuild'],
    args: [{ name: 'message', type: 'string', required: true, description: 'the giveaway message ID' }],
    async run(ctx) {
      const giveaway = store.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND message_id = ?').get(ctx.guild.id, ctx.args.message);
      if (!giveaway) return ctx.error('No giveaway with that message ID.');
      if (giveaway.ended) return ctx.error('That giveaway has already ended.');

      const winners = await giveaways.end(ctx.client, giveaway);
      return ctx.success(winners.length ? `Ended it — ${winners.map((id) => `<@${id}>`).join(', ')} won.` : 'Ended it — nobody entered.');
    },
  },

  {
    name: 'giveaway reroll',
    aliases: ['greroll'],
    category: 'Giveaways',
    description: 'Draw a new winner for a finished giveaway.',
    usage: '<message id> [winners]',
    examples: ['giveaway reroll 123456789012345678'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'message', type: 'string', required: true, description: 'the giveaway message ID' },
      { name: 'count', type: 'integer', required: false, default: 1, description: 'how many new winners' },
    ],
    async run(ctx) {
      const giveaway = store.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND message_id = ?').get(ctx.guild.id, ctx.args.message);
      if (!giveaway) return ctx.error('No giveaway with that message ID.');
      if (!giveaway.ended) return ctx.error('That giveaway has not ended yet.');

      const winners = giveaways.pickWinners(giveaway.id, ctx.args.count);
      if (!winners.length) return ctx.error('There is nobody left to pick from.');

      const channel = ctx.guild.channels.cache.get(giveaway.channel_id) ?? ctx.channel;
      await channel.send({
        content: winners.map((id) => `<@${id}>`).join(' '),
        embeds: [ctx.theme.success(`${emojis.gift} Rerolled! You won **${giveaway.prize}**.`)],
        allowedMentions: { users: winners },
      });
      return ctx.success(`Rerolled — ${winners.map((id) => `<@${id}>`).join(', ')}.`);
    },
  },

  {
    name: 'giveaway list',
    aliases: ['glist'],
    category: 'Giveaways',
    description: 'Show the giveaways running right now.',
    examples: ['giveaway list'],
    async run(ctx) {
      const rows = store.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC').all(ctx.guild.id);
      if (!rows.length) return ctx.info('No giveaways are running.');

      return ctx.paginateRows(
        rows.map(
          (row) =>
            `**${truncate(row.prize, 60)}** in <#${row.channel_id}>\n` +
            ` └ ends ${relative(row.ends_at * 1000)} ${emojis.dot} ${giveaways.entryCount(row.id)} entries ${emojis.dot} \`${row.message_id}\``,
        ),
        { perPage: 6, title: `${emojis.gift} Active giveaways`, numbered: false },
      );
    },
  },

  {
    name: 'giveaway cancel',
    category: 'Giveaways',
    description: 'Cancel a giveaway without picking a winner.',
    usage: '<message id>',
    examples: ['giveaway cancel 123456789012345678'],
    permissions: ['ManageGuild'],
    args: [{ name: 'message', type: 'string', required: true, description: 'the giveaway message ID' }],
    async run(ctx) {
      const giveaway = store.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND message_id = ?').get(ctx.guild.id, ctx.args.message);
      if (!giveaway) return ctx.error('No giveaway with that message ID.');

      const confirmed = await ctx.confirm({
        title: 'Cancel giveaway',
        description: `**${truncate(giveaway.prize, 100)}** will be cancelled and nobody will win.`,
      });
      if (!confirmed) return undefined;

      store.db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);
      const channel = ctx.guild.channels.cache.get(giveaway.channel_id);
      const message = await channel?.messages.fetch(giveaway.message_id).catch(() => null);
      if (message) {
        await message
          .edit({
            embeds: [ctx.theme.base({ color: ctx.theme.errorColor, title: `${emojis.gift} ${giveaway.prize}`, description: 'This giveaway was cancelled.' })],
            components: giveaways.components(true),
          })
          .catch(() => {});
      }
      return ctx.success('Giveaway cancelled.');
    },
  },
];
