// Sessions: who a request acts for, and as which role of their account. The
// browser keeps a random token in a cookie its scripts cannot read (see
// utils/auth-cookies); the database keeps only its hash, so a copy of the
// database opens no session. The server checks the session on every request:
// it ends for good on logout, or with its account.

import { createHash, randomBytes } from 'crypto';
import type { AccountRole } from '@prisma/client';
import { prisma } from '@db/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

// A session lasts this long after it was last pushed back...
export const SESSION_TTL_MS = 30 * DAY_MS;
// ...which happens at most once a day while it is used, not on every request...
const SESSION_RENEWAL_STEP_MS = DAY_MS;
// ...and never past this long after it opened: a copied cookie does not live forever
export const SESSION_MAX_LIFETIME_MS = 90 * DAY_MS;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface OpenedSession {
  token: string;
  expiresAt: Date;
}

/**
 * Open a session for an account, acting as one of its roles (as a player
 * unless told otherwise). The sessions that ran out, anyone's, are cleared on the way.
 */
export async function openSession(userId: string, role: AccountRole = 'PLAYER'): Promise<OpenedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.session.create({ data: { userId, tokenHash: hashToken(token), role, expiresAt } }),
  ]);

  return { token, expiresAt };
}

/** End the session of a token, if it is still open */
export async function closeSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Make the session of a token act as another role of its account; false when it is no longer open */
export async function setSessionRole(token: string, role: AccountRole): Promise<boolean> {
  const { count } = await prisma.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { role } });
  return count > 0;
}

// What a request needs to know of the account behind its session
const SESSION_ACCOUNT_SELECT = {
  id: true,
  playerId: true,
  managerId: true,
  adminId: true,
  player: { select: { teamId: true } },
} as const;

export interface SessionAccountRecord {
  id: string;
  playerId: string;
  managerId: string | null;
  adminId: string | null;
  player: { teamId: string | null };
}

export interface FoundSession {
  account: SessionAccountRecord;
  role: AccountRole; // The role the session was set to act as: the account may have lost it since
  /** Set when the session was just pushed back: the cookie has to follow */
  renewedUntil: Date | null;
}

/**
 * The open session of a token, pushed back when due, up to its maximum length.
 * Null when the token is unknown or its session ran out; a session that ran
 * out is cleared.
 */
export async function findSession(token: string): Promise<FoundSession | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, role: true, createdAt: true, expiresAt: true, user: { select: SESSION_ACCOUNT_SELECT } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const found = { account: session.user, role: session.role };
  const lastPossible = session.createdAt.getTime() + SESSION_MAX_LIFETIME_MS;
  const renewedUntil = new Date(Math.min(now + SESSION_TTL_MS, lastPossible));
  if (renewedUntil.getTime() - session.expiresAt.getTime() < SESSION_RENEWAL_STEP_MS) {
    return { ...found, renewedUntil: null };
  }

  // Ended in the meantime (a logout in another tab): nothing to push back
  const { count } = await prisma.session.updateMany({ where: { id: session.id }, data: { expiresAt: renewedUntil } });
  return count === 0 ? null : { ...found, renewedUntil };
}
