// Prisma client singleton with robust connection handling

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;

// Log database connection info (without password)
const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':***@');
console.log('[DB] Initializing database connection...');
console.log('[DB] Connection target:', sanitizedUrl);

// Create pool with robust settings for Railway
const pool = new pg.Pool({
  connectionString,
  max: 10, // Maximum connections in pool
  min: 2, // Minimum connections to keep alive
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout for new connections: 10s
  keepAlive: true, // Keep connections alive
  keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
});

// Pool event listeners for debugging
pool.on('connect', (client) => {
  console.log('[DB] New client connected to pool');
});

pool.on('acquire', () => {
  console.log('[DB] Client acquired from pool');
});

pool.on('remove', () => {
  console.log('[DB] Client removed from pool');
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
  console.error('[DB] Pool error stack:', err.stack);
});

// Test connection on startup
async function testConnection(retries = 5, delay = 3000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[DB] Connection attempt ${attempt}/${retries}...`);
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as now');
      client.release();
      console.log(`[DB] Connection successful! Server time: ${result.rows[0].now}`);
      return true;
    } catch (error) {
      const err = error as Error;
      console.error(`[DB] Connection attempt ${attempt} failed:`, err.message);

      if (attempt < retries) {
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * 1.5, 30000);
      }
    }
  }
  console.error('[DB] All connection attempts failed!');
  return false;
}

// Initialize connection test
testConnection().then((success) => {
  if (!success) {
    console.error('[DB] WARNING: Database connection could not be established on startup');
    console.error('[DB] The application will continue but database operations may fail');
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
  console.error('[PRISMA] Error event:', e);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[DB] Received ${signal}, closing connections...`);
  try {
    await prisma.$disconnect();
    await pool.end();
    console.log('[DB] All connections closed gracefully');
  } catch (error) {
    console.error('[DB] Error during shutdown:', error);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors related to database
process.on('unhandledRejection', (reason, promise) => {
  console.error('[DB] Unhandled Rejection:', reason);
});

// Export pool for direct access if needed
export { pool };

