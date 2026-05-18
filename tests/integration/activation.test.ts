// Integration tests - Account activation routes

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { PASSWORD_MIN_LENGTH } from '@shared/constants/validation.constants';

const VALID_PASSWORD = 'A' + '1' + 'a'.repeat(PASSWORD_MIN_LENGTH - 2);
const TEST_VENUE_ID = 'test-venue-activation';

describe('Account Activation API', () => {
  beforeEach(async () => {
    await prisma.venue.create({
      data: {
        id: TEST_VENUE_ID,
        name: 'Test Venue Activation',
        city: 'Test City',
        address: '123 Test Street',
        phone: '+33 1 00 00 00 00',
      },
    });
  });

  describe('POST /api/auth/activate', () => {
    it('should activate account with valid token and password', async () => {
      const token = `activation-${Date.now()}`;
      const email = `activate-${Date.now()}@example.com`;
      const manager = await prisma.manager.create({
        data: {
          permissions: {},
          activationToken: token,
          activationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      await prisma.user.create({
        data: {
          email,
          password: '',
          name: 'Activation Test',
          managerId: manager.id,
        },
      });

      const res = await request(app)
        .post('/api/auth/activate')
        .send({ token, password: VALID_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Compte activé avec succès');

      // Verify DB state: token should be cleared
      const updatedManager = await prisma.manager.findUnique({ where: { id: manager.id } });
      expect(updatedManager!.activationToken).toBeNull();
      expect(updatedManager!.activationTokenExpiresAt).toBeNull();

      // Verify password was set (not empty)
      const updatedUser = await prisma.user.findUnique({ where: { email } });
      expect(updatedUser!.password).not.toBe('');
      expect(updatedUser!.password.length).toBeGreaterThan(10); // Hashed password
    });

    it('should reject missing token', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({ password: VALID_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.activationTokenRequired);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({ token: 'invalid-token', password: VALID_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.activationTokenInvalid);
    });

    it('should reject expired token', async () => {
      const token = `expired-${Date.now()}`;
      const manager = await prisma.manager.create({
        data: {
          permissions: {},
          activationToken: token,
          activationTokenExpiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        },
      });
      await prisma.user.create({
        data: {
          email: `expired-${Date.now()}@example.com`,
          password: '',
          name: 'Expired Token Test',
          managerId: manager.id,
        },
      });

      const res = await request(app)
        .post('/api/auth/activate')
        .send({ token, password: VALID_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject weak password', async () => {
      const token = `weak-${Date.now()}`;
      const manager = await prisma.manager.create({
        data: {
          permissions: {},
          activationToken: token,
          activationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      await prisma.user.create({
        data: {
          email: `weak-${Date.now()}@example.com`,
          password: '',
          name: 'Weak Password Test',
          managerId: manager.id,
        },
      });

      const res = await request(app)
        .post('/api/auth/activate')
        .send({ token, password: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();

      // Verify token was NOT cleared (activation failed)
      const unchangedManager = await prisma.manager.findUnique({ where: { id: manager.id } });
      expect(unchangedManager!.activationToken).toBe(token);
    });

    it('should allow login after activation', async () => {
      const token = `login-${Date.now()}`;
      const email = `login-${Date.now()}@example.com`;
      const manager = await prisma.manager.create({
        data: {
          permissions: {},
          activationToken: token,
          activationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      await prisma.user.create({
        data: {
          email,
          password: '',
          name: 'Login Test',
          managerId: manager.id,
        },
      });

      // Activate
      const activateRes = await request(app)
        .post('/api/auth/activate')
        .send({ token, password: VALID_PASSWORD });
      expect(activateRes.status).toBe(200);

      // Login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: VALID_PASSWORD });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.account).toBeDefined();
      expect(loginRes.body.account.email).toBe(email);
      expect(loginRes.body.account.accountType).toBe('manager');
      expect(loginRes.body.token).toBeDefined();

      // Verify session was created in DB
      const user = await prisma.user.findUnique({ where: { email } });
      const sessions = await prisma.session.findMany({ where: { userId: user!.id } });
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should reject reusing same activation token', async () => {
      const token = `reuse-${Date.now()}`;
      const manager = await prisma.manager.create({
        data: {
          permissions: {},
          activationToken: token,
          activationTokenExpiresAt: new Date(Date.now() + 86400000),
        },
      });
      await prisma.user.create({
        data: {
          email: `reuse-${Date.now()}@example.com`,
          password: '',
          name: 'Reuse Token Test',
          managerId: manager.id,
        },
      });

      // First activation should succeed
      const res1 = await request(app)
        .post('/api/auth/activate')
        .send({ token, password: VALID_PASSWORD });
      expect(res1.status).toBe(200);

      // Second activation with same token should fail
      const res2 = await request(app)
        .post('/api/auth/activate')
        .send({ token, password: VALID_PASSWORD });
      expect(res2.status).toBe(400);
      expect(res2.body.errors).toContain(ERROR.activationTokenInvalid);
    });
  });
});
