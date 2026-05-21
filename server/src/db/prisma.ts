// Prisma client singleton with robust connection handling

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { dbLogger } from '@utils/logger';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  dbLogger.error('FATAL: DATABASE_URL environment variable is not set!');
  process.exit(1);
}

// Log database connection info (without password)
const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':***@');
dbLogger.info('Initializing database connection...');
dbLogger.info('Connection target:', sanitizedUrl);

// Create pool with robust settings for Railway
const pool = new pg.Pool({
  connectionString,
  max: 10, // Maximum connections in pool
  min: 2, // Minimum connections to keep alive
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout for new connections: 10s
  // Bound any single query so a hung query can't tie up a connection forever
  // and starve the rest of the pool.
  query_timeout: 30000,
  // Same idea at the postgres protocol level.
  statement_timeout: 30000,
  keepAlive: true, // Keep connections alive
  keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
});

// Pool event listeners
pool.on('connect', () => {
  dbLogger.debug('New client connected to pool');
});

pool.on('acquire', () => {
  dbLogger.debug('Client acquired from pool');
});

pool.on('remove', () => {
  dbLogger.debug('Client removed from pool');
});

// Errors emitted on idle clients in the pool. pg.Pool already discards the
// broken client; we just want a clear log so we can correlate with Railway
// healthcheck failures.
pool.on('error', (err) => {
  dbLogger.error('Pool error (idle client):', err.message);
});

// Test connection on startup
async function testConnection(retries = 5, delay = 3000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      dbLogger.info(`Connection attempt ${attempt}/${retries}...`);
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as now');
      client.release();
      dbLogger.info(`Connection successful! Server time: ${result.rows[0].now}`);
      return true;
    } catch (error) {
      const err = error as Error;
      dbLogger.error(`Connection attempt ${attempt} failed:`, err.message);

      if (attempt < retries) {
        dbLogger.info(`Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * 1.5, 30000);
      }
    }
  }
  dbLogger.error('All connection attempts failed!');
  return false;
}

// Initialize connection test
testConnection().then((success) => {
  if (!success) {
    dbLogger.error('WARNING: Database connection could not be established on startup');
    dbLogger.error('The application will continue but database operations may fail');
  }
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
  ],
});

// Prisma event listeners
prisma.$on('error' as never, (e: unknown) => {
  dbLogger.error('Prisma error event:', e);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  dbLogger.info(`Received ${signal}, closing connections...`);
  try {
    await prisma.$disconnect();
    await pool.end();
    dbLogger.info('All connections closed gracefully');
  } catch (error) {
    dbLogger.error('Error during shutdown:', error);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection: log, do not crash. Bad route handlers shouldn't kill
// the whole process — the Railway healthcheck on /api/health is the safety
// net for "the app is alive but the DB pool is broken" scenarios.
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason);
  dbLogger.error('Unhandled Rejection:', message);
});

// Uncaught exception: log, then exit so the platform restarts us with a
// clean process. Recovering from an uncaught exception in-process is unsafe
// (state can be arbitrarily corrupted).
process.on('uncaughtException', (err) => {
  dbLogger.error('Uncaught Exception:', err.message, err.stack);
  // Give the logger a tick to flush before exiting.
  setTimeout(() => process.exit(1), 100);
});

// Export pool for direct access if needed
export { pool };
