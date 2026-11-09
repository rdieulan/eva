// Sessions: who a request acts for. The browser keeps a random token in a
// cookie its scripts cannot read (see utils/session-cookie); the database keeps
// only its hash, so a copy of the database opens no session. The server checks
// the session on every request: it ends for good on logout, or with its account.

import { createHash, randomBytes } from 'crypto';
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

/** Open a session for an account. The sessions that ran out, anyone's, are cleared on the way. */
export async function openSession(userId: string): Promise<OpenedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } }),
  ]);

  return { token, expiresAt };
}

/** End the session of a token, if it is still open */
export async function closeSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** End every session of an account but the one of this token */
export async function closeOtherSessions(userId: string, keptToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId, NOT: { tokenHash: hashToken(keptToken) } } });
}

// What a request needs to know of the account behind its session
const SESSION_ACCOUNT_SELECT = {
  id: true,
  email: true,
  playerId: true,
  managerId: true,
  adminId: true,
  player: { select: { teamId: true } },
} as const;

export interface SessionAccountRecord {
  id: string;
  email: string;
  playerId: string | null;
  managerId: string | null;
  adminId: string | null;
  player: { teamId: string | null } | null;
}

export interface FoundSession {
  account: SessionAccountRecord;
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
    select: { id: true, createdAt: true, expiresAt: true, user: { select: SESSION_ACCOUNT_SELECT } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const lastPossible = session.createdAt.getTime() + SESSION_MAX_LIFETIME_MS;
  const renewedUntil = new Date(Math.min(now + SESSION_TTL_MS, lastPossible));
  if (renewedUntil.getTime() - session.expiresAt.getTime() < SESSION_RENEWAL_STEP_MS) {
    return { account: session.user, renewedUntil: null };
  }

  // Ended in the meantime (a logout in another tab): nothing to push back
  const { count } = await prisma.session.updateMany({ where: { id: session.id }, data: { expiresAt: renewedUntil } });
  return count === 0 ? null : { account: session.user, renewedUntil };
}
