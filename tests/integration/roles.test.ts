// Integration tests - One person, one account, with roles: the session acts as
// one of them and switches to another the account holds; the name the person
// shows; who is signed in, as the app asks at every load; and the development login

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { prisma } from './helpers/db';
import { authHeader, createAuthenticatedAdmin, createAuthenticatedUser, sessionToken } from './helpers/auth';
import { ERROR } from '@shared/constants/error.constants';
import { isDevLoginEnabled, isLocalRequest } from '../../server/src/services/dev-login.service';

describe('PUT /api/auth/role', () => {
  it('acts as another role the account holds, in this session: the routes follow', async () => {
    const { user, token } = await createAuthenticatedAdmin();

    const asPlayer = await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'player' });

    expect(asPlayer.status).toBe(200);
    expect(asPlayer.body.account).toMatchObject({
      id: user.id, accountType: 'player', roles: ['player', 'admin'], playerId: user.playerId, adminId: null,
    });
    expect((await request(app).get('/api/admin/venues').set(authHeader(token))).status).toBe(403);
    expect((await request(app).get('/api/players/me/subscription').set(authHeader(token))).status).toBe(200);

    await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'admin' }).expect(200);
    expect((await request(app).get('/api/admin/venues').set(authHeader(token))).status).toBe(200);
  });

  it('refuses a role the account does not hold', async () => {
    const { token } = await createAuthenticatedUser();

    for (const role of ['admin', 'manager', 'owner', undefined]) {
      const res = await request(app).put('/api/auth/role').set(authHeader(token)).send({ role });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.roleNotHeld);
    }
    expect((await request(app).get('/api/admin/venues').set(authHeader(token))).status).toBe(403);
  });

  it('acts as a player once the role it acted as is taken away', async () => {
    const { token, adminId } = await createAuthenticatedAdmin();
    await prisma.admin.delete({ where: { id: adminId } });

    const me = await request(app).get('/api/auth/me').set(authHeader(token));

    expect(me.body.account).toMatchObject({ accountType: 'player', roles: ['player'], adminId: null });
  });
});

describe('PUT /api/auth/name', () => {
  it('changes the name the person shows, as it is kept', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app).put('/api/auth/name').set(authHeader(token)).send({ name: '  Raphaël   le  Grand ' });

    expect(res.status).toBe(200);
    expect(res.body.account.name).toBe('Raphaël le Grand');
  });

  it('refuses a name that breaks the rule', async () => {
    const { user, token } = await createAuthenticatedUser();

    const cases: [unknown, string][] = [
      ['a', ERROR.nameTooShort],
      ['x'.repeat(33), ERROR.nameTooLong],
      ['two\nlines', ERROR.nameInvalidChars],
      [42, ERROR.nameTooShort],
    ];
    for (const [name, error] of cases) {
      const res = await request(app).put('/api/auth/name').set(authHeader(token)).send({ name });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(error);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe(user.name);
  });
});

describe('GET /api/auth/session', () => {
  it('answers who is signed in, and nobody without a refusal', async () => {
    const { user, token } = await createAuthenticatedUser();

    const signedIn = await request(app).get('/api/auth/session').set(authHeader(token));
    const visitor = await request(app).get('/api/auth/session');
    const ended = await request(app).get('/api/auth/session').set(authHeader('ended'));

    expect(signedIn.body.account).toMatchObject({ id: user.id, accountType: 'player' });
    for (const res of [visitor, ended]) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ account: null });
    }
  });
});

describe('The development login', () => {
  it('lists the accounts, team by team, with their roles', async () => {
    const { user: admin } = await createAuthenticatedAdmin();
    const { user: player } = await createAuthenticatedUser();

    const res = await request(app).get('/api/auth/dev/accounts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      { id: admin.id, name: admin.name, teamName: null, roles: ['player', 'admin'] },
      { id: player.id, name: player.name, teamName: null, roles: ['player'] },
    ]));
  });

  it('opens a session for an account, as a player', async () => {
    const { user } = await createAuthenticatedAdmin();

    const res = await request(app).post('/api/auth/dev/login').send({ userId: user.id });

    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ id: user.id, accountType: 'player' });
    expect((await request(app).get('/api/auth/me').set(authHeader(sessionToken(res)))).status).toBe(200);
    expect((await request(app).post('/api/auth/dev/login').send({ userId: 'nobody' })).status).toBe(404);
  });

  it('answers the local machine only', () => {
    for (const local of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(isLocalRequest(local)).toBe(true);
    for (const remote of ['192.168.1.20', '::ffff:192.168.1.20', '10.0.0.5', undefined]) expect(isLocalRequest(remote)).toBe(false);
  });

  it('never exists in production, whatever is set', () => {
    const before = { nodeEnv: process.env.NODE_ENV, devLogin: process.env.DEV_LOGIN };
    try {
      process.env.DEV_LOGIN = 'true';
      process.env.NODE_ENV = 'production';
      expect(isDevLoginEnabled()).toBe(false);
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN = '';
      expect(isDevLoginEnabled()).toBe(false);
      process.env.DEV_LOGIN = 'true';
      expect(isDevLoginEnabled()).toBe(true);
    } finally {
      process.env.NODE_ENV = before.nodeEnv;
      process.env.DEV_LOGIN = before.devLogin;
    }
  });
});
