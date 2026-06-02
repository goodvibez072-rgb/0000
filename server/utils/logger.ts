/**
 * Production-ready logging utility
 * Suppresses logs in production while maintaining development debugging
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    // Always show warnings, even in production
    console.warn(...args);
  },
  
  error: (...args: any[]) => {
    // Always show errors, even in production
    console.error(...args);
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

// For backward compatibility, allow direct import
export default logger;
