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
    scope['channel.id'] = channel.id;
  }

  const now = new Date();
  scope.date = now.toDateString();
  scope.time = now.toTimeString().slice(0, 8);

  return scope;
}

/**
 * Other bots spell these differently — snake_case, `server` for `guild`, a
 * bare `{user}` for the mention. Map their names onto ours so a template
 * copied from elsewhere resolves instead of printing `{member.count}` as
 * text.
 */
const VARIABLE_ALIASES = {
  user: 'user.mention',
  member: 'user.mention',
  'user.username': 'user.name',
  'user.displayname': 'user.display',
  'user.display_name': 'user.display',
  'user.nickname': 'user.display',
  'user.nick': 'user.display',
  'user.avatar_url': 'user.avatar',
  'user.icon': 'user.avatar',
  'user.created_at': 'user.created',
  'user.joined_at': 'user.joined',
  'member.count': 'guild.count',
  'member.id': 'user.id',
  'member.mention': 'user.mention',
  'member.name': 'user.name',
  'member.avatar': 'user.avatar',
  'guild.member_count': 'guild.count',
  'guild.members': 'guild.count',
  'guild.icon_url': 'guild.icon',
  'guild.boost_count': 'guild.boosts',
  'guild.boosts_count': 'guild.boosts',
  'guild.boost_tier': 'guild.tier',
  'server.name': 'guild.name',
  'server.id': 'guild.id',
  'server.icon': 'guild.icon',
  'server.count': 'guild.count',
  'server.members': 'guild.count',
  'channel.id': 'channel.id',
};

/**
 * Resolve `/emojiname` into that server's custom emoji, `/emojinamex3` into
 * three of it.
 *
 * This is how templates written for other bots do spacing: a transparent
 * emoji repeated a few times is a fixed-width blank that Discord will not
 * collapse the way it collapses spaces. Without this the alias prints as
 * literal text and every bit of alignment in the template is lost.
 *
 * URLs are held back first. A link ending `/guide` must not turn into an
 * emoji because the server happens to have one by that name.
 */
function applyEmojiAliases(text, guild) {
  const cache = guild?.emojis?.cache;
  if (!cache || typeof text !== 'string' || !text.includes('/')) return text;

  const urls = [];
  const masked = text.replace(/<a?:\w+:\d+>|https?:\/\/\S+/gi, (match) => {
    urls.push(match);
    return `\u0000${urls.length - 1}\u0000`;
  });

  const resolved = masked.replace(/\/([a-z0-9_]+?)(?:x(\d{1,2}))?(?![a-z0-9_])/gi, (match, name, times) => {
    const wanted = name.toLowerCase();
    const emoji = typeof cache.find === 'function'
      ? cache.find((candidate) => candidate.name?.toLowerCase() === wanted)
      : undefined;
    if (!emoji) return match; // Not one of ours — leave it exactly as written.
    return String(emoji).repeat(Math.min(Math.max(Number(times) || 1, 1), 25));
  });

  return resolved.replace(/\u0000(\d+)\u0000/g, (_, index) => urls[Number(index)]);
}

/** Replace {variables} in a string. Unknown variables are left untouched. */
function apply(text, scope) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{([a-z0-9_.]+)\}/gi, (match, name) => {
    const key = name.toLowerCase();
    let value = scope[key];
    if (value === undefined) value = scope[VARIABLE_ALIASES[key]];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Strip only ordinary spaces, tabs and newlines from the ends of a value.
 *
 * Padding a line with wide blanks is how people centre and indent text in a
 * Discord embed — there is no alignment to set — so an em space or a braille
 * blank at the start of a description is deliberate and has to survive. A
 * plain `.trim()` eats those, silently flattening the layout someone wrote.
 */
function trimOuter(value) {
  return value.replace(/^[ \t\r\n]+/, '').replace(/[ \t\r\n]+$/, '');
}

/** Split "{key: value}" into its two halves. */
function parsePart(raw) {
  let trimmed = raw.trim().replace(/^\{/, '');
  // Drop the part's own closing brace, but only when there is one to drop.
  // `{thumbnail: {user.avatar}` — a real mistake people make, and one other
  // bots forgive — is already balanced once the opening brace is gone, and
  // stripping again would eat the variable's brace and break the value.
  const opens = (trimmed.match(/\{/g) ?? []).length;
  const closes = (trimmed.match(/\}/g) ?? []).length;
  if (closes > opens) trimmed = trimmed.replace(/\}$/, '');
  const separator = trimmed.indexOf(':');
  if (separator === -1) return { key: trimmed.toLowerCase().trim(), value: '' };
  return {
    key: trimmed.slice(0, separator).toLowerCase().trim(),
    value: trimOuter(trimmed.slice(separator + 1)),
  };
}

/** "a && b && c" — used by author/footer/field which take several values. */
function splitValues(value) {
  return value.split('&&').map((piece) => trimOuter(piece));
}

/** `<:name:id>`, `<a:name:id>`, or a bare unicode emoji. */
function looksLikeEmoji(piece) {
  if (/^<a?:[\w~]+:\d+>$/.test(piece)) return true;
  return piece.length > 0 && piece.length <= 8 && !/[\w\s]/.test(piece) && /\p{Extended_Pictographic}/u.test(piece);
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
  // A literal "\n" is treated as a line break. Some ways of getting a
  // template into the bot cannot carry a real one, and a template that has
  // been flattened onto a single line is badly broken in ways that are not
  // obvious — `-#` stops applying, blank lines vanish — so this gives a
  // spelling of "new line here" that nothing in between can eat.
  const text = applyEmojiAliases(
    apply(String(template ?? '').replace(/\\n/g, '\n'), scope),
    context.guild,
  );

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
        // `message` is what some other bots call this; accept both so their
        // templates paste in unchanged.
        case 'content':
        case 'message':
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
          // Other bots order these differently and tack on extra words, so
          // rather than trusting position, work out what each part is: the
          // URL, the style name and the emoji identify themselves, and what
          // is left over is the label. That way a template written for
          // another bot pastes in and still produces the right button.
          const parts = splitValues(value).filter(Boolean);
          const urlAt = parts.findIndex((piece) => /^https?:\/\//i.test(piece));
          const emojiAt = parts.findIndex((piece, index) => index !== urlAt && looksLikeEmoji(piece));
          const styleAt = parts.findIndex(
            (piece, index) =>
              index !== urlAt && index !== emojiAt && BUTTON_STYLES[piece.toLowerCase()] !== undefined,
          );
          const rest = parts.filter((_, index) => index !== urlAt && index !== emojiAt && index !== styleAt);

          const url = urlAt === -1 ? '' : parts[urlAt];
          const emoji = emojiAt === -1 ? '' : parts[emojiAt];
          const named = styleAt === -1 ? undefined : BUTTON_STYLES[parts[styleAt].toLowerCase()];
          // A URL can only be a link button, whatever style name came with it.
          const resolvedStyle = url ? ButtonStyle.Link : named ?? ButtonStyle.Secondary;

          const label = rest[0] ?? '';
          if (!label && !emoji) break; // Discord rejects a button with neither.

          const button = new ButtonBuilder().setStyle(resolvedStyle);
          if (label) button.setLabel(truncate(label, 80));
          if (emoji) {
            // A bad emoji should cost the emoji, not the whole button.
            try {
              button.setEmoji(emoji);
            } catch {
              /* ignore */
            }
          }

          if (resolvedStyle === ButtonStyle.Link) button.setURL(url);
          else button.setCustomId(truncate(rest[1] || label || emoji, 100));

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

module.exports = { render, apply, applyEmojiAliases, buildScope, stringify, VARIABLES };
