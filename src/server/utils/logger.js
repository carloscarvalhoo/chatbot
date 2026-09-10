/**
 * @file Logger simples. `debug`/`info` só aparecem fora de produção;
 * `warn`/`error` sempre.
 * @module server/utils/logger
 */

const isDevelopment = process.env.NODE_ENV !== "production";

/** @namespace logger */
export const logger = {
  debug(...args) {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info(...args) {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn(...args) {
    console.warn(...args);
  },

  error(...args) {
    console.error(...args);
  },
};
