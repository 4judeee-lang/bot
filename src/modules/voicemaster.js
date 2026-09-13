'use strict';

const { respond } = require('../lib/reply');
const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const store = require('../lib/db');
const { themeFor } = require('../lib/embeds');
const variables = require('../lib/variables');
const logger = require('../lib/logger');

const P = PermissionsBitField.Flags;

const CONTROLS = [
  { id: 'vm:lock', emoji: '🔒', label: 'Lock' },
  { id: 'vm:unlock', emoji: '🔓', label: 'Unlock' },
  { id: 'vm:hide', emoji: '👻', label: 'Hide' },
  { id: 'vm:reveal', emoji: '👁️', label: 'Reveal' },
  { id: 'vm:claim', emoji: '👑', label: 'Claim' },
];

function interfaceComponents() {
  return [
    new ActionRowBuilder().addComponents(
      CONTROLS.map((control) =>
        new ButtonBuilder()
          .setCustomId(control.id)
          .setEmoji(control.emoji)
          .setLabel(control.label)
          .setStyle(ButtonStyle.Secondary),
      ),
    ),
  ];
}

function ownerOf(channelId) {
  return store.db.prepare('SELECT * FROM vm_channels WHERE channel_id = ?').get(channelId);
}

/** Someone joined the "join to create" channel — give them their own room. */
async function onJoinHub(member, channel) {
  const guild = member.guild;
  const categoryId = store.getSetting(guild.id, 'voicemaster.category') ?? channel.parentId;
  const template = store.getSetting(guild.id, 'voicemaster.nameTemplate') ?? "{user.name}'s channel";
  const limit = store.getSetting(guild.id, 'voicemaster.userLimit') ?? 0;

  const name = variables.apply(template, variables.buildScope({ user: member.user, member, guild })).slice(0, 95);

  try {
    const created = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: categoryId ?? undefined,
      userLimit: limit || undefined,
      reason: `VoiceMaster channel for ${member.user.tag}`,
      permissionOverwrites: [
        {
          id: member.id,
          allow: [P.ViewChannel, P.Connect, P.Speak, P.ManageChannels, P.MoveMembers, P.MuteMembers],
        },
        { id: guild.members.me.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels, P.MoveMembers] },
      ],
    });

    store.db.prepare('INSERT INTO vm_channels (channel_id, guild_id, owner_id) VALUES (?, ?, ?)').run(created.id, guild.id, member.id);
    await member.voice.setChannel(created).catch(() => {});
    return created;
  } catch (error) {
    logger.warn(`VoiceMaster could not create a channel in ${guild.id}: ${error.message}`);
    return null;
  }
}

/** Last person left a temporary channel — clean it up. */
async function cleanup(channel) {
  const record = ownerOf(channel.id);
  if (!record) return;
  if (channel.members.size > 0) return;
  store.db.prepare('DELETE FROM vm_channels WHERE channel_id = ?').run(channel.id);
  await channel.delete('VoiceMaster: channel empty').catch(() => {});
}

async function handleVoiceState(oldState, newState) {
  const guild = newState.guild ?? oldState.guild;
  if (!store.getSetting(guild.id, 'voicemaster.enabled')) return;

  const hubId = store.getSetting(guild.id, 'voicemaster.joinChannel');
  if (hubId && newState.channelId === hubId && newState.member) {
    await onJoinHub(newState.member, newState.channel);
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId && oldState.channel) {
    await cleanup(oldState.channel);
  }
}

/** Shared permission check for every control button and command. */
function assertOwner(interactionOrCtx, channelId) {
  const record = ownerOf(channelId);
  if (!record) return { ok: false, reason: 'This is not a VoiceMaster channel.' };
  const userId = interactionOrCtx.user.id;
  const member = interactionOrCtx.member;
  if (record.owner_id !== userId && !member?.permissions.has(P.ManageChannels)) {
    return { ok: false, reason: `Only <@${record.owner_id}> can change this channel.` };
  }
  return { ok: true, record };
}

async function handleButton(interaction) {
  const theme = themeFor(interaction.guild.id);
  const voiceChannel = interaction.member.voice?.channel;
  if (!voiceChannel) {
    return respond(interaction, { embeds: [theme.error('Join your voice channel first.')], ephemeral: true });
  }

  const check = assertOwner(interaction, voiceChannel.id);
  if (!check.ok && interaction.customId !== 'vm:claim') {
    return respond(interaction, { embeds: [theme.error(check.reason)], ephemeral: true });
  }

  const everyone = interaction.guild.roles.everyone;

  try {
    switch (interaction.customId) {
      case 'vm:lock':
        await voiceChannel.permissionOverwrites.edit(everyone, { Connect: false });
        return respond(interaction, { embeds: [theme.success('Channel locked.')], ephemeral: true });
      case 'vm:unlock':
        await voiceChannel.permissionOverwrites.edit(everyone, { Connect: null });
        return respond(interaction, { embeds: [theme.success('Channel unlocked.')], ephemeral: true });
      case 'vm:hide':
        await voiceChannel.permissionOverwrites.edit(everyone, { ViewChannel: false });
        return respond(interaction, { embeds: [theme.success('Channel hidden.')], ephemeral: true });
      case 'vm:reveal':
        await voiceChannel.permissionOverwrites.edit(everyone, { ViewChannel: null });
        return respond(interaction, { embeds: [theme.success('Channel is visible again.')], ephemeral: true });
      case 'vm:claim': {
        const record = ownerOf(voiceChannel.id);
        if (!record) return respond(interaction, { embeds: [theme.error('This is not a VoiceMaster channel.')], ephemeral: true });
        if (voiceChannel.members.has(record.owner_id)) {
          return respond(interaction, { embeds: [theme.error('The owner is still in this channel.')], ephemeral: true });
        }
        store.db.prepare('UPDATE vm_channels SET owner_id = ? WHERE channel_id = ?').run(interaction.user.id, voiceChannel.id);
        await voiceChannel.permissionOverwrites.edit(interaction.user.id, { ManageChannels: true, Connect: true });
        return respond(interaction, { embeds: [theme.success('You now own this channel.')], ephemeral: true });
      }
      default:
        return undefined;
    }
  } catch (error) {
    return respond(interaction, { embeds: [theme.error(`That failed: ${error.message}`)], ephemeral: true });
  }
}

module.exports = { handleVoiceState, handleButton, interfaceComponents, ownerOf, assertOwner, cleanup };
