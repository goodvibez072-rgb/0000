/**
 * Centralized Logging Utility
 * Console logs are disabled in production for performance and security
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Development-only logger with namespaces
 * In production, these calls are no-ops for performance
 */
export const logger = {
  /**
   * Log informational message (dev only)
   */
  log: (namespace: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[${namespace}]`, ...args);
    }
  },

  /**
   * Log warning message (dev only)
   */
  warn: (namespace: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(`[${namespace}]`, ...args);
    }
  },

  /**
   * Log error message (always logged, even in production)
   */
  error: (namespace: string, ...args: unknown[]) => {
    console.error(`[${namespace}]`, ...args);
  },

  /**
   * Log debug message (dev only, verbose)
   */
  debug: (namespace: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(`[${namespace}]`, ...args);
    }
  },

  /**
   * Log success message with checkmark (dev only)
   */
  success: (namespace: string, message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[${namespace}] ✅ ${message}`, ...args);
    }
  },

  /**
   * Log info message with icon (dev only)
   */
  info: (namespace: string, message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[${namespace}] ℹ️  ${message}`, ...args);
    }
  }
};

/**
 * Performance logger for tracking timing
 */
export const perfLogger = {
  /**
   * Start a performance timer
   */
  start: (label: string): (() => void) => {
    if (!isDevelopment) return () => {};
    
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    };
  },

  /**
   * Mark a performance milestone
   */
  mark: (label: string) => {
    if (isDevelopment) {
      performance.mark(label);
    }
  },

  /**
   * Measure between two marks
   */
  measure: (name: string, startMark: string, endMark: string) => {
    if (isDevelopment) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name)[0];
        console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
      } catch (e) {
        // Marks don't exist, ignore
      }
    }
  }
};
