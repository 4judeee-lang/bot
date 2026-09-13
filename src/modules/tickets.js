'use strict';

const { respond, eph } = require('../lib/reply');
const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const variables = require('../lib/variables');
const emojis = require('../lib/emojis');
const logger = require('../lib/logger');

const P = PermissionsBitField.Flags;

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:open')
        .setLabel('Open a ticket')
        .setEmoji(emojis.ticket)
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

function ticketControls() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function openCount(guildId, userId) {
  return store.db
    .prepare('SELECT COUNT(*) AS total FROM tickets WHERE guild_id = ? AND user_id = ? AND open = 1')
    .get(guildId, userId).total;
}

/** Create the private channel and announce it. */
async function open(interaction) {
  const guild = interaction.guild;
  const theme = themeFor(guild.id);

  if (!store.getSetting(guild.id, 'tickets.enabled')) {
    return respond(interaction, { embeds: [theme.error('Tickets are disabled in this server.')], ephemeral: true });
  }

  const limit = store.getSetting(guild.id, 'tickets.limit') ?? 1;
  if (openCount(guild.id, interaction.user.id) >= limit) {
    return respond(interaction, {
      embeds: [theme.error(`You already have **${limit}** ticket(s) open.`)],
      ephemeral: true,
    });
  }

  await interaction.deferReply(eph({}));

  const categoryId = store.getSetting(guild.id, 'tickets.category');
  const supportRoleId = store.getSetting(guild.id, 'tickets.supportRole');

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks],
    },
    { id: guild.members.me.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels, P.ReadMessageHistory] },
  ];
  if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
    overwrites.push({
      id: supportRoleId,
      allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles],
    });
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`.slice(0, 90),
      type: ChannelType.GuildText,
      parent: categoryId && guild.channels.cache.get(categoryId) ? categoryId : undefined,
      permissionOverwrites: overwrites,
      reason: `Ticket opened by ${interaction.user.tag}`,
    });
  } catch (error) {
    logger.warn(`Ticket creation failed in ${guild.id}: ${error.message}`);
    return interaction.editReply({
      embeds: [theme.error('I could not create the channel — check my permissions and the ticket category.')],
    });
  }

  store.db
    .prepare('INSERT INTO tickets (guild_id, channel_id, user_id) VALUES (?, ?, ?)')
    .run(guild.id, channel.id, interaction.user.id);

  const template = store.getSetting(guild.id, 'tickets.openMessage');
  const payload = variables.render(template, { user: interaction.user, member: interaction.member, guild, channel });

  await channel.send({
    content: supportRoleId ? `<@&${supportRoleId}> ${interaction.user}` : `${interaction.user}`,
    ...payload,
    components: ticketControls(),
    allowedMentions: { roles: supportRoleId ? [supportRoleId] : [], users: [interaction.user.id] },
  });

  return interaction.editReply({ embeds: [theme.success(`Your ticket is open: ${channel}`)] });
}

async function claim(interaction) {
  const theme = themeFor(interaction.guild.id);
  const ticket = store.db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
  if (!ticket) return respond(interaction, { embeds: [theme.error('This is not a ticket channel.')], ephemeral: true });

  const supportRoleId = store.getSetting(interaction.guild.id, 'tickets.supportRole');
  const isStaff =
    interaction.member.permissions.has(P.ManageChannels) ||
    (supportRoleId && interaction.member.roles.cache.has(supportRoleId));
  if (!isStaff) return respond(interaction, { embeds: [theme.error('Only staff can claim tickets.')], ephemeral: true });

  if (ticket.claimed_by) {
    return respond(interaction, {
      embeds: [theme.warn(`Already claimed by <@${ticket.claimed_by}>.`)],
      ephemeral: true,
    });
  }

  store.db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(interaction.user.id, interaction.channel.id);
  return respond(interaction, { embeds: [theme.success(`${interaction.user} claimed this ticket.`)] });
}

/** Build a readable transcript of the whole conversation. */
async function transcript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return null;
  const lines = [...messages.values()]
    .reverse()
    .map((message) => {
      const time = message.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      const attachments = message.attachments.map((a) => a.url).join(' ');
      return `[${time}] ${message.author.tag}: ${message.content}${attachments ? ` ${attachments}` : ''}`;
    });
  return Buffer.from(`Transcript of #${channel.name}\n${'='.repeat(50)}\n\n${lines.join('\n')}\n`, 'utf8');
}

async function close(interaction) {
  const guild = interaction.guild;
  const theme = themeFor(guild.id);
  const ticket = store.db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
  if (!ticket) return respond(interaction, { embeds: [theme.error('This is not a ticket channel.')], ephemeral: true });

  await respond(interaction, { embeds: [theme.warn('Closing this ticket in 5 seconds…')] });

  const logId = store.getSetting(guild.id, 'tickets.logChannel');
  const logChannel = logId ? guild.channels.cache.get(logId) : null;
  if (logChannel?.isTextBased()) {
    const buffer = await transcript(interaction.channel);
    const files = buffer ? [new AttachmentBuilder(buffer, { name: `${interaction.channel.name}.txt` })] : [];
    await logChannel
      .send({
        embeds: [
          theme.base({
            title: `${emojis.ticket} Ticket closed`,
            fields: [
              { name: 'Opened by', value: `<@${ticket.user_id}>`, inline: true },
              { name: 'Closed by', value: `${interaction.user}`, inline: true },
              { name: 'Claimed by', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'nobody', inline: true },
            ],
            timestamp: true,
          }),
        ],
        files,
      })
      .catch(() => {});
  }

  store.db.prepare('UPDATE tickets SET open = 0 WHERE channel_id = ?').run(interaction.channel.id);
  setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);
  return undefined;
}

async function handleButton(interaction) {
  switch (interaction.customId) {
    case 'ticket:open':
      return open(interaction);
    case 'ticket:claim':
      return claim(interaction);
    case 'ticket:close':
      return close(interaction);
    default:
      return undefined;
  }
}

module.exports = { handleButton, panelComponents, ticketControls, open, close, claim, transcript };
