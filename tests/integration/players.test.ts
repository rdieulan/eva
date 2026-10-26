// Integration tests - Players routes (subscription)

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createAuthenticatedAdmin } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';

describe('Players API', () => {
  describe('GET /api/players/me/subscription', () => {
    it('should return an empty subscription for a new player', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tier: null, renewalDate: null });
    });

    it('should reject an account that is not a player', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .get('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.playerAccountRequired);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/players/me/subscription');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/players/me/subscription', () => {
    it('should save the tier and renewal date, then read them back', async () => {
      const { token, user } = await createAuthenticatedUser();

      const res = await request(app)
        .put('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: 'SILVER', renewalDate: '2026-10-05' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tier: 'SILVER', renewalDate: '2026-10-05' });

      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.subscriptionTier).toBe('SILVER');
      expect(player!.subscriptionRenewalDate!.toISOString().slice(0, 10)).toBe('2026-10-05');

      const reread = await request(app)
        .get('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`);
      expect(reread.body).toEqual({ tier: 'SILVER', renewalDate: '2026-10-05' });
    });

    it('should clear both fields with null', async () => {
      const { token } = await createAuthenticatedUser();

      await request(app)
        .put('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: 'GOLD', renewalDate: '2026-10-05' })
        .expect(200);

      const res = await request(app)
        .put('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: null, renewalDate: null });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tier: null, renewalDate: null });
    });

    it('should reject an unknown tier and an impossible date', async () => {
      const { token, user } = await createAuthenticatedUser();

      const res = await request(app)
        .put('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: 'PLATINUM', renewalDate: '2026-02-31' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([ERROR.subscriptionTierInvalid, ERROR.subscriptionRenewalDateInvalid]);

      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.subscriptionTier).toBeNull();
      expect(player!.subscriptionRenewalDate).toBeNull();
    });

    it('should reject an account that is not a player', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put('/api/players/me/subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: 'GOLD', renewalDate: '2026-10-05' });

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.playerAccountRequired);
    });
  });
});
