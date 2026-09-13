'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Loads every command file and indexes it.
 *
 * A command file exports either one command object or an array of them, so
 * related commands (e.g. all the ban variants) live together in one file.
 *
 * Command names may contain spaces — "antinuke whitelist" is a real command
 * name. Resolution tries the longest match first, which is how `.antinuke
 * whitelist @user` finds the right handler instead of a bare `antinuke`.
 */
class Registry {
  constructor() {
    this.commands = new Map(); // name -> command
    this.aliases = new Map(); // alias -> name
    this.categories = new Map(); // category -> command[]
    this.maxWords = 1;
  }

  get size() {
    return this.commands.size;
  }

  /** Every command, deduplicated and sorted. */
  all() {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  load(directory = path.join(__dirname, '..', 'commands')) {
    const files = this.#walk(directory);
    const problems = [];

    for (const file of files) {
      let exported;
      try {
        delete require.cache[require.resolve(file)];
        exported = require(file);
      } catch (error) {
        problems.push(`${path.basename(file)}: ${error.message}`);
        continue;
      }

      const commands = Array.isArray(exported) ? exported : [exported];
      for (const command of commands) {
        try {
          this.#register(command, file);
        } catch (error) {
          problems.push(`${path.basename(file)} → ${command?.name ?? '?'}: ${error.message}`);
        }
      }
    }

    if (problems.length) {
      const error = new Error(`Failed to load ${problems.length} command(s)`);
      error.problems = problems;
      throw error;
    }

    for (const list of this.categories.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return this;
  }

  #walk(directory) {
    if (!fs.existsSync(directory)) return [];
    const out = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) out.push(...this.#walk(full));
      else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_')) out.push(full);
    }
    return out.sort();
  }

  #register(command, file) {
    if (!command || typeof command !== 'object') throw new Error('export is not a command object');
    if (!command.name) throw new Error('missing `name`');
    if (typeof command.run !== 'function') throw new Error('missing `run()`');
    if (!command.description) throw new Error('missing `description`');
    if (!command.category) throw new Error('missing `category`');

    command.name = command.name.toLowerCase();
    if (this.commands.has(command.name)) throw new Error(`duplicate command name "${command.name}"`);

    command.aliases = (command.aliases ?? []).map((alias) => alias.toLowerCase());
    command.args = command.args ?? [];
    command.examples = command.examples ?? [];
    command.permissions = command.permissions ?? [];
    command.botPermissions = command.botPermissions ?? [];
    command.cooldown = command.cooldown ?? 2;
    command.guildOnly = command.guildOnly ?? true;
    command.file = file;
    command.words = command.name.split(' ').length;

    // Derive usage from the argument list when the author did not write one.
    if (!command.usage) {
      command.usage = command.args
        .map((arg) => (arg.required ? `<${arg.name}>` : `[${arg.name}]`))
        .join(' ');
    }

    this.maxWords = Math.max(this.maxWords, command.words);
    this.commands.set(command.name, command);

    for (const alias of command.aliases) {
      if (this.aliases.has(alias) || this.commands.has(alias)) {
        throw new Error(`alias "${alias}" already in use`);
      }
      this.aliases.set(alias, command.name);
    }

    if (!this.categories.has(command.category)) this.categories.set(command.category, []);
    this.categories.get(command.category).push(command);
  }

  /** Look up by exact name or alias. */
  get(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    return this.commands.get(key) ?? this.commands.get(this.aliases.get(key)) ?? null;
  }

  /**
   * Match the longest command name at the start of a token list.
   * Returns the command plus the tokens that are left over as arguments.
   */
  resolve(tokens) {
    for (let count = Math.min(this.maxWords, tokens.length); count >= 1; count--) {
      const candidate = tokens.slice(0, count).join(' ').toLowerCase();
      const command = this.get(candidate);
      if (command) return { command, rest: tokens.slice(count) };
    }
    return { command: null, rest: tokens };
  }

  /** Suggestions for "did you mean …". */
  closest(input, limit = 3) {
    const query = String(input || '').toLowerCase();
    if (!query) return [];
    const names = [...this.commands.keys(), ...this.aliases.keys()];
    return names
      .map((name) => ({ name, score: distance(query, name) }))
      .filter((entry) => entry.score <= Math.max(2, Math.floor(query.length / 3)))
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map((entry) => this.get(entry.name)?.name)
      .filter((name, index, array) => name && array.indexOf(name) === index);
  }
}

/** Small Levenshtein implementation for typo suggestions. */
function distance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

module.exports = { Registry, distance };
