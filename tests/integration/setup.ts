// Integration tests - Global setup

import 'dotenv/config';
import { afterAll, beforeEach } from 'vitest';
import { cleanDatabase, disconnectDatabase } from './helpers/db';

// Clean database before each test
beforeEach(async () => {
  await cleanDatabase();
});

// Disconnect database after all tests
afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});
