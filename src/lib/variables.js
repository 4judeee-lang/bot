'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { resolveColor, truncate } = require('./util');

/**
 * The message template language.
 *
 * Plain text works as-is:
 *     Welcome {user.mention} to {guild.name}!
 *
 * For an embed, start with {embed} and separate parts with $v:
 *     {embed}{color: #8b5cf6}$v{title: Hello}$v{description: Hi {user.name}}
 *
 * Supported parts: content, color, title, url, description, thumbnail, image,
 * author, footer, field, timestamp, button.
 */

/** Every variable that can appear in a template, with a doc string for the dashboard. */
const VARIABLES = [
  { name: 'user.mention', description: 'Pings the member (@name)' },
  { name: 'user.name', description: 'Username, without the tag' },
  { name: 'user.display', description: 'Server nickname, or username' },
  { name: 'user.tag', description: 'Full username#0000 handle' },
  { name: 'user.id', description: 'Their user ID' },
  { name: 'user.avatar', description: 'URL of their avatar' },
  { name: 'user.created', description: 'When the account was made' },
  { name: 'user.joined', description: 'When they joined the server' },
  { name: 'guild.name', description: 'Server name' },
  { name: 'guild.id', description: 'Server ID' },
  { name: 'guild.icon', description: 'URL of the server icon' },
  { name: 'guild.count', description: 'Current member count' },
  { name: 'guild.boosts', description: 'Number of boosts' },
  { name: 'guild.tier', description: 'Boost tier (0-3)' },
  { name: 'guild.owner', description: 'Server owner’s name' },
  { name: 'channel.name', description: 'Channel the message is posted in' },
  { name: 'channel.mention', description: 'Clickable channel link' },
  { name: 'level', description: 'New level (level-up messages only)' },
  { name: 'xp', description: 'Current XP (level-up messages only)' },
  { name: 'inviter.name', description: 'Who invited them (welcome messages only)' },
  { name: 'date', description: 'Today’s date' },
  { name: 'time', description: 'Current time' },
];

/** Build the replacement table from whatever objects the caller has. */
function buildScope({ user, member, guild, channel, extra = {} } = {}) {
  const scope = { ...extra };
  const account = user ?? member?.user;

  if (account) {
    scope['user.mention'] = `<@${account.id}>`;
    scope['user.name'] = account.username;
    scope['user.display'] = member?.displayName ?? account.displayName ?? account.username;
    scope['user.tag'] = account.tag ?? account.username;
    scope['user.id'] = account.id;
    scope['user.avatar'] = account.displayAvatarURL?.({ size: 256 }) ?? '';
    scope['user.created'] = `<t:${Math.floor(account.createdTimestamp / 1000)}:R>`;
  }
  if (member?.joinedTimestamp) {
    scope['user.joined'] = `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`;
  }
  if (guild) {
    scope['guild.name'] = guild.name;
    scope['guild.id'] = guild.id;
    scope['guild.icon'] = guild.iconURL?.({ size: 256 }) ?? '';
    scope['guild.count'] = guild.memberCount ?? 0;
    scope['guild.boosts'] = guild.premiumSubscriptionCount ?? 0;
    scope['guild.tier'] = guild.premiumTier ?? 0;
    scope['guild.owner'] = guild.members?.cache?.get(guild.ownerId)?.user?.username ?? 'unknown';
  }
  if (channel) {
    scope['channel.name'] = channel.name ?? '';
    scope['channel.mention'] = `<#${channel.id}>`;
  }

  const now = new Date();
  scope.date = now.toDateString();
  scope.time = now.toTimeString().slice(0, 8);

  return scope;
}

/** Replace {variables} in a string. Unknown variables are left untouched. */
function apply(text, scope) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{([a-z0-9_.]+)\}/gi, (match, key) => {
    const value = scope[key.toLowerCase()];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Split "{key: value}" into its two halves. */
function parsePart(raw) {
  const trimmed = raw.trim().replace(/^\{/, '').replace(/\}$/, '');
  const separator = trimmed.indexOf(':');
  if (separator === -1) return { key: trimmed.toLowerCase().trim(), value: '' };
  return {
    key: trimmed.slice(0, separator).toLowerCase().trim(),
    value: trimmed.slice(separator + 1).trim(),
  };
}

/** "a && b && c" — used by author/footer/field which take several values. */
function splitValues(value) {
  return value.split('&&').map((piece) => piece.trim());
}

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

/**
 * Render a template into something `channel.send()` accepts.
 * Always returns an object — never throws on malformed input, because these
 * templates are written by server admins in a web form.
 */
function render(template, context = {}) {
  const scope = buildScope(context);
  const text = apply(String(template ?? ''), scope);

  if (!text.trim()) return { content: '' };
  if (!text.includes('{embed}')) return { content: truncate(text, 2000) };

  const body = text.slice(text.indexOf('{embed}') + '{embed}'.length);
  const embed = new EmbedBuilder();
  const buttons = [];
  let content = '';
  let touched = false;

  for (const segment of body.split('$v')) {
    const chunkText = segment.trim();
    if (!chunkText) continue;
    const { key, value } = parsePart(chunkText);
    if (!value && !['timestamp'].includes(key)) continue;

    try {
      switch (key) {
        case 'content':
          content = truncate(value, 2000);
          break;
        case 'color':
        case 'colour':
          embed.setColor(resolveColor(value));
          touched = true;
          break;
        case 'title':
          embed.setTitle(truncate(value, 256));
          touched = true;
          break;
        case 'url':
          embed.setURL(value);
          break;
        case 'description':
        case 'desc':
          embed.setDescription(truncate(value, 4096));
          touched = true;
          break;
        case 'thumbnail':
          embed.setThumbnail(value);
          touched = true;
          break;
        case 'image':
          embed.setImage(value);
          touched = true;
          break;
        case 'author': {
          const [name, icon, url] = splitValues(value);
          embed.setAuthor({
            name: truncate(name, 256),
            iconURL: icon || undefined,
            url: url || undefined,
          });
          touched = true;
          break;
        }
        case 'footer': {
          const [footerText, icon] = splitValues(value);
          embed.setFooter({ text: truncate(footerText, 2048), iconURL: icon || undefined });
          touched = true;
          break;
        }
        case 'field': {
          const [name, fieldValue, inline] = splitValues(value);
          embed.addFields({
            name: truncate(name || '​', 256),
            value: truncate(fieldValue || '​', 1024),
            inline: String(inline).toLowerCase() === 'true',
          });
          touched = true;
          break;
        }
        case 'timestamp':
          embed.setTimestamp(new Date());
          touched = true;
          break;
        case 'button': {
          const [label, target, style] = splitValues(value);
          const resolvedStyle = BUTTON_STYLES[String(style || '').toLowerCase()] ?? ButtonStyle.Link;
          const button = new ButtonBuilder().setLabel(truncate(label, 80));
          if (resolvedStyle === ButtonStyle.Link) button.setStyle(ButtonStyle.Link).setURL(target);
          else button.setStyle(resolvedStyle).setCustomId(truncate(target, 100));
          buttons.push(button);
          break;
        }
        default:
          break;
      }
    } catch {
      // A bad value (malformed URL, etc.) just skips that part rather than
      // breaking the whole message.
    }
  }

  const payload = { content: content || undefined };
  if (touched) payload.embeds = [embed];
  if (buttons.length) {
    payload.components = [new ActionRowBuilder().addComponents(buttons.slice(0, 5))];
  }
  if (!payload.content && !payload.embeds) payload.content = truncate(text, 2000);
  return payload;
}

/** Turn an embed back into template source — used by the dashboard preview. */
function stringify({ content, color, title, url, description, thumbnail, image, author, footer, fields = [] }) {
  const parts = [];
  if (content) parts.push(`{content: ${content}}`);
  if (color) parts.push(`{color: ${color}}`);
  if (title) parts.push(`{title: ${title}}`);
  if (url) parts.push(`{url: ${url}}`);
  if (description) parts.push(`{description: ${description}}`);
  if (thumbnail) parts.push(`{thumbnail: ${thumbnail}}`);
  if (image) parts.push(`{image: ${image}}`);
  if (author?.name) parts.push(`{author: ${[author.name, author.icon, author.url].filter(Boolean).join(' && ')}}`);
  if (footer?.text) parts.push(`{footer: ${[footer.text, footer.icon].filter(Boolean).join(' && ')}}`);
  for (const field of fields) {
    if (!field?.name) continue;
    parts.push(`{field: ${field.name} && ${field.value} && ${field.inline ? 'true' : 'false'}}`);
  }
  return parts.length ? `{embed}${parts.join('$v')}` : '';
}

module.exports = { render, apply, buildScope, stringify, VARIABLES };
