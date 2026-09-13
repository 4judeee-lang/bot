'use strict';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const LEVELS = {
  debug: { color: COLORS.dim, label: 'debug' },
  info: { color: COLORS.cyan, label: 'info ' },
  warn: { color: COLORS.yellow, label: 'warn ' },
  error: { color: COLORS.red, label: 'error' },
  ready: { color: COLORS.green, label: 'ready' },
  web: { color: COLORS.magenta, label: ' web ' },
};

const DEBUG = process.env.LOG_LEVEL === 'debug';

function stamp() {
  return new Date().toISOString().slice(11, 19);
}

function write(level, scope, message, extra) {
  if (level === 'debug' && !DEBUG) return;
  const meta = LEVELS[level] ?? LEVELS.info;
  const prefix = `${COLORS.dim}${stamp()}${COLORS.reset} ${meta.color}${meta.label}${COLORS.reset}`;
  const tag = scope ? `${COLORS.dim}[${scope}]${COLORS.reset} ` : '';
  console.log(`${prefix} ${tag}${message}`);
  if (extra !== undefined) {
    if (extra instanceof Error) console.log(extra.stack ?? extra.message);
    else console.dir(extra, { depth: 3 });
  }
}

const logger = {
  debug: (message, extra) => write('debug', null, message, extra),
  info: (message, extra) => write('info', null, message, extra),
  warn: (message, extra) => write('warn', null, message, extra),
  error: (message, extra) => write('error', null, message, extra),
  ready: (message, extra) => write('ready', null, message, extra),
  web: (message, extra) => write('web', null, message, extra),
  scoped: (scope) => ({
    debug: (message, extra) => write('debug', scope, message, extra),
    info: (message, extra) => write('info', scope, message, extra),
    warn: (message, extra) => write('warn', scope, message, extra),
    error: (message, extra) => write('error', scope, message, extra),
  }),
};

module.exports = logger;
