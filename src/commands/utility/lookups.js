'use strict';

const { fetchJson } = require('../../lib/http');
const { truncate, random } = require('../../lib/util');
const emojis = require('../../lib/emojis');
const config = require('../../config');

/** Urban Dictionary wraps linked terms in [brackets]; they read badly in Discord. */
function stripBrackets(text) {
  return String(text ?? '').replace(/[[\]]/g, '');
}

module.exports = [
  {
    name: 'weather',
    category: 'Utility',
    description: 'Current weather for a place.',
    details: 'Needs an OpenWeather API key on the bot. Give a city, or "city, country code" to be specific.',
    usage: '<place>',
    examples: ['weather london', 'weather paris, fr'],
    guildOnly: false,
    cooldown: 5,
    args: [{ name: 'place', type: 'rest', required: true, description: 'city name, optionally with a country code' }],
    async run(ctx) {
      if (!config.api.weather) {
        return ctx.error('Weather is not set up on this bot — the owner needs to add `WEATHER_API_KEY`.');
      }

      await ctx.defer();
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ctx.args.place)}&units=metric&appid=${config.api.weather}`;
      const result = await fetchJson(url);

      if (result.status === 404) return ctx.error(`I could not find **${truncate(ctx.args.place, 60)}**.`);
      if (!result.ok) return ctx.error('The weather service is not responding right now.');

      const data = result.data;
      const icon = data.weather?.[0]?.icon;

      return ctx.send({
        embeds: [
          ctx.embed({
            title: `${data.name}${data.sys?.country ? `, ${data.sys.country}` : ''}`,
            description: `**${Math.round(data.main.temp)}°C** — ${data.weather?.[0]?.description ?? 'unknown'}`,
            thumbnail: icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : null,
            fields: [
              { name: 'Feels like', value: `${Math.round(data.main.feels_like)}°C`, inline: true },
              { name: 'Humidity', value: `${data.main.humidity}%`, inline: true },
              { name: 'Wind', value: `${Math.round((data.wind?.speed ?? 0) * 3.6)} km/h`, inline: true },
              { name: 'Min / max', value: `${Math.round(data.main.temp_min)}° / ${Math.round(data.main.temp_max)}°`, inline: true },
              { name: 'Pressure', value: `${data.main.pressure} hPa`, inline: true },
              {
                name: 'Sunrise / sunset',
                value: `<t:${data.sys.sunrise}:t> / <t:${data.sys.sunset}:t>`,
                inline: true,
              },
            ],
          }),
        ],
      });
    },
  },

  {
    name: 'urban',
    aliases: ['ud', 'urbandictionary'],
    category: 'Utility',
    description: 'Look a term up on Urban Dictionary.',
    details: 'Results are user-written and often rude. Best kept to channels where that is fine.',
    usage: '<term>',
    examples: ['urban yeet'],
    cooldown: 4,
    args: [{ name: 'term', type: 'rest', required: true, description: 'what to look up' }],
    async run(ctx) {
      await ctx.defer();
      const result = await fetchJson(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(ctx.args.term)}`);
      if (!result.ok) return ctx.error('Urban Dictionary is not responding right now.');

      const entries = result.data?.list ?? [];
      if (!entries.length) return ctx.error(`No definition for **${truncate(ctx.args.term, 60)}**.`);

      entries.sort((a, b) => b.thumbs_up - a.thumbs_up);

      const pages = entries.slice(0, 10).map((entry, index) =>
        ctx.embed({
          title: truncate(entry.word, 250),
          description: truncate(stripBrackets(entry.definition), 2000),
          fields: entry.example
            ? [{ name: 'Example', value: truncate(stripBrackets(entry.example), 1000), inline: false }]
            : [],
          footer: {
            text: `👍 ${entry.thumbs_up}  👎 ${entry.thumbs_down} • ${index + 1} of ${Math.min(10, entries.length)}`,
          },
        }).setURL(entry.permalink),
      );

      return ctx.paginate(pages);
    },
  },

  {
    name: 'define',
    aliases: ['dictionary'],
    category: 'Utility',
    description: 'Look a word up in a proper dictionary.',
    usage: '<word>',
    examples: ['define serendipity'],
    guildOnly: false,
    cooldown: 4,
    args: [{ name: 'word', type: 'string', required: true, description: 'the word to define' }],
    async run(ctx) {
      await ctx.defer();
      const result = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(ctx.args.word)}`);

      if (result.status === 404) return ctx.error(`**${truncate(ctx.args.word, 40)}** is not in the dictionary.`);
      if (!result.ok) return ctx.error('The dictionary service is not responding right now.');

      const entry = result.data?.[0];
      if (!entry) return ctx.error('No definition found.');

      const fields = (entry.meanings ?? []).slice(0, 5).map((meaning) => ({
        name: meaning.partOfSpeech,
        value: truncate(
          meaning.definitions
            .slice(0, 3)
            .map((definition, index) => `${index + 1}. ${definition.definition}`)
            .join('\n'),
          1000,
        ),
        inline: false,
      }));

      const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text;

      return ctx.send({
        embeds: [
          ctx.embed({
            title: entry.word,
            description: phonetic ? `*${phonetic}*` : undefined,
            fields,
          }),
        ],
      });
    },
  },

  {
    name: 'cat',
    category: 'Fun',
    description: 'A random picture of a cat.',
    examples: ['cat'],
    cooldown: 4,
    async run(ctx) {
      await ctx.defer();
      const result = await fetchJson('https://api.thecatapi.com/v1/images/search');
      const url = result.data?.[0]?.url;
      if (!url) return ctx.error('The cat service is napping. Try again shortly.');
      return ctx.send({ embeds: [ctx.embed({ title: '🐈 Cat', image: url })] });
    },
  },

  {
    name: 'dog',
    category: 'Fun',
    description: 'A random picture of a dog.',
    examples: ['dog'],
    cooldown: 4,
    async run(ctx) {
      await ctx.defer();
      const result = await fetchJson('https://dog.ceo/api/breeds/image/random');
      const url = result.data?.message;
      if (!url) return ctx.error('The dog service is out for a walk. Try again shortly.');
      return ctx.send({ embeds: [ctx.embed({ title: '🐕 Dog', image: url })] });
    },
  },

  {
    name: 'joke',
    category: 'Fun',
    description: 'A (mostly) clean joke.',
    examples: ['joke'],
    cooldown: 4,
    async run(ctx) {
      await ctx.defer();
      const result = await fetchJson('https://official-joke-api.appspot.com/random_joke');
      if (!result.ok || !result.data?.setup) {
        // A local fallback means the command still works when the API is down.
        return ctx.send({
          embeds: [
            ctx.embed({
              description: random([
                'I told my computer I needed a break — now it will not stop sending me KitKat ads.',
                'There are 10 kinds of people: those who understand binary and those who do not.',
                'I would tell you a UDP joke, but you might not get it.',
              ]),
            }),
          ],
        });
      }
      return ctx.send({
        embeds: [ctx.embed({ description: `${result.data.setup}\n\n||${result.data.punchline}||` })],
      });
    },
  },

  {
    name: 'advice',
    category: 'Fun',
    description: 'Some unsolicited advice.',
    examples: ['advice'],
    cooldown: 4,
    async run(ctx) {
      await ctx.defer();
      const result = await fetchJson('https://api.adviceslip.com/advice');
      const advice = result.data?.slip?.advice;
      if (!advice) return ctx.error('No advice today. Try again shortly.');
      return ctx.send({ embeds: [ctx.embed({ description: `${emojis.sparkle} ${advice}` })] });
    },
  },
];
