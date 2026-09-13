'use strict';

const eco = require('../../modules/economy');
const store = require('../../lib/db');
const { formatDuration, formatNumber, randomInt, random, truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');

/** Parse "500", "all" or "half" into an actual number. */
function parseAmount(raw, available) {
  const text = String(raw).toLowerCase().replace(/,/g, '');
  if (['all', 'max'].includes(text)) return available;
  if (text === 'half') return Math.floor(available / 2);
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

module.exports = [
  {
    name: 'balance',
    aliases: ['bal', 'money', 'wallet'],
    category: 'Economy',
    description: 'Check how much you (or someone else) has.',
    usage: '[member]',
    examples: ['balance', 'balance @user'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose balance to check' }],
    slash: true,
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const wallet = eco.balance(ctx.guild.id, user.id);
      const rank = store.db
        .prepare('SELECT COUNT(*) + 1 AS position FROM economy WHERE guild_id = ? AND (cash + bank) > ?')
        .get(ctx.guild.id, wallet.total).position;

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: user.tag, iconURL: user.displayAvatarURL() },
            fields: [
              { name: 'Cash', value: eco.money(ctx.guild.id, wallet.cash), inline: true },
              { name: 'Bank', value: eco.money(ctx.guild.id, wallet.bank), inline: true },
              { name: 'Net worth', value: eco.money(ctx.guild.id, wallet.total), inline: true },
            ],
            footer: { text: `Rank #${rank} in ${ctx.guild.name}` },
          }),
        ],
      });
    },
  },

  {
    name: 'daily',
    category: 'Economy',
    description: 'Claim your daily reward. Claim on consecutive days to build a streak.',
    details: 'Each day in a row adds 10% to the payout, up to double. Missing a day resets the streak.',
    examples: ['daily'],
    slash: true,
    async run(ctx) {
      const result = eco.daily(ctx.guild.id, ctx.user.id);
      if (!result.ok) return ctx.error(`You already claimed today — come back in **${formatDuration(result.remaining)}**.`);

      return ctx.success(
        `You claimed ${eco.money(ctx.guild.id, result.amount)}` +
          (result.bonus ? ` (**+${result.bonus}%** streak bonus)` : '') +
          `\n🔥 **${result.streak}** day streak`,
      );
    },
  },

  {
    name: 'work',
    category: 'Economy',
    description: 'Do a job for some cash. Once per hour.',
    examples: ['work'],
    async run(ctx) {
      const result = eco.work(ctx.guild.id, ctx.user.id);
      if (!result.ok) return ctx.error(`You are tired — rest for **${formatDuration(result.remaining)}**.`);
      return ctx.success(`You ${result.job} and earned ${eco.money(ctx.guild.id, result.amount)}.`);
    },
  },

  {
    name: 'crime',
    category: 'Economy',
    description: 'Risk a fine for a bigger payout. Once every two hours.',
    examples: ['crime'],
    async run(ctx) {
      const result = eco.crime(ctx.guild.id, ctx.user.id);
      if (!result.ok) return ctx.error(`Lay low for another **${formatDuration(result.remaining)}**.`);

      if (result.success) return ctx.success(`You got away with it and made ${eco.money(ctx.guild.id, result.amount)}.`);
      return ctx.error(`You got caught and were fined ${eco.money(ctx.guild.id, result.amount)}.`);
    },
  },

  {
    name: 'rob',
    category: 'Economy',
    description: 'Try to steal cash from another member. Fails often.',
    usage: '<member>',
    examples: ['rob @user'],
    args: [{ name: 'member', type: 'user', required: true, description: 'who to rob' }],
    async run(ctx) {
      if (ctx.args.member.id === ctx.user.id) return ctx.error('You cannot rob yourself.');
      if (ctx.args.member.bot) return ctx.error('Bots keep their money in the cloud.');

      const result = eco.rob(ctx.guild.id, ctx.user.id, ctx.args.member.id);
      if (!result.ok) {
        return ctx.error(
          result.reason ? `You cannot rob them — ${result.reason}.` : `Wait **${formatDuration(result.remaining)}** before robbing again.`,
        );
      }

      if (result.success) {
        return ctx.success(`You robbed **${ctx.args.member.username}** for ${eco.money(ctx.guild.id, result.amount)}.`);
      }
      return ctx.error(`You were caught and paid ${eco.money(ctx.guild.id, result.amount)} in damages.`);
    },
  },

  {
    name: 'pay',
    aliases: ['give', 'transfer'],
    category: 'Economy',
    description: 'Send cash to another member.',
    usage: '<member> <amount>',
    examples: ['pay @user 500', 'pay @user all'],
    args: [
      { name: 'member', type: 'user', required: true, description: 'who to pay' },
      { name: 'amount', type: 'string', required: true, description: 'how much, or `all` / `half`' },
    ],
    async run(ctx) {
      if (ctx.args.member.id === ctx.user.id) return ctx.error('Paying yourself achieves very little.');

      const wallet = eco.balance(ctx.guild.id, ctx.user.id);
      const amount = parseAmount(ctx.args.amount, wallet.cash);
      if (!amount) return ctx.error('Give me a positive amount, or `all`.');

      const result = eco.transfer(ctx.guild.id, ctx.user.id, ctx.args.member.id, amount);
      if (!result.ok) return ctx.error(`You cannot do that — ${result.reason}.`);

      return ctx.success(`You sent ${eco.money(ctx.guild.id, amount)} to **${ctx.args.member.username}**.`);
    },
  },

  {
    name: 'deposit',
    aliases: ['dep'],
    category: 'Economy',
    description: 'Move cash into the bank, where it cannot be stolen.',
    usage: '<amount>',
    examples: ['deposit 1000', 'deposit all'],
    args: [{ name: 'amount', type: 'string', required: true, description: 'how much, or `all` / `half`' }],
    async run(ctx) {
      const wallet = eco.balance(ctx.guild.id, ctx.user.id);
      const amount = parseAmount(ctx.args.amount, wallet.cash);
      if (!amount) return ctx.error('Give me a positive amount, or `all`.');

      const result = eco.deposit(ctx.guild.id, ctx.user.id, amount);
      if (!result.ok) return ctx.error(`Nothing happened — ${result.reason}.`);
      return ctx.success(`Deposited ${eco.money(ctx.guild.id, result.amount)}.`);
    },
  },

  {
    name: 'withdraw',
    aliases: ['with'],
    category: 'Economy',
    description: 'Take cash back out of the bank.',
    usage: '<amount>',
    examples: ['withdraw 1000', 'withdraw all'],
    args: [{ name: 'amount', type: 'string', required: true, description: 'how much, or `all` / `half`' }],
    async run(ctx) {
      const wallet = eco.balance(ctx.guild.id, ctx.user.id);
      const amount = parseAmount(ctx.args.amount, wallet.bank);
      if (!amount) return ctx.error('Give me a positive amount, or `all`.');

      const result = eco.withdraw(ctx.guild.id, ctx.user.id, amount);
      if (!result.ok) return ctx.error(`Nothing happened — ${result.reason}.`);
      return ctx.success(`Withdrew ${eco.money(ctx.guild.id, result.amount)}.`);
    },
  },

  {
    name: 'gamble',
    aliases: ['bet'],
    category: 'Economy',
    description: 'Bet your cash on a roll of the dice.',
    details: 'Roll higher than the house and you double up. It is a coin flip with extra steps — the house edge is small but real.',
    usage: '<amount>',
    examples: ['gamble 500', 'gamble all'],
    cooldown: 5,
    args: [{ name: 'amount', type: 'string', required: true, description: 'how much to bet' }],
    async run(ctx) {
      const wallet = eco.balance(ctx.guild.id, ctx.user.id);
      const amount = parseAmount(ctx.args.amount, wallet.cash);
      if (!amount) return ctx.error('Give me a positive amount, or `all`.');
      if (amount > wallet.cash) return ctx.error('You do not have that much cash on hand.');

      const you = randomInt(1, 100);
      const house = randomInt(1, 100);
      const won = you > house;

      eco.addCash(ctx.guild.id, ctx.user.id, won ? amount : -amount);

      return ctx.send({
        embeds: [
          ctx.embed({
            color: won ? ctx.theme.successColor : ctx.theme.errorColor,
            title: won ? '🎲 You win!' : '🎲 You lose',
            description:
              `You rolled **${you}**, the house rolled **${house}**.\n` +
              `${won ? 'Won' : 'Lost'} ${eco.money(ctx.guild.id, amount)}\n` +
              `New balance: ${eco.money(ctx.guild.id, eco.balance(ctx.guild.id, ctx.user.id).cash)}`,
          }),
        ],
      });
    },
  },

  {
    name: 'slots',
    category: 'Economy',
    description: 'Play the slot machine.',
    usage: '<amount>',
    examples: ['slots 200'],
    cooldown: 5,
    args: [{ name: 'amount', type: 'string', required: true, description: 'how much to bet' }],
    async run(ctx) {
      const wallet = eco.balance(ctx.guild.id, ctx.user.id);
      const amount = parseAmount(ctx.args.amount, wallet.cash);
      if (!amount) return ctx.error('Give me a positive amount, or `all`.');
      if (amount > wallet.cash) return ctx.error('You do not have that much cash on hand.');

      const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
      const reels = [random(symbols), random(symbols), random(symbols)];

      let multiplier = 0;
      if (reels[0] === reels[1] && reels[1] === reels[2]) multiplier = reels[0] === '7️⃣' ? 10 : 5;
      else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) multiplier = 1.5;

      const change = multiplier ? Math.round(amount * multiplier) - amount : -amount;
      eco.addCash(ctx.guild.id, ctx.user.id, change);

      return ctx.send({
        embeds: [
          ctx.embed({
            color: multiplier ? ctx.theme.successColor : ctx.theme.errorColor,
            title: `${reels.join(' ')}`,
            description: multiplier
              ? `**${multiplier}×** — you won ${eco.money(ctx.guild.id, change)}`
              : `No match — you lost ${eco.money(ctx.guild.id, amount)}`,
            footer: { text: `Balance: ${eco.balance(ctx.guild.id, ctx.user.id).cash.toLocaleString('en-US')}` },
          }),
        ],
      });
    },
  },

  {
    name: 'coinflip',
    aliases: ['cf', 'flip'],
    category: 'Economy',
    description: 'Bet on heads or tails.',
    usage: '<heads|tails> <amount>',
    examples: ['coinflip heads 250'],
    cooldown: 5,
    args: [
      { name: 'side', type: 'choice', required: true, choices: ['heads', 'tails'], description: 'heads or tails' },
      { name: 'amount', type: 'string', required: true, description: 'how much to bet' },
    ],
    async run(ctx) {
      const wallet = eco.balance(ctx.guild.id, ctx.user.id);
      const amount = parseAmount(ctx.args.amount, wallet.cash);
      if (!amount) return ctx.error('Give me a positive amount, or `all`.');
      if (amount > wallet.cash) return ctx.error('You do not have that much cash on hand.');

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === ctx.args.side;
      eco.addCash(ctx.guild.id, ctx.user.id, won ? amount : -amount);

      return ctx.send({
        embeds: [
          ctx.embed({
            color: won ? ctx.theme.successColor : ctx.theme.errorColor,
            description:
              `🪙 It landed on **${result}**.\n` +
              `${won ? `You won ${eco.money(ctx.guild.id, amount)}` : `You lost ${eco.money(ctx.guild.id, amount)}`}`,
          }),
        ],
      });
    },
  },

  {
    name: 'richest',
    aliases: ['baltop', 'moneylb'],
    category: 'Economy',
    description: 'The richest members in the server.',
    examples: ['richest'],
    async run(ctx) {
      const rows = eco.leaderboard(ctx.guild.id, 100).filter((row) => row.net > 0);
      if (!rows.length) return ctx.info('Nobody has any money yet.');

      const medals = ['🥇', '🥈', '🥉'];
      return ctx.paginateRows(
        rows.map((row, index) => `${medals[index] ?? ''} <@${row.user_id}> ${emojis.dot} ${eco.money(ctx.guild.id, row.net)}`),
        { perPage: 10, title: `${emojis.coin} Richest members` },
      );
    },
  },

  {
    name: 'shop',
    category: 'Economy',
    description: 'Browse what is for sale in this server.',
    examples: ['shop'],
    async run(ctx) {
      const items = eco.items(ctx.guild.id);
      if (!items.length) return ctx.info(`The shop is empty. Admins can add items with \`${ctx.prefix}shop add\`.`);

      return ctx.paginateRows(
        items.map(
          (item) =>
            `**${item.name}** — ${eco.money(ctx.guild.id, item.price)}\n` +
            ` └ \`${item.id}\` ${item.description ? `${truncate(item.description, 70)} ` : ''}` +
            `${item.role_id ? `${emojis.dot} grants <@&${item.role_id}>` : ''}${item.stock >= 0 ? ` ${emojis.dot} ${item.stock} left` : ''}`,
        ),
        { perPage: 6, title: '🛒 Shop', description: `Buy something with \`${ctx.prefix}buy <id>\``, numbered: false },
      );
    },
  },

  {
    name: 'shop add',
    category: 'Economy',
    description: 'Add an item to the shop.',
    details: 'If you attach a role, buying the item grants that role immediately.',
    usage: '<price> <name> | [description] | [role]',
    examples: ['shop add 5000 VIP | access to #vip | @VIP'],
    permissions: ['ManageGuild'],
    args: [
      { name: 'price', type: 'integer', required: true, description: 'cost in currency' },
      { name: 'rest', type: 'rest', required: true, description: 'name | description | role' },
    ],
    async run(ctx) {
      const [name, description, roleText] = ctx.args.rest.split('|').map((part) => part.trim());
      if (!name) return ctx.usage('Give the item a name.');
      if (ctx.args.price < 1) return ctx.error('Price must be at least **1**.');

      let roleId = null;
      if (roleText) {
        const role = require('../../lib/arguments').resolveRole(ctx.guild, roleText);
        if (!role) return ctx.error(`I could not find a role called **${truncate(roleText, 40)}**.`);
        if (ctx.me.roles.highest.comparePositionTo(role) <= 0) return ctx.error(`**${role.name}** is above my highest role.`);
        roleId = role.id;
      }

      const id = eco.addItem(ctx.guild.id, { name, price: ctx.args.price, description, roleId });
      return ctx.success(`Added **${name}** to the shop as item \`${id}\`.`);
    },
  },

  {
    name: 'shop remove',
    category: 'Economy',
    description: 'Remove an item from the shop.',
    usage: '<id>',
    examples: ['shop remove 3'],
    permissions: ['ManageGuild'],
    args: [{ name: 'id', type: 'integer', required: true, description: 'the item ID' }],
    async run(ctx) {
      if (!eco.removeItem(ctx.guild.id, ctx.args.id)) return ctx.error('No item with that ID.');
      return ctx.success('Item removed from the shop.');
    },
  },

  {
    name: 'buy',
    category: 'Economy',
    description: 'Buy something from the shop.',
    usage: '<id>',
    examples: ['buy 3'],
    args: [{ name: 'id', type: 'integer', required: true, description: 'the item ID from `shop`' }],
    async run(ctx) {
      const result = eco.buy(ctx.guild.id, ctx.user.id, ctx.args.id);
      if (!result.ok) return ctx.error(`Purchase failed — ${result.reason}.`);

      if (result.item.role_id) {
        const role = ctx.guild.roles.cache.get(result.item.role_id);
        if (role) await ctx.member.roles.add(role, 'Shop purchase').catch(() => {});
      }
      return ctx.success(`You bought **${result.item.name}** for ${eco.money(ctx.guild.id, result.item.price)}.`);
    },
  },

  {
    name: 'inventory',
    aliases: ['inv'],
    category: 'Economy',
    description: 'See what you have bought.',
    usage: '[member]',
    examples: ['inventory'],
    args: [{ name: 'member', type: 'user', required: false, description: 'whose inventory' }],
    async run(ctx) {
      const user = ctx.args.member ?? ctx.user;
      const items = eco.inventory(ctx.guild.id, user.id);
      if (!items.length) return ctx.info(`**${user.username}** has not bought anything yet.`);

      return ctx.send({
        embeds: [
          ctx.embed({
            author: { name: `${user.tag} — inventory`, iconURL: user.displayAvatarURL() },
            description: items.map((item) => `**${item.name}** ×${item.amount}`).join('\n'),
          }),
        ],
      });
    },
  },

  {
    name: 'addmoney',
    category: 'Economy',
    description: 'Give a member money out of thin air.',
    usage: '<member> <amount>',
    examples: ['addmoney @user 1000'],
    permissions: ['Administrator'],
    args: [
      { name: 'member', type: 'user', required: true, description: 'who to pay' },
      { name: 'amount', type: 'integer', required: true, description: 'how much (negative to take)' },
    ],
    async run(ctx) {
      eco.addCash(ctx.guild.id, ctx.args.member.id, ctx.args.amount);
      return ctx.success(
        `${ctx.args.amount >= 0 ? 'Gave' : 'Took'} ${eco.money(ctx.guild.id, Math.abs(ctx.args.amount))} ` +
          `${ctx.args.amount >= 0 ? 'to' : 'from'} **${ctx.args.member.tag}**.`,
      );
    },
  },

  {
    name: 'reseteconomy',
    category: 'Economy',
    description: 'Wipe all balances in the server.',
    examples: ['reseteconomy'],
    permissions: ['Administrator'],
    serverOwnerOnly: true,
    async run(ctx) {
      const total = store.db.prepare('SELECT COUNT(*) AS total FROM economy WHERE guild_id = ?').get(ctx.guild.id).total;
      const confirmed = await ctx.confirm({
        title: 'Reset the economy',
        description: `Every balance and inventory will be wiped — **${formatNumber(total)}** account(s).`,
        confirmLabel: 'Wipe it all',
      });
      if (!confirmed) return undefined;

      store.db.prepare('DELETE FROM economy WHERE guild_id = ?').run(ctx.guild.id);
      store.db.prepare('DELETE FROM inventory WHERE guild_id = ?').run(ctx.guild.id);
      return ctx.success(`Wiped **${formatNumber(total)}** account(s).`);
    },
  },
];
