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
      JWT_SECRET: 'test-secret-key-for-integration-tests',
      NODE_ENV: 'test',
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
