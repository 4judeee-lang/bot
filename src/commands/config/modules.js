'use strict';

const store = require('../../lib/db');
const variables = require('../../lib/variables');
const antinuke = require('../../modules/antinuke');
const tickets = require('../../modules/tickets');
const voicemaster = require('../../modules/voicemaster');
const { truncate } = require('../../lib/util');
const emojis = require('../../lib/emojis');

/** Shared shape for the many "enable X in #channel" commands. */
function enableIn(kind, label) {
  return async (ctx) => {
    const channel = ctx.args.channel;
    store.setSetting(ctx.guild.id, `${kind}.channel`, channel.id);
    store.setSetting(ctx.guild.id, `${kind}.enabled`, true);
    return ctx.success(`${label} enabled in ${channel}. Customise the message with \`${ctx.prefix}${kind} message <text>\`.`);
  };
}

function setMessage(kind, label) {
  return async (ctx) => {
    const text = ctx.args.message;
    if (text.toLowerCase() === 'preview') {
      const template = store.getSetting(ctx.guild.id, `${kind}.message`);
      const payload = variables.render(template, { user: ctx.user, member: ctx.member, guild: ctx.guild, channel: ctx.channel });
      return ctx.send(payload);
    }
    store.setSetting(ctx.guild.id, `${kind}.message`, text);
    const payload = variables.render(text, { user: ctx.user, member: ctx.member, guild: ctx.guild, channel: ctx.channel });
    await ctx.success(`${label} message updated. Here is how it looks:`);
    return ctx.send(payload);
  };
}

const CHANNEL_ARG = { name: 'channel', type: 'textchannel', required: true, description: 'the channel to post in' };
const MESSAGE_ARG = {
  name: 'message',
  type: 'rest',
  required: true,
  description: 'the message, or `preview` to see the current one',
};

module.exports = [
  /* ── welcome / goodbye / boost ─────────────────────────────────── */
  {
    name: 'welcome',
    category: 'Configuration',
    description: 'Set the channel where new members are greeted.',
    details:
      'Turns welcome messages on and points them at a channel. Write the message with `welcome message`. ' +
      'Variables like `{user.mention}` and `{guild.count}` are filled in — see `variables` for the full list.',
    usage: '<channel>',
    examples: ['welcome #general'],
    permissions: ['ManageGuild'],
    args: [CHANNEL_ARG],
    run: enableIn('welcome', 'Welcome messages'),
  },
  {
    name: 'welcome message',
    category: 'Configuration',
    description: 'Set the welcome message, plain text or an embed script.',
    usage: '<message>',
    examples: ['welcome message Welcome {user.mention}!', 'welcome message preview'],
    permissions: ['ManageGuild'],
    args: [MESSAGE_ARG],
    run: setMessage('welcome', 'Welcome'),
  },
  {
    name: 'welcome off',
    category: 'Configuration',
    description: 'Stop greeting new members.',
    examples: ['welcome off'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'welcome.enabled', false);
      return ctx.success('Welcome messages disabled.');
    },
  },

  {
    name: 'goodbye',
    aliases: ['leave'],
    category: 'Configuration',
    description: 'Set the channel where leaving members are announced.',
    usage: '<channel>',
    examples: ['goodbye #general'],
    permissions: ['ManageGuild'],
    args: [CHANNEL_ARG],
    run: enableIn('goodbye', 'Leave messages'),
  },
  {
    name: 'goodbye message',
    category: 'Configuration',
    description: 'Set the leave message.',
    usage: '<message>',
    examples: ['goodbye message {user.name} has left.'],
    permissions: ['ManageGuild'],
    args: [MESSAGE_ARG],
    run: setMessage('goodbye', 'Leave'),
  },
  {
    name: 'goodbye off',
    category: 'Configuration',
    description: 'Stop announcing when members leave.',
    examples: ['goodbye off'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'goodbye.enabled', false);
      return ctx.success('Leave messages disabled.');
    },
  },

  {
    name: 'boost',
    category: 'Configuration',
    description: 'Set the channel where boosts are celebrated.',
    usage: '<channel>',
    examples: ['boost #general'],
    permissions: ['ManageGuild'],
    args: [CHANNEL_ARG],
    run: enableIn('boost', 'Boost messages'),
  },
  {
    name: 'boost message',
    category: 'Configuration',
    description: 'Set the boost thank-you message.',
    usage: '<message>',
    examples: ['boost message thanks {user.mention} 💜'],
    permissions: ['ManageGuild'],
    args: [MESSAGE_ARG],
    run: setMessage('boost', 'Boost'),
  },

  {
    name: 'variables',
    category: 'Configuration',
    description: 'List every variable you can use in messages and embeds.',
    details:
      'These work in welcome, leave, boost, level-up, autoresponder, ticket and sticky messages.\n\n' +
      'For an embed, start the message with `{embed}` and separate parts with `$v`, e.g.\n' +
      '`{embed}{color: #8b5cf6}$v{title: Hello}$v{description: Welcome {user.mention}}`',
    examples: ['variables'],
    async run(ctx) {
      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Message variables',
            description: variables.VARIABLES.map((entry) => `\`{${entry.name}}\` — ${entry.description}`).join('\n'),
            fields: [
              {
                name: 'Embed parts',
                value: '`content` `color` `title` `url` `description` `thumbnail` `image` `author` `footer` `field` `timestamp` `button`',
              },
            ],
            footer: { text: 'Separate embed parts with $v' },
          }),
        ],
      });
    },
  },

  /* ── logging ───────────────────────────────────────────────────── */
  {
    name: 'logs',
    aliases: ['logging', 'setlogs'],
    category: 'Configuration',
    description: 'Turn logging on and pick the channel everything is written to.',
    details:
      'One channel catches everything by default. To split them up, set `logs.moderation`, `logs.messages`, ' +
      '`logs.members`, `logs.server` or `logs.voice` individually with the `set` command.',
    usage: '<channel>',
    examples: ['logs #audit-log'],
    permissions: ['ManageGuild'],
    args: [CHANNEL_ARG],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'logs.channel', ctx.args.channel.id);
      store.setSetting(ctx.guild.id, 'logs.enabled', true);
      return ctx.success(
        `Logging enabled — everything goes to ${ctx.args.channel}.\n` +
          `Split it up with \`${ctx.prefix}set logs.messages #channel\`, and so on.`,
      );
    },
  },
  {
    name: 'logs off',
    category: 'Configuration',
    description: 'Turn logging off.',
    examples: ['logs off'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'logs.enabled', false);
      return ctx.success('Logging disabled.');
    },
  },

  /* ── automod ───────────────────────────────────────────────────── */
  {
    name: 'automod',
    category: 'Configuration',
    description: 'Show the automod filters and whether they are on.',
    details: `Toggle individual filters with \`${'{prefix}'}automod <filter> <on|off>\`.`,
    examples: ['automod'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const settings = store.getSettings(ctx.guild.id);
      const flag = (value) => (value ? `${emojis.success} on` : `${emojis.error} off`);

      return ctx.send({
        embeds: [
          ctx.embed({
            title: 'Automod',
            description: `Master switch: ${flag(settings['automod.enabled'])}\nPunishment: **${settings['automod.action']}**`,
            fields: [
              { name: 'Invites', value: flag(settings['automod.invites']), inline: true },
              { name: 'Links', value: flag(settings['automod.links']), inline: true },
              { name: 'Spam', value: flag(settings['automod.spam']), inline: true },
              { name: 'Caps', value: flag(settings['automod.caps']), inline: true },
              { name: 'Max mentions', value: String(settings['automod.mentions'] || 'off'), inline: true },
              { name: 'Max emojis', value: String(settings['automod.emojis'] || 'off'), inline: true },
              { name: 'Blocked words', value: String((settings['automod.words'] ?? []).length), inline: true },
              { name: 'Exempt roles', value: String((settings['automod.exemptRoles'] ?? []).length), inline: true },
            ],
            footer: { text: `${ctx.prefix}automod invites on • ${ctx.prefix}automod word add <word>` },
          }),
        ],
      });
    },
  },
  {
    name: 'automod enable',
    category: 'Configuration',
    description: 'Turn the automod master switch on.',
    examples: ['automod enable'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'automod.enabled', true);
      return ctx.success(`Automod enabled. Pick your filters with \`${ctx.prefix}automod invites on\`, etc.`);
    },
  },
  {
    name: 'automod disable',
    category: 'Configuration',
    description: 'Turn automod off entirely.',
    examples: ['automod disable'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'automod.enabled', false);
      return ctx.success('Automod disabled.');
    },
  },
  {
    name: 'automod invites',
    category: 'Configuration',
    description: 'Block or allow Discord invite links.',
    usage: '<on|off>',
    examples: ['automod invites on'],
    permissions: ['ManageGuild'],
    args: [{ name: 'state', type: 'boolean', required: true, description: 'on or off' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'automod.invites', ctx.args.state);
      return ctx.success(`Invite filter ${ctx.args.state ? 'enabled' : 'disabled'}.`);
    },
  },
  {
    name: 'automod links',
    category: 'Configuration',
    description: 'Block or allow all links.',
    usage: '<on|off>',
    examples: ['automod links on'],
    permissions: ['ManageGuild'],
    args: [{ name: 'state', type: 'boolean', required: true, description: 'on or off' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'automod.links', ctx.args.state);
      return ctx.success(`Link filter ${ctx.args.state ? 'enabled' : 'disabled'}.`);
    },
  },
  {
    name: 'automod spam',
    category: 'Configuration',
    description: 'Turn the anti-spam filter on or off.',
    usage: '<on|off>',
    examples: ['automod spam on'],
    permissions: ['ManageGuild'],
    args: [{ name: 'state', type: 'boolean', required: true, description: 'on or off' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'automod.spam', ctx.args.state);
      return ctx.success(`Anti-spam ${ctx.args.state ? 'enabled' : 'disabled'}.`);
    },
  },
  {
    name: 'automod caps',
    category: 'Configuration',
    description: 'Turn the excessive-caps filter on or off.',
    usage: '<on|off>',
    examples: ['automod caps on'],
    permissions: ['ManageGuild'],
    args: [{ name: 'state', type: 'boolean', required: true, description: 'on or off' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'automod.caps', ctx.args.state);
      return ctx.success(`Caps filter ${ctx.args.state ? 'enabled' : 'disabled'}.`);
    },
  },
  {
    name: 'automod word add',
    aliases: ['filter add'],
    category: 'Configuration',
    description: 'Add a word to the blocked list.',
    usage: '<word>',
    examples: ['automod word add badword'],
    permissions: ['ManageGuild'],
    args: [{ name: 'word', type: 'rest', required: true, description: 'the word or phrase to block' }],
    async run(ctx) {
      const words = new Set(store.getSetting(ctx.guild.id, 'automod.words') ?? []);
      words.add(ctx.args.word.toLowerCase());
      store.setSetting(ctx.guild.id, 'automod.words', [...words]);
      return ctx.success(`Blocked **${words.size}** word(s) in total.`);
    },
  },
  {
    name: 'automod word remove',
    aliases: ['filter remove'],
    category: 'Configuration',
    description: 'Remove a word from the blocked list.',
    usage: '<word>',
    examples: ['automod word remove badword'],
    permissions: ['ManageGuild'],
    args: [{ name: 'word', type: 'rest', required: true, description: 'the word to unblock' }],
    async run(ctx) {
      const words = (store.getSetting(ctx.guild.id, 'automod.words') ?? []).filter(
        (word) => word !== ctx.args.word.toLowerCase(),
      );
      store.setSetting(ctx.guild.id, 'automod.words', words);
      return ctx.success(`Blocked list now has **${words.length}** word(s).`);
    },
  },
  {
    name: 'automod words',
    category: 'Configuration',
    description: 'Show the blocked word list.',
    examples: ['automod words'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const words = store.getSetting(ctx.guild.id, 'automod.words') ?? [];
      if (!words.length) return ctx.info('No words are blocked.');
      return ctx.whisper({
        embeds: [ctx.embed({ title: `Blocked words (${words.length})`, description: truncate(words.map((w) => `\`${w}\``).join(', '), 4000) })],
      });
    },
  },

  /* ── antinuke ──────────────────────────────────────────────────── */
  {
    name: 'antinuke',
    category: 'Configuration',
    description: 'Show the antinuke status and settings.',
    details:
      'Antinuke watches for a single person doing something destructive over and over — mass channel or role ' +
      'deletions, mass bans or kicks, webhook spam — and punishes them once they cross the threshold inside a ' +
      'minute. Whitelist people you trust so they are never caught by it.',
    examples: ['antinuke'],
    permissions: ['Administrator'],
    async run(ctx) {
      const settings = store.getSettings(ctx.guild.id);
      const flag = (value) => (value ? `${emojis.success}` : `${emojis.error}`);
      const whitelisted = antinuke.listWhitelist(ctx.guild.id);

      return ctx.send({
        embeds: [
          ctx.embed({
            title: `${emojis.lock} Antinuke`,
            description:
              `Status: ${settings['antinuke.enabled'] ? `${emojis.success} **armed**` : `${emojis.error} **off**`}\n` +
              `Punishment: **${settings['antinuke.punishment']}** after **${settings['antinuke.threshold']}** actions in 60s`,
            fields: [
              { name: 'Channel deletes', value: flag(settings['antinuke.channelDelete']), inline: true },
              { name: 'Role deletes', value: flag(settings['antinuke.roleDelete']), inline: true },
              { name: 'Mass bans', value: flag(settings['antinuke.bans']), inline: true },
              { name: 'Mass kicks', value: flag(settings['antinuke.kicks']), inline: true },
              { name: 'Webhooks', value: flag(settings['antinuke.webhooks']), inline: true },
              { name: 'Block new bots', value: flag(settings['antinuke.botAdd']), inline: true },
              {
                name: `Whitelisted (${whitelisted.length})`,
                value: whitelisted.length ? truncate(whitelisted.map((id) => `<@${id}>`).join(' '), 1000) : 'only the server owner',
                inline: false,
              },
            ],
            footer: { text: `${ctx.prefix}antinuke enable • ${ctx.prefix}antinuke whitelist @user` },
          }),
        ],
      });
    },
  },
  {
    name: 'antinuke enable',
    category: 'Configuration',
    description: 'Arm the antinuke.',
    examples: ['antinuke enable'],
    permissions: ['Administrator'],
    serverOwnerOnly: true,
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'antinuke.enabled', true);
      return ctx.success(
        `Antinuke armed. Whitelist trusted admins with \`${ctx.prefix}antinuke whitelist @user\` so they are never punished.`,
      );
    },
  },
  {
    name: 'antinuke disable',
    category: 'Configuration',
    description: 'Disarm the antinuke.',
    examples: ['antinuke disable'],
    permissions: ['Administrator'],
    serverOwnerOnly: true,
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'antinuke.enabled', false);
      return ctx.success('Antinuke disarmed.');
    },
  },
  {
    name: 'antinuke whitelist',
    category: 'Configuration',
    description: 'Let someone bypass the antinuke.',
    usage: '<user>',
    examples: ['antinuke whitelist @admin'],
    permissions: ['Administrator'],
    serverOwnerOnly: true,
    args: [{ name: 'user', type: 'user', required: true, description: 'who to trust' }],
    async run(ctx) {
      antinuke.whitelist(ctx.guild.id, ctx.args.user.id);
      return ctx.success(`**${ctx.args.user.tag}** is whitelisted from the antinuke.`);
    },
  },
  {
    name: 'antinuke unwhitelist',
    category: 'Configuration',
    description: 'Remove someone from the antinuke whitelist.',
    usage: '<user>',
    examples: ['antinuke unwhitelist @admin'],
    permissions: ['Administrator'],
    serverOwnerOnly: true,
    args: [{ name: 'user', type: 'user', required: true, description: 'who to remove' }],
    async run(ctx) {
      antinuke.unwhitelist(ctx.guild.id, ctx.args.user.id);
      return ctx.success(`**${ctx.args.user.tag}** is no longer whitelisted.`);
    },
  },

  /* ── antiraid ──────────────────────────────────────────────────── */
  {
    name: 'antiraid',
    category: 'Configuration',
    description: 'Show antiraid settings.',
    details:
      'Antiraid reacts to floods of joins — it can lock the server down, or kick/ban the wave. It can also ' +
      'screen every join by account age and avatar.',
    examples: ['antiraid'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      const settings = store.getSettings(ctx.guild.id);
      return ctx.send({
        embeds: [
          ctx.embed({
            title: '🚨 Antiraid',
            description: settings['antiraid.enabled'] ? `${emojis.success} **armed**` : `${emojis.error} **off**`,
            fields: [
              { name: 'Join threshold', value: `${settings['antiraid.joinThreshold']} joins / 10s`, inline: true },
              { name: 'Response', value: settings['antiraid.action'], inline: true },
              {
                name: 'Min account age',
                value: settings['antiraid.minAccountAge'] ? `${settings['antiraid.minAccountAge']} day(s)` : 'off',
                inline: true,
              },
              { name: 'Block default avatars', value: settings['antiraid.noAvatar'] ? 'on' : 'off', inline: true },
            ],
          }),
        ],
      });
    },
  },
  {
    name: 'antiraid enable',
    category: 'Configuration',
    description: 'Arm the antiraid.',
    examples: ['antiraid enable'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'antiraid.enabled', true);
      return ctx.success('Antiraid armed.');
    },
  },
  {
    name: 'antiraid disable',
    category: 'Configuration',
    description: 'Disarm the antiraid.',
    examples: ['antiraid disable'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'antiraid.enabled', false);
      return ctx.success('Antiraid disarmed.');
    },
  },

  /* ── starboard ─────────────────────────────────────────────────── */
  {
    name: 'starboard',
    category: 'Configuration',
    description: 'Set up the starboard in a channel.',
    details: 'Messages that get enough star reactions are reposted to the starboard channel, with a live star count.',
    usage: '<channel> [threshold]',
    examples: ['starboard #starboard', 'starboard #starboard 5'],
    permissions: ['ManageGuild'],
    args: [
      CHANNEL_ARG,
      { name: 'threshold', type: 'integer', required: false, description: 'stars needed (default 3)' },
    ],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'starboard.channel', ctx.args.channel.id);
      store.setSetting(ctx.guild.id, 'starboard.enabled', true);
      if (ctx.args.threshold) store.setSetting(ctx.guild.id, 'starboard.threshold', Math.max(1, ctx.args.threshold));

      const emoji = store.getSetting(ctx.guild.id, 'starboard.emoji');
      const threshold = store.getSetting(ctx.guild.id, 'starboard.threshold');
      return ctx.success(`Starboard is live in ${ctx.args.channel} — **${threshold}× ${emoji}** to get posted.`);
    },
  },
  {
    name: 'starboard emoji',
    category: 'Configuration',
    description: 'Change the emoji that counts as a star.',
    usage: '<emoji>',
    examples: ['starboard emoji 🌟'],
    permissions: ['ManageGuild'],
    args: [{ name: 'emoji', type: 'string', required: true, description: 'the emoji to use' }],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'starboard.emoji', ctx.args.emoji.trim());
      return ctx.success(`Starboard emoji is now ${ctx.args.emoji}.`);
    },
  },
  {
    name: 'starboard off',
    category: 'Configuration',
    description: 'Turn the starboard off.',
    examples: ['starboard off'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'starboard.enabled', false);
      return ctx.success('Starboard disabled.');
    },
  },

  /* ── tickets ───────────────────────────────────────────────────── */
  {
    name: 'ticket setup',
    aliases: ['tickets setup'],
    category: 'Tickets',
    description: 'Set up tickets and post the open-a-ticket panel.',
    details:
      'Creates the panel in the channel you name. New tickets appear in the category you choose and the support ' +
      'role is added to every one of them.',
    usage: '<channel> <category> [support role]',
    examples: ['ticket setup #support Tickets @Staff'],
    permissions: ['ManageGuild'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'channel', type: 'textchannel', required: true, description: 'where the panel goes' },
      { name: 'category', type: 'category', required: true, description: 'category new tickets are created in' },
      { name: 'role', type: 'role', required: false, description: 'support role added to every ticket' },
    ],
    async run(ctx) {
      const { channel, category, role } = ctx.args;
      store.setSettings(ctx.guild.id, {
        'tickets.enabled': true,
        'tickets.category': category.id,
        'tickets.supportRole': role?.id ?? null,
      });

      await channel.send({
        embeds: [
          ctx.embed({
            title: `${emojis.ticket} Support`,
            description: 'Need help? Press the button below and a private channel will be created for you.',
          }),
        ],
        components: tickets.panelComponents(),
      });

      return ctx.success(`Ticket panel posted in ${channel}. Tickets will be created under **${category.name}**.`);
    },
  },
  {
    name: 'ticket off',
    category: 'Tickets',
    description: 'Disable tickets.',
    examples: ['ticket off'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      store.setSetting(ctx.guild.id, 'tickets.enabled', false);
      return ctx.success('Tickets disabled. Existing ticket channels are untouched.');
    },
  },
  {
    name: 'ticket close',
    category: 'Tickets',
    description: 'Close the ticket you are in.',
    examples: ['ticket close'],
    permissions: ['ManageMessages'],
    async run(ctx) {
      const ticket = store.db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND open = 1').get(ctx.channel.id);
      if (!ticket) return ctx.error('This is not an open ticket channel.');

      const confirmed = await ctx.confirm({
        title: 'Close ticket',
        description: 'The channel will be deleted and a transcript saved if a log channel is set.',
        confirmLabel: 'Close it',
      });
      if (!confirmed) return undefined;

      store.db.prepare('UPDATE tickets SET open = 0 WHERE channel_id = ?').run(ctx.channel.id);
      setTimeout(() => ctx.channel.delete('Ticket closed').catch(() => {}), 4000);
      return ctx.success('Closing in a moment…');
    },
  },
  {
    name: 'ticket add',
    category: 'Tickets',
    description: 'Add a member to the ticket you are in.',
    usage: '<member>',
    examples: ['ticket add @user'],
    permissions: ['ManageMessages'],
    args: [{ name: 'member', type: 'member', required: true, description: 'who to add' }],
    async run(ctx) {
      const ticket = store.db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND open = 1').get(ctx.channel.id);
      if (!ticket) return ctx.error('This is not an open ticket channel.');
      await ctx.channel.permissionOverwrites.edit(ctx.args.member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      return ctx.success(`Added ${ctx.args.member} to this ticket.`);
    },
  },
  {
    name: 'ticket remove',
    category: 'Tickets',
    description: 'Remove a member from the ticket you are in.',
    usage: '<member>',
    examples: ['ticket remove @user'],
    permissions: ['ManageMessages'],
    args: [{ name: 'member', type: 'member', required: true, description: 'who to remove' }],
    async run(ctx) {
      const ticket = store.db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND open = 1').get(ctx.channel.id);
      if (!ticket) return ctx.error('This is not an open ticket channel.');
      await ctx.channel.permissionOverwrites.delete(ctx.args.member.id);
      return ctx.success(`Removed ${ctx.args.member} from this ticket.`);
    },
  },

  /* ── voicemaster ───────────────────────────────────────────────── */
  {
    name: 'voicemaster setup',
    aliases: ['vm setup'],
    category: 'Voice',
    description: 'Set up join-to-create temporary voice channels.',
    details:
      'Anyone who joins the hub channel gets their own voice channel that they control, and it is deleted ' +
      'automatically when the last person leaves.',
    usage: '<hub channel> [category]',
    examples: ['voicemaster setup "Join to create"'],
    permissions: ['ManageGuild'],
    botPermissions: ['ManageChannels'],
    args: [
      { name: 'channel', type: 'voicechannel', required: true, description: 'the join-to-create channel' },
      { name: 'category', type: 'category', required: false, description: 'where new channels are made' },
    ],
    async run(ctx) {
      store.setSettings(ctx.guild.id, {
        'voicemaster.enabled': true,
        'voicemaster.joinChannel': ctx.args.channel.id,
        'voicemaster.category': ctx.args.category?.id ?? ctx.args.channel.parentId ?? null,
      });
      return ctx.success(`VoiceMaster is on — joining **${ctx.args.channel.name}** now creates a personal channel.`);
    },
  },
  {
    name: 'voicemaster interface',
    aliases: ['vm interface'],
    category: 'Voice',
    description: 'Post the button panel for controlling temporary voice channels.',
    examples: ['voicemaster interface'],
    permissions: ['ManageGuild'],
    async run(ctx) {
      await ctx.channel.send({
        embeds: [
          ctx.embed({
            title: `${emojis.voice} Voice controls`,
            description:
              'While you are in your own temporary channel:\n\n' +
              '🔒 **Lock** — nobody new can join\n' +
              '🔓 **Unlock** — anyone can join\n' +
              '👻 **Hide** — hide it from the channel list\n' +
              '👁️ **Reveal** — show it again\n' +
              '👑 **Claim** — take ownership if the owner left',
          }),
        ],
        components: voicemaster.interfaceComponents(),
      });
      return ctx.success('Panel posted.');
    },
  },
];
