// Centralized logger for the application
// Supports different log levels based on environment

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// Determine log level based on environment
function getDefaultLogLevel(): LogLevel {
  const env = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL as LogLevel | undefined;

  // Allow explicit override via LOG_LEVEL env var
  if (logLevel && LOG_LEVELS[logLevel] !== undefined) {
    return logLevel;
  }

  // Default levels per environment
  switch (env) {
    case 'test':
      return 'silent'; // Silent by default in tests
    case 'production':
      return 'info'; // Info and above in production
    default:
      return 'debug'; // Everything in development
  }
}

class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.level = config.level || getDefaultLogLevel();
    this.prefix = config.prefix || '';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(message: string): string {
    return this.prefix ? `[${this.prefix}] ${message}` : message;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  // Create a child logger with a specific prefix
  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({ level: this.level, prefix: childPrefix });
  }

  // Temporarily change log level (useful for tests)
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  // Get current log level
  getLevel(): LogLevel {
    return this.level;
  }
}

// Default application logger
export const logger = new Logger();

// Pre-configured loggers for different modules
export const dbLogger = new Logger({ prefix: 'DB' });
export const authLogger = new Logger({ prefix: 'AUTH' });
export const apiLogger = new Logger({ prefix: 'API' });

// Export for custom loggers
export { Logger, LogLevel };
