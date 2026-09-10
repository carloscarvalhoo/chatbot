const isDevelopment = process.env.NODE_ENV !== "production";

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
