'use strict';

const store = require('../../lib/db');
const mod = require('../../lib/moderation');
const { truncate } = require('../../lib/util');

module.exports = [
  {
    // A three-word name, so it reads as a sentence. `phrase: true` lets it be
    // typed with no prefix at all — the dispatcher only allows that for
    // commands that ask for it, and stays silent when the person who typed it
    // could not have run it anyway.
    name: 'perish from existence',
    aliases: ['perish'],
    phrase: true,
    category: 'Moderation',
    description: 'Ban someone, with style.',
    details:
      'Does exactly what `ban` does — same permission check, same role-hierarchy rules, same case number '
      + 'in the mod log — but answers with your own line instead of the usual confirmation.\n\n'
      + 'This one can be typed **without a prefix**: `perish from existence @user` works on its own. Anyone '
      + 'without Ban Members is ignored rather than told off, so the phrase in ordinary conversation does '
      + 'nothing.\n\n'
      + 'Change the reply with the `fun.perishReply` setting, or turn the no-prefix form off with '
      + '`fun.perishPhrase`.',
    usage: '<member> [reason]',
    examples: ['perish from existence @user', 'perish @user raiding'],
    permissions: ['BanMembers'],
    botPermissions: ['BanMembers'],
    args: [
      { name: 'user', type: 'user', required: true, description: 'who to ban' },
      { name: 'reason', type: 'rest', required: false, default: 'Perished', description: 'why' },
    ],
    async run(ctx) {
      // Typed as a bare phrase while the server has that form switched off.
      if (!ctx.prefix && !store.getSetting(ctx.guild.id, 'fun.perishPhrase')) return undefined;

      const { user, reason } = ctx.args;
      const member = await ctx.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        const problem = mod.checkHierarchy(ctx, member, { action: 'ban' });
        if (problem) return ctx.error(problem);
      }

      const already = await ctx.guild.bans.fetch(user.id).catch(() => null);
      if (already) return ctx.error(`**${user.tag}** is already banned.`);

      const { caseNumber } = await mod.record(ctx, { action: 'ban', target: member ?? user, reason });

      try {
        await ctx.guild.bans.create(user.id, { reason: `${ctx.user.tag}: ${reason}`, deleteMessageSeconds: 0 });
      } catch (error) {
        return ctx.error(`Could not ban **${user.tag}** — ${error.message}`);
      }

      // Plain text rather than an embed — the whole point is the one line.
      // Mentions are stripped so the reply cannot be turned into a ping.
      const reply = store.getSetting(ctx.guild.id, 'fun.perishReply')
        .replace('{case}', String(caseNumber))
        .replace('{user}', user.tag);

      return ctx.send({ content: truncate(reply, 2000), allowedMentions: { parse: [] } });
    },
  },
];
