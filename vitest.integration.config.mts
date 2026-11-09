import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Run integration tests sequentially to avoid DB conflicts
    fileParallelism: false,
    // Load test environment variables
    env: {
      DATABASE_URL: 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db_test',
      NODE_ENV: 'test',
      // No public address unless a test sets one: set here, the dev one in .env stays out
      APP_URL: '',
      // No Discord application unless a test sets one: a local .env.local stays out
      DISCORD_CLIENT_ID: '',
      DISCORD_CLIENT_SECRET: '',
      // The development login, to test it: never mounted in production whatever is set
      DEV_LOGIN: 'true',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'server/src'),
      '@db': path.resolve(__dirname, 'server/src/db'),
      '@routes': path.resolve(__dirname, 'server/src/routes'),
      '@middleware': path.resolve(__dirname, 'server/src/middleware'),
      '@services': path.resolve(__dirname, 'server/src/services'),
      '@utils': path.resolve(__dirname, 'server/src/utils'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
