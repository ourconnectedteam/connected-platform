// Environment-based logging utility
const isDev = import.meta.env.DEV;

export const logger = {
    log: isDev ? console.log.bind(console) : () => {},
    error: console.error.bind(console), // Always log errors
    warn: console.warn.bind(console), // Always log warnings
    debug: isDev ? console.log.bind(console) : () => {},
};
