'use strict';

/**
 * Every configurable value in one place.
 *
 * The bot reads these through `db.getSetting()`; the dashboard renders its
 * forms straight from this file, so a new setting only has to be added here
 * and it shows up on the website automatically — correctly typed, labelled
 * and validated.
 *
 * type:
 *   boolean | string | text | number | color | channel | category | role
 *   | roles | channels | strings | select | template
 */

const SETTINGS = {
  /* ── Appearance ──────────────────────────────────────────────────── */
  'embed.color': {
    type: 'color',
    default: '#8b5cf6',
    category: 'Appearance',
    label: 'Primary embed colour',
    description: 'Used by every neutral/informational embed the bot sends.',
  },
  'embed.success': {
    type: 'color',
    default: '#3ba55d',
    category: 'Appearance',
    label: 'Success colour',
    description: 'Colour for confirmations, e.g. after a member is banned.',
  },
  'embed.error': {
    type: 'color',
    default: '#ed4245',
    category: 'Appearance',
    label: 'Error colour',
    description: 'Colour shown when a command fails or is used incorrectly.',
  },
  'embed.warn': {
    type: 'color',
    default: '#faa61a',
    category: 'Appearance',
    label: 'Warning colour',
    description: 'Colour for warnings and confirmation prompts.',
  },
  'embed.footer': {
    type: 'string',
    default: '',
    category: 'Appearance',
    label: 'Embed footer text',
    description: 'Appended to the footer of most embeds. Leave empty for none.',
    max: 100,
  },
  'embed.thumbnails': {
    type: 'boolean',
    default: true,
    category: 'Appearance',
    label: 'Show thumbnails',
    description: 'Show avatars/icons as thumbnails on info embeds.',
  },
  'embed.emojis': {
    type: 'boolean',
    default: true,
    category: 'Appearance',
    label: 'Show status emojis',
    description: 'Prefix success/error replies with an emoji.',
  },

  /* ── General ─────────────────────────────────────────────────────── */
  'general.deleteInvocation': {
    type: 'boolean',
    default: false,
    category: 'General',
    label: 'Delete command messages',
    description: 'Delete the message that triggered a prefix command.',
  },
  'general.dmOnPunish': {
    type: 'boolean',
    default: true,
    category: 'General',
    label: 'DM members on punishment',
    description: 'Send a DM explaining the action when a member is punished.',
  },
  'general.silentErrors': {
    type: 'boolean',
    default: false,
    category: 'General',
    label: 'Silent errors',
    description: 'React with ❌ instead of replying when a command errors.',
  },
  'general.disabledCategories': {
    type: 'strings',
    default: [],
    category: 'General',
    label: 'Disabled categories',
    description: 'Command categories that are switched off in this server.',
  },

  /* ── Welcome ─────────────────────────────────────────────────────── */
  'welcome.enabled': {
    type: 'boolean',
    default: false,
    category: 'Welcome',
    label: 'Enable welcome messages',
    description: 'Greet members when they join.',
  },
  'welcome.channel': {
    type: 'channel',
    default: null,
    category: 'Welcome',
    label: 'Welcome channel',
    description: 'Where welcome messages are posted.',
  },
  'welcome.message': {
    type: 'template',
    default: '{embed}{color: #8b5cf6}$v{title: Welcome!}$v{description: Welcome to **{guild.name}**, {user.mention}! You are member #{guild.count}.}$v{thumbnail: {user.avatar}}',
    category: 'Welcome',
    label: 'Welcome message',
    description: 'Plain text, or an embed script. Variables like {user.mention} are replaced.',
  },
  'welcome.deleteAfter': {
    type: 'number',
    default: 0,
    category: 'Welcome',
    label: 'Delete after (seconds)',
    description: 'Auto-delete the welcome message. 0 keeps it forever.',
    min: 0,
    max: 3600,
  },
  'welcome.dm': {
    type: 'template',
    default: '',
    category: 'Welcome',
    label: 'Welcome DM',
    description: 'Optional direct message sent to new members. Empty disables it.',
  },

  /* ── Goodbye ─────────────────────────────────────────────────────── */
  'goodbye.enabled': {
    type: 'boolean',
    default: false,
    category: 'Goodbye',
    label: 'Enable leave messages',
    description: 'Post a message when a member leaves.',
  },
  'goodbye.channel': {
    type: 'channel',
    default: null,
    category: 'Goodbye',
    label: 'Leave channel',
    description: 'Where leave messages are posted.',
  },
  'goodbye.message': {
    type: 'template',
    default: '**{user.name}** just left {guild.name}. We are now {guild.count} members.',
    category: 'Goodbye',
    label: 'Leave message',
    description: 'Plain text or an embed script.',
  },

  /* ── Boost ───────────────────────────────────────────────────────── */
  'boost.enabled': {
    type: 'boolean',
    default: false,
    category: 'Boost',
    label: 'Enable boost messages',
    description: 'Thank members who boost the server.',
  },
  'boost.channel': {
    type: 'channel',
    default: null,
    category: 'Boost',
    label: 'Boost channel',
    description: 'Where boost messages are posted.',
  },
  'boost.message': {
    type: 'template',
    default: '{embed}{color: #f47fff}$v{description: 💜 {user.mention} just boosted **{guild.name}**! We are now at **{guild.boosts}** boosts.}',
    category: 'Boost',
    label: 'Boost message',
    description: 'Plain text or an embed script.',
  },

  /* ── Levels ──────────────────────────────────────────────────────── */
  'levels.enabled': {
    type: 'boolean',
    default: false,
    category: 'Levels',
    label: 'Enable levelling',
    description: 'Award XP for chatting and hand out level roles.',
  },
  'levels.channel': {
    type: 'channel',
    default: null,
    category: 'Levels',
    label: 'Level-up channel',
    description: 'Where level-up announcements go. Empty = the channel they spoke in.',
  },
  'levels.message': {
    type: 'template',
    default: '{user.mention} reached level **{level}**! 🎉',
    category: 'Levels',
    label: 'Level-up message',
    description: 'Supports {level}, {xp} and all user/guild variables.',
  },
  'levels.announce': {
    type: 'select',
    default: 'channel',
    options: ['channel', 'dm', 'off'],
    category: 'Levels',
    label: 'Announce level-ups',
    description: 'Where to announce a level up, or turn announcements off.',
  },
  'levels.xpPerMessage': {
    type: 'number',
    default: 15,
    min: 1,
    max: 200,
    category: 'Levels',
    label: 'XP per message',
    description: 'Base XP granted per message (a small random bonus is added).',
  },
  'levels.cooldown': {
    type: 'number',
    default: 60,
    min: 0,
    max: 600,
    category: 'Levels',
    label: 'XP cooldown (seconds)',
    description: 'Minimum delay between two XP-earning messages.',
  },
  'levels.multiplier': {
    type: 'number',
    default: 1,
    min: 1,
    max: 10,
    category: 'Levels',
    label: 'XP multiplier',
    description: 'Multiplies all XP gained in this server.',
  },
  'levels.stackRoles': {
    type: 'boolean',
    default: true,
    category: 'Levels',
    label: 'Stack level roles',
    description: 'Keep old level roles instead of replacing them.',
  },
  'levels.ignoredChannels': {
    type: 'channels',
    default: [],
    category: 'Levels',
    label: 'Ignored channels',
    description: 'No XP is earned in these channels.',
  },
  'levels.ignoredRoles': {
    type: 'roles',
    default: [],
    category: 'Levels',
    label: 'Ignored roles',
    description: 'Members with these roles earn no XP.',
  },

  /* ── Logging ─────────────────────────────────────────────────────── */
  'logs.enabled': {
    type: 'boolean',
    default: false,
    category: 'Logging',
    label: 'Enable logging',
    description: 'Master switch for every log type below.',
  },
  'logs.channel': {
    type: 'channel',
    default: null,
    category: 'Logging',
    label: 'Default log channel',
    description: 'Used for any log type without its own channel.',
  },
  'logs.moderation': {
    type: 'channel',
    default: null,
    category: 'Logging',
    label: 'Moderation log',
    description: 'Bans, kicks, mutes, warns, purges.',
  },
  'logs.messages': {
    type: 'channel',
    default: null,
    category: 'Logging',
    label: 'Message log',
    description: 'Edited and deleted messages.',
  },
  'logs.members': {
    type: 'channel',
    default: null,
    category: 'Logging',
    label: 'Member log',
    description: 'Joins, leaves, nickname and role changes.',
  },
  'logs.server': {
    type: 'channel',
    default: null,
    category: 'Logging',
    label: 'Server log',
    description: 'Channel, role and emoji changes.',
  },
  'logs.voice': {
    type: 'channel',
    default: null,
    category: 'Logging',
    label: 'Voice log',
    description: 'Voice joins, leaves and moves.',
  },
  'logs.ignoredChannels': {
    type: 'channels',
    default: [],
    category: 'Logging',
    label: 'Ignored channels',
    description: 'Activity in these channels is never logged.',
  },

  /* ── Automod ─────────────────────────────────────────────────────── */
  'automod.enabled': {
    type: 'boolean',
    default: false,
    category: 'Automod',
    label: 'Enable automod',
    description: 'Master switch for the automatic content filters.',
  },
  'automod.invites': {
    type: 'boolean',
    default: false,
    category: 'Automod',
    label: 'Block invites',
    description: 'Delete messages containing Discord invite links.',
  },
  'automod.links': {
    type: 'boolean',
    default: false,
    category: 'Automod',
    label: 'Block links',
    description: 'Delete messages containing any URL.',
  },
  'automod.spam': {
    type: 'boolean',
    default: false,
    category: 'Automod',
    label: 'Anti-spam',
    description: 'Punish members who send messages too quickly.',
  },
  'automod.spamThreshold': {
    type: 'number',
    default: 5,
    min: 3,
    max: 20,
    category: 'Automod',
    label: 'Spam threshold',
    description: 'Messages within 5 seconds before anti-spam triggers.',
  },
  'automod.caps': {
    type: 'boolean',
    default: false,
    category: 'Automod',
    label: 'Block excessive caps',
    description: 'Delete messages that are mostly uppercase.',
  },
  'automod.capsThreshold': {
    type: 'number',
    default: 70,
    min: 30,
    max: 100,
    category: 'Automod',
    label: 'Caps threshold (%)',
    description: 'Percentage of uppercase letters that counts as shouting.',
  },
  'automod.mentions': {
    type: 'number',
    default: 0,
    min: 0,
    max: 20,
    category: 'Automod',
    label: 'Max mentions',
    description: 'Mentions allowed per message. 0 disables the check.',
  },
  'automod.emojis': {
    type: 'number',
    default: 0,
    min: 0,
    max: 50,
    category: 'Automod',
    label: 'Max emojis',
    description: 'Emojis allowed per message. 0 disables the check.',
  },
  'automod.words': {
    type: 'strings',
    default: [],
    category: 'Automod',
    label: 'Blocked words',
    description: 'Messages containing any of these words are deleted.',
  },
  'automod.action': {
    type: 'select',
    default: 'delete',
    options: ['delete', 'warn', 'timeout', 'kick', 'ban'],
    category: 'Automod',
    label: 'Punishment',
    description: 'What happens to a member who trips a filter.',
  },
  'automod.timeoutDuration': {
    type: 'number',
    default: 300,
    min: 60,
    max: 2419200,
    category: 'Automod',
    label: 'Timeout length (seconds)',
    description: 'How long the timeout punishment lasts.',
  },
  'automod.exemptRoles': {
    type: 'roles',
    default: [],
    category: 'Automod',
    label: 'Exempt roles',
    description: 'Members with these roles bypass automod.',
  },
  'automod.exemptChannels': {
    type: 'channels',
    default: [],
    category: 'Automod',
    label: 'Exempt channels',
    description: 'Automod never runs in these channels.',
  },

  /* ── Antinuke ────────────────────────────────────────────────────── */
  'antinuke.enabled': {
    type: 'boolean',
    default: false,
    category: 'Antinuke',
    label: 'Enable antinuke',
    description: 'Watch for destructive admin actions and stop them.',
  },
  'antinuke.punishment': {
    type: 'select',
    default: 'strip',
    options: ['strip', 'kick', 'ban'],
    category: 'Antinuke',
    label: 'Punishment',
    description: 'What happens to someone who trips the antinuke.',
  },
  'antinuke.threshold': {
    type: 'number',
    default: 3,
    min: 1,
    max: 20,
    category: 'Antinuke',
    label: 'Threshold',
    description: 'Destructive actions allowed within 60 seconds.',
  },
  'antinuke.channelDelete': {
    type: 'boolean',
    default: true,
    category: 'Antinuke',
    label: 'Watch channel deletes',
    description: 'Count mass channel deletions.',
  },
  'antinuke.roleDelete': {
    type: 'boolean',
    default: true,
    category: 'Antinuke',
    label: 'Watch role deletes',
    description: 'Count mass role deletions.',
  },
  'antinuke.bans': {
    type: 'boolean',
    default: true,
    category: 'Antinuke',
    label: 'Watch mass bans',
    description: 'Count rapid bans by a single moderator.',
  },
  'antinuke.kicks': {
    type: 'boolean',
    default: true,
    category: 'Antinuke',
    label: 'Watch mass kicks',
    description: 'Count rapid kicks by a single moderator.',
  },
  'antinuke.webhooks': {
    type: 'boolean',
    default: true,
    category: 'Antinuke',
    label: 'Watch webhook creation',
    description: 'Webhooks are the usual delivery method for nuke spam.',
  },
  'antinuke.botAdd': {
    type: 'boolean',
    default: false,
    category: 'Antinuke',
    label: 'Block new bots',
    description: 'Kick any bot added by someone who is not whitelisted.',
  },
  'antinuke.logChannel': {
    type: 'channel',
    default: null,
    category: 'Antinuke',
    label: 'Antinuke log',
    description: 'Where antinuke alerts are posted.',
  },

  /* ── Antiraid ────────────────────────────────────────────────────── */
  'antiraid.enabled': {
    type: 'boolean',
    default: false,
    category: 'Antiraid',
    label: 'Enable antiraid',
    description: 'React automatically to floods of new members.',
  },
  'antiraid.joinThreshold': {
    type: 'number',
    default: 8,
    min: 2,
    max: 50,
    category: 'Antiraid',
    label: 'Join threshold',
    description: 'Joins within 10 seconds that count as a raid.',
  },
  'antiraid.action': {
    type: 'select',
    default: 'lockdown',
    options: ['lockdown', 'kick', 'ban'],
    category: 'Antiraid',
    label: 'Raid response',
    description: 'What to do when a raid is detected.',
  },
  'antiraid.minAccountAge': {
    type: 'number',
    default: 0,
    min: 0,
    max: 365,
    category: 'Antiraid',
    label: 'Minimum account age (days)',
    description: 'Kick accounts younger than this. 0 disables the check.',
  },
  'antiraid.noAvatar': {
    type: 'boolean',
    default: false,
    category: 'Antiraid',
    label: 'Block default avatars',
    description: 'Kick joining members who have no custom avatar.',
  },

  /* ── Starboard ───────────────────────────────────────────────────── */
  'starboard.enabled': {
    type: 'boolean',
    default: false,
    category: 'Starboard',
    label: 'Enable starboard',
    description: 'Repost popular messages to a highlights channel.',
  },
  'starboard.channel': {
    type: 'channel',
    default: null,
    category: 'Starboard',
    label: 'Starboard channel',
    description: 'Where starred messages are reposted.',
  },
  'starboard.emoji': {
    type: 'string',
    default: '⭐',
    category: 'Starboard',
    label: 'Star emoji',
    description: 'The reaction that counts as a star.',
    max: 64,
  },
  'starboard.threshold': {
    type: 'number',
    default: 3,
    min: 1,
    max: 100,
    category: 'Starboard',
    label: 'Required stars',
    description: 'Stars needed before a message is reposted.',
  },
  'starboard.selfStar': {
    type: 'boolean',
    default: false,
    category: 'Starboard',
    label: 'Allow self-starring',
    description: 'Count the author’s own star.',
  },
  'starboard.ignoredChannels': {
    type: 'channels',
    default: [],
    category: 'Starboard',
    label: 'Ignored channels',
    description: 'Messages here never reach the starboard.',
  },

  /* ── Tickets ─────────────────────────────────────────────────────── */
  'tickets.enabled': {
    type: 'boolean',
    default: false,
    category: 'Tickets',
    label: 'Enable tickets',
    description: 'Let members open private support channels.',
  },
  'tickets.category': {
    type: 'category',
    default: null,
    category: 'Tickets',
    label: 'Ticket category',
    description: 'New ticket channels are created here.',
  },
  'tickets.supportRole': {
    type: 'role',
    default: null,
    category: 'Tickets',
    label: 'Support role',
    description: 'Role granted access to every ticket.',
  },
  'tickets.logChannel': {
    type: 'channel',
    default: null,
    category: 'Tickets',
    label: 'Transcript channel',
    description: 'Where transcripts are posted when a ticket closes.',
  },
  'tickets.openMessage': {
    type: 'template',
    default: '{embed}{color: #8b5cf6}$v{title: Support ticket}$v{description: Thanks for reaching out, {user.mention}. Describe your issue and a staff member will be with you shortly.}',
    category: 'Tickets',
    label: 'Opening message',
    description: 'Posted inside a new ticket.',
  },
  'tickets.limit': {
    type: 'number',
    default: 1,
    min: 1,
    max: 10,
    category: 'Tickets',
    label: 'Tickets per member',
    description: 'How many tickets one member may have open at once.',
  },

  /* ── Economy ─────────────────────────────────────────────────────── */
  'economy.enabled': {
    type: 'boolean',
    default: true,
    category: 'Economy',
    label: 'Enable economy',
    description: 'Currency, gambling, daily rewards and the shop.',
  },
  'economy.symbol': {
    type: 'string',
    default: '💵',
    category: 'Economy',
    label: 'Currency symbol',
    description: 'Shown next to every balance.',
    max: 32,
  },
  'economy.currencyName': {
    type: 'string',
    default: 'coins',
    category: 'Economy',
    label: 'Currency name',
    description: 'What your currency is called.',
    max: 32,
  },
  'economy.dailyAmount': {
    type: 'number',
    default: 500,
    min: 1,
    max: 1000000,
    category: 'Economy',
    label: 'Daily reward',
    description: 'Base amount handed out by the daily command.',
  },
  'economy.startingBalance': {
    type: 'number',
    default: 100,
    min: 0,
    max: 1000000,
    category: 'Economy',
    label: 'Starting balance',
    description: 'What a member begins with.',
  },

  /* ── Music ───────────────────────────────────────────────────────── */
  'music.enabled': {
    type: 'boolean',
    default: true,
    category: 'Music',
    label: 'Enable music',
    description: 'Voice playback commands.',
  },
  'music.djRole': {
    type: 'role',
    default: null,
    category: 'Music',
    label: 'DJ role',
    description: 'Required for skip/stop/volume when the queue is busy.',
  },
  'music.defaultVolume': {
    type: 'number',
    default: 60,
    min: 1,
    max: 150,
    category: 'Music',
    label: 'Default volume',
    description: 'Volume a fresh player starts at.',
  },
  'music.maxQueue': {
    type: 'number',
    default: 200,
    min: 10,
    max: 1000,
    category: 'Music',
    label: 'Max queue length',
    description: 'How many tracks can be queued at once.',
  },
  'music.leaveOnEmpty': {
    type: 'boolean',
    default: true,
    category: 'Music',
    label: 'Leave when alone',
    description: 'Disconnect when the last listener leaves.',
  },
  'music.textChannel': {
    type: 'channel',
    default: null,
    category: 'Music',
    label: 'Music commands channel',
    description: 'Restrict music commands to one channel. Empty = anywhere.',
  },

  /* ── VoiceMaster ─────────────────────────────────────────────────── */
  'voicemaster.enabled': {
    type: 'boolean',
    default: false,
    category: 'VoiceMaster',
    label: 'Enable VoiceMaster',
    description: 'Members get their own temporary voice channel.',
  },
  'voicemaster.joinChannel': {
    type: 'channel',
    default: null,
    category: 'VoiceMaster',
    label: 'Join-to-create channel',
    description: 'Joining this channel creates a personal one.',
  },
  'voicemaster.category': {
    type: 'category',
    default: null,
    category: 'VoiceMaster',
    label: 'Channel category',
    description: 'Where temporary channels are created.',
  },
  'voicemaster.nameTemplate': {
    type: 'string',
    default: "{user.name}'s channel",
    category: 'VoiceMaster',
    label: 'Channel name',
    description: 'Name given to a new temporary channel.',
    max: 90,
  },
  'voicemaster.userLimit': {
    type: 'number',
    default: 0,
    min: 0,
    max: 99,
    category: 'VoiceMaster',
    label: 'Default user limit',
    description: '0 means unlimited.',
  },

  /* ── Moderation ──────────────────────────────────────────────────── */
  'moderation.muteRole': {
    type: 'role',
    default: null,
    category: 'Moderation',
    label: 'Mute role',
    description: 'Role applied by the mute command. Created automatically if unset.',
  },
  'moderation.jailRole': {
    type: 'role',
    default: null,
    category: 'Moderation',
    label: 'Jail role',
    description: 'Role applied by the jail command.',
  },
  'moderation.jailChannel': {
    type: 'channel',
    default: null,
    category: 'Moderation',
    label: 'Jail channel',
    description: 'The only channel jailed members can see.',
  },
  'moderation.warnThreshold': {
    type: 'number',
    default: 0,
    min: 0,
    max: 20,
    category: 'Moderation',
    label: 'Auto-punish after N warns',
    description: 'Apply the punishment below at this many warns. 0 disables it.',
  },
  'moderation.warnPunishment': {
    type: 'select',
    default: 'timeout',
    options: ['timeout', 'kick', 'ban'],
    category: 'Moderation',
    label: 'Warn punishment',
    description: 'Applied once the warn threshold is reached.',
  },
  'moderation.protectedRoles': {
    type: 'roles',
    default: [],
    category: 'Moderation',
    label: 'Protected roles',
    description: 'Members with these roles cannot be punished by the bot.',
  },
  'moderation.confirmDestructive': {
    type: 'boolean',
    default: true,
    category: 'Moderation',
    label: 'Confirm destructive commands',
    description: 'Ask before strip, nuke, mass-ban and similar commands.',
  },

  /* ── Autoroles ───────────────────────────────────────────────────── */
  'autorole.enabled': {
    type: 'boolean',
    default: false,
    category: 'Autorole',
    label: 'Enable autorole',
    description: 'Give roles automatically when a member joins.',
  },
  'autorole.roles': {
    type: 'roles',
    default: [],
    category: 'Autorole',
    label: 'Roles for members',
    description: 'Granted to every human who joins.',
  },
  'autorole.botRoles': {
    type: 'roles',
    default: [],
    category: 'Autorole',
    label: 'Roles for bots',
    description: 'Granted to bots that are added.',
  },
  'autorole.delay': {
    type: 'number',
    default: 0,
    min: 0,
    max: 3600,
    category: 'Autorole',
    label: 'Delay (seconds)',
    description: 'Wait before granting roles — useful against raids.',
  },

  /* ── Fun ─────────────────────────────────────────────────────────── */
  'fun.enabled': {
    type: 'boolean',
    default: true,
    category: 'Fun',
    label: 'Enable fun commands',
    description: 'Games, images and the silly commands.',
  },
  'fun.snipeEnabled': {
    type: 'boolean',
    default: true,
    category: 'Fun',
    label: 'Enable snipe',
    description: 'Let members recover recently deleted messages.',
  },
  'fun.snipeIgnored': {
    type: 'channels',
    default: [],
    category: 'Fun',
    label: 'Snipe-free channels',
    description: 'Deleted messages here are never stored.',
  },
  'fun.afkEnabled': {
    type: 'boolean',
    default: true,
    category: 'Fun',
    label: 'Enable AFK',
    description: 'Members can mark themselves away.',
  },
};

/** All distinct categories, in display order. */
const CATEGORIES = [
  'General',
  'Appearance',
  'Welcome',
  'Goodbye',
  'Boost',
  'Levels',
  'Logging',
  'Automod',
  'Antinuke',
  'Antiraid',
  'Starboard',
  'Tickets',
  'Economy',
  'Music',
  'VoiceMaster',
  'Moderation',
  'Autorole',
  'Fun',
];

const CATEGORY_META = {
  General: { icon: 'sliders', blurb: 'Core behaviour of the bot in this server.' },
  Appearance: { icon: 'palette', blurb: 'Colours and styling for every embed.' },
  Welcome: { icon: 'door-open', blurb: 'Greet new members.' },
  Goodbye: { icon: 'door-closed', blurb: 'Say farewell when members leave.' },
  Boost: { icon: 'sparkles', blurb: 'Celebrate server boosters.' },
  Levels: { icon: 'trending-up', blurb: 'XP, ranks and level rewards.' },
  Logging: { icon: 'scroll', blurb: 'Audit everything that happens.' },
  Automod: { icon: 'shield', blurb: 'Automatic content filtering.' },
  Antinuke: { icon: 'lock', blurb: 'Stop rogue admins destroying the server.' },
  Antiraid: { icon: 'users', blurb: 'Handle floods of new accounts.' },
  Starboard: { icon: 'star', blurb: 'Highlight the best messages.' },
  Tickets: { icon: 'ticket', blurb: 'Private support channels.' },
  Economy: { icon: 'coins', blurb: 'Currency, gambling and the shop.' },
  Music: { icon: 'music', blurb: 'Voice playback settings.' },
  VoiceMaster: { icon: 'mic', blurb: 'Temporary personal voice channels.' },
  Moderation: { icon: 'gavel', blurb: 'Punishment defaults and safety rails.' },
  Autorole: { icon: 'user-plus', blurb: 'Roles handed out on join.' },
  Fun: { icon: 'smile', blurb: 'Games and toys.' },
};

/** A fresh object containing every default value. */
function defaultsFor() {
  const out = {};
  for (const [key, meta] of Object.entries(SETTINGS)) {
    out[key] = structuredClone(meta.default);
  }
  return out;
}

/** Coerce and validate a value coming from the dashboard. */
function coerce(key, raw) {
  const meta = SETTINGS[key];
  if (!meta) return { ok: false, error: 'Unknown setting' };

  switch (meta.type) {
    case 'boolean':
      return { ok: true, value: raw === true || raw === 'true' || raw === 'on' || raw === 1 };

    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: 'Must be a number' };
      if (meta.min !== undefined && n < meta.min) return { ok: false, error: `Minimum is ${meta.min}` };
      if (meta.max !== undefined && n > meta.max) return { ok: false, error: `Maximum is ${meta.max}` };
      return { ok: true, value: Math.round(n) };
    }

    case 'color': {
      const value = String(raw || '').trim();
      if (!/^#?[0-9a-f]{6}$/i.test(value)) return { ok: false, error: 'Must be a hex colour like #8b5cf6' };
      return { ok: true, value: value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}` };
    }

    case 'select': {
      const value = String(raw);
      if (!meta.options.includes(value)) return { ok: false, error: 'Not an allowed option' };
      return { ok: true, value };
    }

    case 'channel':
    case 'category':
    case 'role': {
      const value = String(raw || '').trim();
      if (!value) return { ok: true, value: null };
      if (!/^\d{15,25}$/.test(value)) return { ok: false, error: 'Not a valid ID' };
      return { ok: true, value };
    }

    case 'roles':
    case 'channels': {
      const arr = Array.isArray(raw) ? raw : String(raw || '').split(',');
      const ids = arr.map((v) => String(v).trim()).filter(Boolean);
      if (ids.some((id) => !/^\d{15,25}$/.test(id))) return { ok: false, error: 'Contains an invalid ID' };
      return { ok: true, value: [...new Set(ids)].slice(0, 50) };
    }

    case 'strings': {
      const arr = Array.isArray(raw) ? raw : String(raw || '').split('\n');
      const values = arr.map((v) => String(v).trim()).filter(Boolean);
      return { ok: true, value: [...new Set(values)].slice(0, 250) };
    }

    case 'string': {
      const value = String(raw ?? '');
      if (meta.max && value.length > meta.max) return { ok: false, error: `Max ${meta.max} characters` };
      return { ok: true, value };
    }

    case 'text':
    case 'template': {
      const value = String(raw ?? '');
      if (value.length > 4000) return { ok: false, error: 'Max 4000 characters' };
      return { ok: true, value };
    }

    default:
      return { ok: false, error: 'Unsupported type' };
  }
}

module.exports = { SETTINGS, CATEGORIES, CATEGORY_META, defaultsFor, coerce };
