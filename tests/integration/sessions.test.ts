// Integration tests - Sessions: a cookie the page cannot read, checked by the
// server on every request, ended for good on logout or with its account; and
// changes accepted from the app's own pages only

import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'crypto';
import request from 'supertest';
import { app } from '../../server/src/app';
import { prisma } from './helpers/db';
import { authHeader, createAuthenticatedAdmin, createAuthenticatedUser, sessionCookieOf } from './helpers/auth';
import { ERROR } from '@shared/constants/error.constants';
import { openSession, SESSION_MAX_LIFETIME_MS, SESSION_TTL_MS } from '../../server/src/services/session.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

function me(token?: string) {
  const call = request(app).get('/api/auth/me');
  return token ? call.set(authHeader(token)) : call;
}

// The date a cookie is set to expire at, null when it carries none
function cookieExpiry(cookie: string | null): number | null {
  const match = cookie?.match(/Expires=([^;]+)/i);
  return match ? Date.parse(match[1]!) : null;
}

describe('Sessions', () => {
  it('lets the requests of an open session through, and logout ends it for good', async () => {
    const { user, token } = await createAuthenticatedUser();

    expect((await me(token)).body.account.id).toBe(user.id);

    const logout = await request(app).post('/api/auth/logout').set(authHeader(token));
    expect(logout.status).toBe(200);
    // The browser drops its cookie...
    expect(cookieExpiry(sessionCookieOf(logout))).toBe(0);
    // ...and a copy of it opens nothing any more
    const after = await me(token);
    expect(after.status).toBe(401);
    expect(after.body.errors).toContain(ERROR.sessionExpired);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('refuses a request without a session, and a token it does not know, dropping that cookie', async () => {
    const without = await me();
    expect(without.status).toBe(401);
    expect(without.body.errors).toContain(ERROR.unauthorized);

    const forged = await me('not-a-session');
    expect(forged.status).toBe(401);
    expect(forged.body.errors).toContain(ERROR.sessionExpired);
    expect(cookieExpiry(sessionCookieOf(forged))).toBe(0);
  });

  it('refuses a session that ran out, and clears it', async () => {
    const { token } = await createAuthenticatedUser();
    await prisma.session.update({ where: { tokenHash: hashOf(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await me(token);

    expect(res.status).toBe(401);
    expect(await prisma.session.count({ where: { tokenHash: hashOf(token) } })).toBe(0);
  });

  it('pushes a session in use back to its full length, at most once a day', async () => {
    const { token } = await createAuthenticatedUser();
    const twoDaysUsed = new Date(Date.now() + SESSION_TTL_MS - 2 * DAY_MS);
    await prisma.session.update({ where: { tokenHash: hashOf(token) }, data: { expiresAt: twoDaysUsed } });

    const used = await me(token);

    expect(used.status).toBe(200);
    const stored = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashOf(token) } });
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 60_000);
    // The cookie follows, to the second (a cookie's date has no milliseconds)
    expect(Math.abs(cookieExpiry(sessionCookieOf(used))! - stored.expiresAt.getTime())).toBeLessThan(1000);

    // Used again the same day: nothing to write, no cookie to send
    const again = await me(token);
    expect(again.status).toBe(200);
    expect(sessionCookieOf(again)).toBeNull();
  });

  it('never pushes a session past its maximum length after it opened', async () => {
    const { token } = await createAuthenticatedUser();
    // Opened 61.5 days ago, last pushed back three days ago: one more push would go past 90 days
    const openedAt = new Date(Date.now() - 61.5 * DAY_MS);
    await prisma.session.update({
      where: { tokenHash: hashOf(token) },
      data: { createdAt: openedAt, expiresAt: new Date(Date.now() + 27 * DAY_MS) },
    });

    const used = await me(token);

    expect(used.status).toBe(200);
    const stored = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashOf(token) } });
    expect(stored.expiresAt.getTime()).toBe(openedAt.getTime() + SESSION_MAX_LIFETIME_MS);
    expect(Math.abs(cookieExpiry(sessionCookieOf(used))! - stored.expiresAt.getTime())).toBeLessThan(1000);
  });

  it('ends the sessions of an account deleted by an administrator', async () => {
    const { user, token } = await createAuthenticatedUser();
    const admin = await createAuthenticatedAdmin();

    await request(app).delete(`/api/admin/players/${user.playerId}`).set(authHeader(admin.token)).expect(200);

    expect((await me(token)).status).toBe(401);
  });

  it('clears the sessions that ran out, anyone\'s, when a new one opens', async () => {
    const { user: other } = await createAuthenticatedUser();
    await prisma.session.updateMany({ where: { userId: other.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const { user } = await createAuthenticatedUser();

    await openSession(user.id);

    expect(await prisma.session.count({ where: { userId: other.id } })).toBe(0);
  });
});

describe('Changes sent from another site', () => {
  const APP = 'https://scrim-calendar.test';

  afterEach(() => {
    process.env.APP_URL = '';
  });

  it('refuses a change another site sends, its session untouched', async () => {
    process.env.APP_URL = APP;
    const { token } = await createAuthenticatedUser();

    const res = await request(app).post('/api/auth/logout').set(authHeader(token)).set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body.errors).toContain(ERROR.foreignOrigin);
    expect((await me(token)).status).toBe(200);
  });

  it('takes a change from the app\'s own pages, and from no page at all', async () => {
    process.env.APP_URL = `${APP}/`;
    const first = await createAuthenticatedUser();
    const second = await createAuthenticatedUser();

    await request(app).post('/api/auth/logout').set(authHeader(first.token)).set('Origin', APP).expect(200);
    await request(app).post('/api/auth/logout').set(authHeader(second.token)).expect(200);
  });

  it('lets another site read, as a link to the app would', async () => {
    process.env.APP_URL = APP;
    const { token } = await createAuthenticatedUser();

    expect((await me(token).set('Origin', 'https://evil.example')).status).toBe(200);
  });

  it('refuses every change a page sends when the app\'s address is not set', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app).post('/api/auth/logout').set(authHeader(token)).set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(403);
  });
});
