// Integration tests - Global setup

import 'dotenv/config';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { cleanDatabase, disconnectDatabase, seedTestMaps } from './helpers/db';

// Seed reference data before all tests
beforeAll(async () => {
  await seedTestMaps();
});

// Clean database before each test
beforeEach(async () => {
  await cleanDatabase();
});

// Disconnect database after all tests
afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});
