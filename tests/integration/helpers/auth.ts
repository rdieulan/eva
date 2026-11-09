// Integration tests - Authentication helpers: people as their first sign-in
// with Discord makes them, straight in the database, and a session opened for them

import request from 'supertest';
import type { Response } from 'supertest';
import type { User } from '@prisma/client';
import { app } from '../../../server/src/app';
import { SESSION_COOKIE } from '../../../server/src/utils/auth-cookies';
import { openSession } from '../../../server/src/services/session.service';
import { prisma } from './db';
import { TEAM_NAME_MIN_LENGTH } from '@shared/constants/validation.constants';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import type { AccountPermissions, MatchmakingPermissions } from '@shared/types';

const DEFAULT_TEST_TEAM_NAME = 'T'.repeat(TEAM_NAME_MIN_LENGTH); // Minimum valid team name

interface CreateUserOptions {
  name?: string;
}

let peopleMade = 0;

/** A Discord account's number no other test person has: digits only, as Discord's */
export function newDiscordId(): string {
  peopleMade += 1;
  return `${Date.now()}${String(peopleMade).padStart(5, '0')}`;
}

/** A person, as their first sign-in with Discord makes them: an account and its player */
export async function createTestUser(options: CreateUserOptions = {}): Promise<User> {
  const discordId = newDiscordId();
  return prisma.user.create({
    data: { discordId, name: options.name ?? `Joueur ${peopleMade}`, player: { create: {} } },
  });
}

/**
 * The session cookie a response sets, as the browser would store it: its value
 * and attributes. Null when the response sets none.
 */
export function sessionCookieOf(res: Response): string | null {
  const header = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find(cookie => cookie.startsWith(`${SESSION_COOKIE}=`)) ?? null;
}

/** The session token a response hands over in its cookie; throws when there is none */
export function sessionToken(res: Response): string {
  const cookie = sessionCookieOf(res);
  const token = cookie?.slice(SESSION_COOKIE.length + 1).split(';')[0];
  if (!token) {
    throw new Error(`No session cookie in the response: ${JSON.stringify(res.headers['set-cookie'])}`);
  }
  return token;
}

/** The header a request carries the session with, as a browser sends its cookie */
export function authHeader(token: string): { Cookie: string } {
  return { Cookie: `${SESSION_COOKIE}=${token}` };
}

/**
 * A person signed in: their account and a session acting as a player
 */
export async function createAuthenticatedUser(options: CreateUserOptions = {}): Promise<{
  user: User;
  token: string;
}> {
  const user = await createTestUser(options);
  const { token } = await openSession(user.id);
  return { user, token };
}

/**
 * Create a test team via API (triggers full flow including default game plans)
 */
export async function createTestTeam(token: string, name?: string): Promise<{ id: string; name: string }> {
  const teamName = name || `${DEFAULT_TEST_TEAM_NAME}${Date.now()}`;

  const res = await request(app)
    .post('/api/teams')
    .set(authHeader(token))
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

  return { user, token, team };
}

/**
 * A member joining the leader's team through an invite, given by the leader
 * these matchmaking permissions and nothing else
 */
export async function createTeamMember(
  leaderToken: string,
  teamId: string,
  matchmaking: Partial<MatchmakingPermissions> = {},
): Promise<{ user: User; token: string; playerId: string }> {
  const invite = await request(app)
    .post(`/api/teams/${teamId}/invites`)
    .set(authHeader(leaderToken))
    .send({ expiresInHours: 24, maxUses: 1 });
  if (invite.status !== 201) {
    throw new Error(`Failed to invite a member: ${JSON.stringify(invite.body)}`);
  }
  const { token, user } = await createAuthenticatedUser();
  const joined = await request(app).post(`/api/invites/${invite.body.code}/join`).set(authHeader(token));
  if (joined.status !== 200) {
    throw new Error(`Failed to join the team: ${JSON.stringify(joined.body)}`);
  }

  const permissions: AccountPermissions = {
    ...DEFAULT_PLAYER_PERMISSIONS,
    matchmaking: { ...DEFAULT_PLAYER_PERMISSIONS.matchmaking, ...matchmaking },
  };
  const granted = await request(app)
    .put(`/api/teams/current/members/${user.id}/permissions`)
    .set(authHeader(leaderToken))
    .send({ permissions });
  if (granted.status !== 200) {
    throw new Error(`Failed to set the member's permissions: ${JSON.stringify(granted.body)}`);
  }

  return { user, token, playerId: user.playerId };
}

/**
 * A person holding the admin role, with a session acting as an admin
 */
export async function createAuthenticatedAdmin(options: CreateUserOptions & {
  permissions?: Record<string, Record<string, boolean>>;
} = {}): Promise<{ user: User; token: string; adminId: string }> {
  const permissions = options.permissions ?? {
    system: {
      canManageVenues: true,
      canManageManagers: true,
      canManageAdmins: true,
      canViewAllData: true,
    },
  };

  const admin = await prisma.admin.create({ data: { permissions } });
  const discordId = newDiscordId();
  const user = await prisma.user.create({
    data: { discordId, name: options.name ?? `Admin ${peopleMade}`, player: { create: {} }, admin: { connect: { id: admin.id } } },
  });
  const { token } = await openSession(user.id, 'ADMIN');

  return { user, token, adminId: admin.id };
}
