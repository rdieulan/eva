// Integration tests - Signing in with Discord: off to Discord's page, back with
// a code, the account it opens (made at the first sign-in), the session, and
// the invitations accepted on the way.
//
// Discord is never called: identifying the account behind a code is mocked,
// building the address of Discord's page is real.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { prisma } from './helpers/db';
import { authHeader, createAuthenticatedAdmin, createAuthenticatedUser, newDiscordId, sessionCookieOf, sessionToken } from './helpers/auth';
import { SIGN_IN_COOKIE } from '../../server/src/utils/auth-cookies';
import { DiscordOAuthError, identifyDiscordAccount } from '../../server/src/integrations/discord/discord-oauth';
import type { DiscordIdentity } from '../../server/src/integrations/discord/discord-oauth';

vi.mock('../../server/src/integrations/discord/discord-oauth', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/discord/discord-oauth')>(),
  identifyDiscordAccount: vi.fn(),
}));

const identify = vi.mocked(identifyDiscordAccount);

const APP = 'https://scrim-calendar.test';

function discordAccount(overrides: Partial<DiscordIdentity> = {}): DiscordIdentity {
  return { id: newDiscordId(), username: 'raph_42', globalName: 'Raphaël', ...overrides };
}

function cookieValue(setCookie: string | undefined): string {
  return setCookie!.split(';')[0]!.slice(setCookie!.indexOf('=') + 1);
}

function signInCookieOf(res: request.Response): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find(cookie => cookie.startsWith(`${SIGN_IN_COOKIE}=`));
}

/** Start signing in, as the browser does: the cookie it gets, and the state sent to Discord */
async function startSignIn(query: Record<string, string> = {}) {
  const res = await request(app).get('/api/auth/discord').query(query);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.location as string);
  return { res, location, state: location.searchParams.get('state')!, cookie: cookieValue(signInCookieOf(res)) };
}

/** Come back from Discord with a code, carrying the sign-in cookie (and a session cookie, if any) */
function comeBack(started: { state: string; cookie: string }, query: Record<string, string> = {}, sessionToken?: string) {
  const cookies = [`${SIGN_IN_COOKIE}=${started.cookie}`, ...(sessionToken ? [authHeader(sessionToken).Cookie] : [])];
  return request(app)
    .get('/api/auth/discord/callback')
    .query({ code: 'the-code', state: started.state, ...query })
    .set('Cookie', cookies.join('; '));
}

beforeEach(() => {
  identify.mockReset();
  process.env.APP_URL = APP;
  process.env.DISCORD_CLIENT_ID = 'client-123';
  process.env.DISCORD_CLIENT_SECRET = 'secret-456';
});

afterEach(() => {
  process.env.APP_URL = '';
  process.env.DISCORD_CLIENT_ID = '';
  process.env.DISCORD_CLIENT_SECRET = '';
});

describe('GET /api/auth/discord', () => {
  it('sends the visitor to Discord\'s page, asking only who they are, and remembers where they were going', async () => {
    const { res, location, state } = await startSignIn({ next: '/calendar?mode=matchmaking' });

    expect(`${location.origin}${location.pathname}`).toBe('https://discord.com/oauth2/authorize');
    expect(Object.fromEntries(location.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-123',
      scope: 'identify',
      redirect_uri: `${APP}/api/auth/discord/callback`,
      state,
      prompt: 'none',
    });
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const cookie = signInCookieOf(res)!;
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
    expect(cookie).toMatch(/; Max-Age=600/i);
    expect(JSON.parse(Buffer.from(cookieValue(cookie), 'base64url').toString())).toEqual({
      state, next: '/calendar?mode=matchmaking', invitation: null,
    });
  });

  it('lands nowhere but on a page of the app', async () => {
    for (const next of ['//evil.example', 'https://evil.example/x', '/\\evil.example', '/api/auth/me', 'calendar']) {
      const { cookie } = await startSignIn({ next });
      expect(JSON.parse(Buffer.from(cookie, 'base64url').toString()).next).toBe('/');
    }
  });

  it('sends an invitation token that is not one to the invitation page, without leaving', async () => {
    const res = await request(app).get('/api/auth/discord').query({ invitation: '../../evil' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/activate/..%2F..%2Fevil?error=invitation-invalid');
    expect(signInCookieOf(res)).toBeUndefined();
  });

  it('says so on the login page when no Discord application is set up', async () => {
    process.env.DISCORD_CLIENT_SECRET = '';

    const res = await request(app).get('/api/auth/discord').query({ next: '/team' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?error=unavailable&redirect=%2Fteam');
  });
});

describe('GET /api/auth/discord/callback', () => {
  it('makes the account of a first sign-in, a player named after Discord, and opens a session where they were going', async () => {
    const identity = discordAccount();
    identify.mockResolvedValue(identity);
    const started = await startSignIn({ next: '/team' });

    const res = await comeBack(started);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/team');
    expect(identify).toHaveBeenCalledWith(
      { clientId: 'client-123', clientSecret: 'secret-456', redirectUri: `${APP}/api/auth/discord/callback` },
      'the-code',
      expect.any(Function),
    );
    // The sign-in cookie is spent
    expect(signInCookieOf(res)).toMatch(/Expires=Thu, 01 Jan 1970/);

    const user = await prisma.user.findUniqueOrThrow({ where: { discordId: identity.id }, include: { player: true } });
    expect(user.name).toBe('Raphaël');
    expect(user.player).not.toBeNull();
    const me = await request(app).get('/api/auth/me').set(authHeader(sessionToken(res)));
    expect(me.body.account).toMatchObject({ id: user.id, accountType: 'player', roles: ['player'], name: 'Raphaël' });
  });

  it('opens the same account at the next sign-in, keeping the name changed since', async () => {
    const identity = discordAccount();
    identify.mockResolvedValue(identity);
    const first = await comeBack(await startSignIn());
    await request(app).put('/api/auth/name').set(authHeader(sessionToken(first))).send({ name: 'Sib' }).expect(200);

    const again = await comeBack(await startSignIn());

    expect(await prisma.user.count({ where: { discordId: identity.id } })).toBe(1);
    const me = await request(app).get('/api/auth/me').set(authHeader(sessionToken(again)));
    expect(me.body.account.name).toBe('Sib');
  });

  it('names a first account after its Discord handle when the Discord name breaks the rule, or plainly when both do', async () => {
    const handle = discordAccount({ globalName: 'Line\nbreak', username: 'raph_42' });
    identify.mockResolvedValueOnce(handle);
    await comeBack(await startSignIn());
    expect((await prisma.user.findUniqueOrThrow({ where: { discordId: handle.id } })).name).toBe('raph_42');

    const neither = discordAccount({ id: '123456789012345678', globalName: null, username: 'x' });
    identify.mockResolvedValueOnce(neither);
    await comeBack(await startSignIn());
    expect((await prisma.user.findUniqueOrThrow({ where: { discordId: neither.id } })).name).toBe('Joueur 5678');
  });

  it('ends the session the browser held: a sign-in replaces it', async () => {
    const { token: before } = await createAuthenticatedUser();
    identify.mockResolvedValue(discordAccount());

    const res = await comeBack(await startSignIn(), {}, before);

    expect((await request(app).get('/api/auth/me').set(authHeader(before))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(authHeader(sessionToken(res)))).status).toBe(200);
  });

  it('refuses an answer this browser did not start: no cookie, or another state', async () => {
    const started = await startSignIn({ next: '/team' });

    const forged = await comeBack({ ...started, state: 'not-the-state' });
    const cookieless = await request(app).get('/api/auth/discord/callback').query({ code: 'c', state: started.state });

    expect(forged.headers.location).toBe('/login?error=expired&redirect=%2Fteam');
    expect(cookieless.headers.location).toBe('/login?error=expired');
    for (const res of [forged, cookieless]) expect(sessionCookieOf(res)).toBeNull();
    expect(identify).not.toHaveBeenCalled();
  });

  it('checks again where a sign-in lands, the cookie read as any input', async () => {
    identify.mockResolvedValue(discordAccount());
    const forged = Buffer.from(JSON.stringify({ state: 'the-state', next: 'https://evil.example', invitation: null })).toString('base64url');

    const res = await comeBack({ state: 'the-state', cookie: forged });

    expect(res.headers.location).toBe('/');
    expect(sessionCookieOf(res)).not.toBeNull();
  });

  it('tells a sign-in refused on Discord from Discord failing', async () => {
    const cancelled = await comeBack(await startSignIn(), { error: 'access_denied', code: '' });
    expect(cancelled.headers.location).toBe('/login?error=cancelled');

    identify.mockRejectedValueOnce(new DiscordOAuthError('Token exchange refused: HTTP 400'));
    const failed = await comeBack(await startSignIn());
    expect(failed.headers.location).toBe('/login?error=failed');
    expect(sessionCookieOf(failed)).toBeNull();
  });
});

describe('Accepting an invitation by signing in with Discord', () => {
  async function inviteManager(adminToken: string) {
    const created = await request(app)
      .post('/api/admin/managers')
      .set(authHeader(adminToken))
      .send({ name: 'Jean', venueIds: [] });
    return created.body as { manager: { id: string }; activationToken: string };
  }

  it('gives the role to the account that signs in, made on the way, and the session acts as it', async () => {
    const { token: adminToken } = await createAuthenticatedAdmin();
    const { manager, activationToken } = await inviteManager(adminToken);
    const identity = discordAccount();
    identify.mockResolvedValue(identity);

    const res = await comeBack(await startSignIn({ invitation: activationToken }));

    expect(res.headers.location).toBe('/');
    const user = await prisma.user.findUniqueOrThrow({ where: { discordId: identity.id } });
    expect(user.managerId).toBe(manager.id);
    const me = await request(app).get('/api/auth/me').set(authHeader(sessionToken(res)));
    expect(me.body.account).toMatchObject({ accountType: 'manager', roles: ['player', 'manager'] });

    // The link is spent: nobody else takes the role with it
    const stored = await prisma.manager.findUniqueOrThrow({ where: { id: manager.id } });
    expect(stored).toMatchObject({ activationToken: null, invitedName: null });
    identify.mockResolvedValue(discordAccount());
    const reused = await comeBack(await startSignIn({ invitation: activationToken }));
    expect(reused.headers.location).toBe(`/activate/${activationToken}?error=invitation-invalid`);
    expect(sessionCookieOf(reused)).toBeNull();
  });

  it('adds an admin role to an account that already exists', async () => {
    const { token: adminToken } = await createAuthenticatedAdmin();
    const created = await request(app)
      .post('/api/admin/admins')
      .set(authHeader(adminToken))
      .send({ name: 'Raph', permissions: { system: { canManageVenues: true, canManageManagers: true, canManageAdmins: false, canViewAllData: true } } });
    const identity = discordAccount();
    identify.mockResolvedValue(identity);
    await comeBack(await startSignIn());

    const res = await comeBack(await startSignIn({ invitation: created.body.activationToken }));

    expect(await prisma.user.count({ where: { discordId: identity.id } })).toBe(1);
    expect((await request(app).get('/api/admin/venues').set(authHeader(sessionToken(res)))).status).toBe(200);
  });

  it('refuses an invitation out of date, or to a role the account holds, without signing in', async () => {
    const { token: adminToken } = await createAuthenticatedAdmin();
    const expired = await inviteManager(adminToken);
    await prisma.manager.update({ where: { id: expired.manager.id }, data: { activationTokenExpiresAt: new Date(Date.now() - 1000) } });
    identify.mockResolvedValue(discordAccount());

    const late = await comeBack(await startSignIn({ invitation: expired.activationToken }));
    expect(late.headers.location).toBe(`/activate/${expired.activationToken}?error=invitation-expired`);
    expect(sessionCookieOf(late)).toBeNull();

    const identity = discordAccount();
    identify.mockResolvedValue(identity);
    const first = await inviteManager(adminToken);
    await comeBack(await startSignIn({ invitation: first.activationToken }));
    const second = await inviteManager(adminToken);
    const taken = await comeBack(await startSignIn({ invitation: second.activationToken }));
    expect(taken.headers.location).toBe(`/activate/${second.activationToken}?error=role-taken`);
  });
});
