// Integration tests - Linked accounts routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { PASSWORD_MIN_LENGTH } from '@shared/constants/validation.constants';

const VALID_PASSWORD = 'A' + '1' + 'a'.repeat(PASSWORD_MIN_LENGTH - 2);

describe('Linked Accounts API', () => {
  describe('POST /api/auth/link-account', () => {
    it('should link two accounts successfully', async () => {
      const password = VALID_PASSWORD;
      const { token: token1 } = await createAuthenticatedUser({ password });
      const email2 = `link-target-${Date.now()}@example.com`;
      await createAuthenticatedUser({ email: email2, password });

      const res = await request(app)
        .post('/api/auth/link-account')
        .set('Authorization', `Bearer ${token1}`)
        .send({ email: email2, password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('groupId');
    });

    it('should reject linking to self', async () => {
      const email = `self-link-${Date.now()}@example.com`;
      const password = VALID_PASSWORD;
      const { token } = await createAuthenticatedUser({ email, password });

      const res = await request(app)
        .post('/api/auth/link-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ email, password });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.cannotLinkSameAccount);
    });

    it('should reject invalid credentials', async () => {
      const { token } = await createAuthenticatedUser();
      const { user: target } = await createAuthenticatedUser();

      const res = await request(app)
        .post('/api/auth/link-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: target.email, password: 'wrongpassword123A' });

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.loginFailed);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/auth/link-account')
        .send({ email: 'test@example.com', password: VALID_PASSWORD });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/linked-accounts', () => {
    it('should return linked accounts', async () => {
      const password = VALID_PASSWORD;
      const { token: token1, user: user1 } = await createAuthenticatedUser({ password });
      const email2 = `linked-${Date.now()}@example.com`;
      const { user: user2 } = await createAuthenticatedUser({ email: email2, password });

      // Link accounts
      await request(app)
        .post('/api/auth/link-account')
        .set('Authorization', `Bearer ${token1}`)
        .send({ email: email2, password });

      const res = await request(app)
        .get('/api/auth/linked-accounts')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);

      // Check current account is marked
      const currentAccount = res.body.find((a: { id: string }) => a.id === user1.id);
      expect(currentAccount.isCurrent).toBe(true);

      const otherAccount = res.body.find((a: { id: string }) => a.id === user2.id);
      expect(otherAccount.isCurrent).toBe(false);
    });

    it('should return only self if no linked accounts', async () => {
      const { token, user } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/auth/linked-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(user.id);
      expect(res.body[0].isCurrent).toBe(true);
    });
  });

  describe('POST /api/auth/switch-account', () => {
    it('should switch to linked account', async () => {
      const password = VALID_PASSWORD;
      const { token: token1 } = await createAuthenticatedUser({ password });
      const email2 = `switch-${Date.now()}@example.com`;
      const { user: user2 } = await createAuthenticatedUser({ email: email2, password });

      // Link accounts
      await request(app)
        .post('/api/auth/link-account')
        .set('Authorization', `Bearer ${token1}`)
        .send({ email: email2, password });

      // Switch to second account
      const res = await request(app)
        .post('/api/auth/switch-account')
        .set('Authorization', `Bearer ${token1}`)
        .send({ targetAccountId: user2.id });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.account.id).toBe(user2.id);
    });

    it('should reject switch to non-linked account', async () => {
      const { token: token1 } = await createAuthenticatedUser();
      const { user: unlinkedUser } = await createAuthenticatedUser();

      const res = await request(app)
        .post('/api/auth/switch-account')
        .set('Authorization', `Bearer ${token1}`)
        .send({ targetAccountId: unlinkedUser.id });

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.accountNotInGroup);
    });

    it('should reject without target account ID', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .post('/api/auth/switch-account')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.targetAccountIdRequired);
    });
  });
});
