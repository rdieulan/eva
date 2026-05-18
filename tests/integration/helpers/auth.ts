// Integration tests - Authentication helpers

import request from 'supertest';
import { app } from '../../../server/src/app';
import { prisma } from './db';
import type { User } from '@prisma/client';
import { PASSWORD_MIN_LENGTH, NAME_MIN_LENGTH, TEAM_NAME_MIN_LENGTH } from '@shared/constants/validation.constants';

// Generate valid test data based on validation rules
const DEFAULT_TEST_PASSWORD = 'A' + '1' + 'a'.repeat(PASSWORD_MIN_LENGTH - 2); // Uppercase + digit + filler
const DEFAULT_TEST_NAME = 'x'.repeat(NAME_MIN_LENGTH); // Minimum valid name
const DEFAULT_TEST_TEAM_NAME = 'T'.repeat(TEAM_NAME_MIN_LENGTH); // Minimum valid team name

interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
}

/**
 * Create a test user via API (register endpoint)
 */
export async function createTestUser(options: CreateUserOptions = {}): Promise<User> {
  const {
    email = `test-${Date.now()}@example.com`,
    password = DEFAULT_TEST_PASSWORD,
    name = DEFAULT_TEST_NAME,
  } = options;

  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, name });

  if (res.status !== 201) {
    throw new Error(`Failed to register user: ${JSON.stringify(res.body)}`);
  }

  // Fetch the created user from DB to return full User object
  const user = await prisma.user.findUnique({ where: { id: res.body.userId } });
  if (!user) {
    throw new Error('User not found after registration');
  }

  return user;
}

/**
 * Check if a string is a valid JWT format (3 base64 parts separated by dots)
 */
export function isValidJwtFormat(token: string): boolean {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  // Check each part is valid base64url
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => part.length > 0 && base64UrlRegex.test(part));
}

/**
 * Create a test user and login to get a valid token
 */
export async function createAuthenticatedUser(options: CreateUserOptions = {}): Promise<{
  user: User;
  token: string;
}> {
  const password = options.password || DEFAULT_TEST_PASSWORD;
  const email = options.email || `test-${Date.now()}@example.com`;

  // Register user via API
  const user = await createTestUser({ ...options, email, password });

  // Login to get token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Failed to login: ${JSON.stringify(loginRes.body)}`);
  }

  return { user, token: loginRes.body.token };
}

/**
 * Create a test team via API (triggers full flow including default game plans)
 */
export async function createTestTeam(token: string, name?: string): Promise<{ id: string; name: string }> {
  const teamName = name || `${DEFAULT_TEST_TEAM_NAME}${Date.now()}`;

  const res = await request(app)
    .post('/api/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: teamName });

  if (res.status !== 201) {
    throw new Error(`Failed to create team: ${JSON.stringify(res.body)}`);
  }

  return { id: res.body.id, name: res.body.name };
}

/**
 * Create a user with a team (common setup)
 */
export async function createUserWithTeam(options: CreateUserOptions = {}): Promise<{
  user: User;
  token: string;
  team: { id: string; name: string };
}> {
  const { user, token } = await createAuthenticatedUser(options);
  const team = await createTestTeam(token);

  // Refresh user to get updated teamId
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

  return {
    user: updatedUser!,
    token,
    team,
  };
}

/**
 * Create an admin account and return a valid token (login via API).
 */
export async function createAuthenticatedAdmin(options: CreateUserOptions & {
  permissions?: Record<string, Record<string, boolean>>;
} = {}): Promise<{ user: User; token: string; adminId: string }> {
  const bcrypt = await import('bcryptjs');
  const email = options.email || `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = options.password || DEFAULT_TEST_PASSWORD;
  const name = options.name || DEFAULT_TEST_NAME;
  const permissions = options.permissions ?? {
    system: {
      canManageVenues: true,
      canManageManagers: true,
      canManageAdmins: true,
      canViewAllData: true,
    },
  };

  const hashedPassword = await bcrypt.default.hash(password, 10);
  const admin = await prisma.admin.create({ data: { permissions } });
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, adminId: admin.id },
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Failed to login admin: ${JSON.stringify(loginRes.body)}`);
  }

  return { user, token: loginRes.body.token, adminId: admin.id };
}
