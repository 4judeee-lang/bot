'use strict';

/**
 * A small `better-sqlite3`-shaped wrapper around Node's built-in SQLite.
 *
 * The bot used to depend on `better-sqlite3`, which is a native module: every
 * `npm install` had to compile C++ against whatever V8 the local Node ships,
 * and a Node release newer than the package would break the install outright.
 * `node:sqlite` is the same SQLite engine built into Node itself, so there is
 * nothing to compile — no Xcode, no node-gyp, and nothing to break when Node
 * ships a new major version.
 *
 * Only the handful of methods the bot actually uses are wrapped, with two
 * deliberate smoothing-overs of the differences between the two drivers:
 *
 *   - `node:sqlite` refuses to bind `undefined` and booleans; we map them to
 *     NULL and 0/1 the way most SQLite bindings do.
 *   - `node:sqlite` returns rows with a null prototype; we hand back ordinary
 *     objects so rows behave like they did before.
 */

const MINIMUM_NODE = '22.5.0';

/**
 * Node 22 and 23 print an "SQLite is an experimental feature" warning the
 * moment the module is required (it is stable from Node 24 on). Swallow that
 * one warning so a first run does not look like something went wrong, and pass
 * every other warning straight through.
 */
function requireSqlite() {
  const emitWarning = process.emitWarning;
  process.emitWarning = function filtered(warning, ...rest) {
    const text = typeof warning === 'string' ? warning : String(warning?.message ?? '');
    if (text.includes('SQLite is an experimental feature')) return undefined;
    return emitWarning.call(this, warning, ...rest);
  };

  try {
    return require('node:sqlite');
  } catch (error) {
    throw new Error(
      `Vex needs Node.js ${MINIMUM_NODE} or newer — this is ${process.version}, which has no built-in `
        + 'SQLite. Install the current LTS from https://nodejs.org, quit and reopen your terminal, '
        + 'then run the command again.',
      { cause: error },
    );
  } finally {
    process.emitWarning = emitWarning;
  }
}

const { DatabaseSync } = requireSqlite();

/** Map the values `node:sqlite` will not bind onto ones it will. */
function bindable(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function isNamedParameters(value) {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && !ArrayBuffer.isView(value)
  );
}

function bindArguments(parameters) {
  if (parameters.length === 1 && isNamedParameters(parameters[0])) {
    return [Object.fromEntries(Object.entries(parameters[0]).map(([key, value]) => [key, bindable(value)]))];
  }
  return parameters.map(bindable);
}

/** Rows come back with a null prototype; give them an ordinary one. */
function plain(row) {
  return row === undefined || row === null ? row : { ...row };
}

class Statement {
  #statement;

  constructor(statement) {
    this.#statement = statement;
  }

  /** `{ changes, lastInsertRowid }`, same as before. */
  run(...parameters) {
    return this.#statement.run(...bindArguments(parameters));
  }

  /** The first row, or `undefined`. */
  get(...parameters) {
    return plain(this.#statement.get(...bindArguments(parameters)));
  }

  /** Every row, as an array. */
  all(...parameters) {
    return this.#statement.all(...bindArguments(parameters)).map(plain);
  }

  iterate(...parameters) {
    return this.all(...parameters)[Symbol.iterator]();
  }
}

class Database {
  #database;
  #depth = 0;

  constructor(filename, options = {}) {
    this.#database = new DatabaseSync(filename, options);
  }

  /** The underlying `node:sqlite` handle, for anything this wrapper omits. */
  get handle() {
    return this.#database;
  }

  prepare(sql) {
    return new Statement(this.#database.prepare(sql));
  }

  exec(sql) {
    this.#database.exec(sql);
    return this;
  }

  /** `db.pragma('journal_mode = WAL')` — returns the rows the pragma produced. */
  pragma(source) {
    return this.#database.prepare(`PRAGMA ${source}`).all().map(plain);
  }

  /**
   * Wrap a function so everything it writes commits or rolls back together.
   * Nested calls use savepoints, so an inner transaction cannot commit work
   * that an outer one later abandons.
   */
  transaction(fn) {
    return (...args) => {
      const savepoint = `vex_sp_${this.#depth}`;
      this.#database.exec(this.#depth === 0 ? 'BEGIN' : `SAVEPOINT ${savepoint}`);
      this.#depth += 1;

      let result;
      try {
        result = fn(...args);
      } catch (error) {
        this.#depth -= 1;
        if (this.#depth === 0) this.#database.exec('ROLLBACK');
        else this.#database.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint};`);
        throw error;
      }

      this.#depth -= 1;
      this.#database.exec(this.#depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    };
  }

  close() {
    this.#database.close();
  }
}

module.exports = Database;
module.exports.MINIMUM_NODE = MINIMUM_NODE;
