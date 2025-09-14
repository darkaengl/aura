// shared/logger.js
// Simple leveled logger. Usage: import { logger } from '../shared/logger.js'; logger.debug('msg');

const LEVELS = ['error','warn','info','debug'];
let resolvedLevel = 'info';
try {
  if (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL) {
    resolvedLevel = String(process.env.LOG_LEVEL).toLowerCase();
  }
} catch (_) { /* ignore sandbox access error */ }
const activeIndex = LEVELS.includes(resolvedLevel) ? LEVELS.indexOf(resolvedLevel) : 2;

function log(level, args){
  const idx = LEVELS.indexOf(level);
  if (idx <= activeIndex) {
    const prefix = `[${level.toUpperCase()}]`;
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](prefix, ...args);
  }
}

export const logger = {
  error: (...a)=>log('error', a),
  warn: (...a)=>log('warn', a),
  info: (...a)=>log('info', a),
  debug: (...a)=>log('debug', a),
  isDebug: () => activeIndex >= 3
};

export default logger;