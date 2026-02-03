// Integration tests - Venues routes

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';

// Test venue data
const TEST_VENUE = {
  id: 'test-venue-1',
  name: 'EVA Paris',
  city: 'Paris',
  address: '123 Rue de la VR',
  phone: '+33 1 23 45 67 89',
};

describe('Venues API', () => {
  // Seed a test venue before tests
  beforeAll(async () => {
    // Check if venue exists, create if not
    const existing = await prisma.venue.findUnique({ where: { id: TEST_VENUE.id } });
    if (!existing) {
      await prisma.venue.create({ data: TEST_VENUE });
    }
  });

  describe('GET /api/venues', () => {
    it('should return list of venues for authenticated user', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/venues')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Check venue structure
      const venue = res.body.find((v: { id: string }) => v.id === TEST_VENUE.id);
      expect(venue).toBeDefined();
      expect(venue.name).toBe(TEST_VENUE.name);
      expect(venue.city).toBe(TEST_VENUE.city);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/venues');

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.tokenMissing);
    });
  });

  describe('PUT /api/teams/current (venue update)', () => {
    it('should allow leader to change team venue', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await request(app)
        .put('/api/teams/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ venueId: TEST_VENUE.id });

      expect(res.status).toBe(200);
      expect(res.body.venueId).toBe(TEST_VENUE.id);

      // Verify in DB
      const updatedTeam = await prisma.team.findUnique({ where: { id: team.id } });
      expect(updatedTeam!.venueId).toBe(TEST_VENUE.id);
    });

    it('should allow setting venue to null', async () => {
      const { token, team } = await createUserWithTeam();

      // First set a venue
      await request(app)
        .put('/api/teams/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ venueId: TEST_VENUE.id });

      // Verify venue was set
      const teamWithVenue = await prisma.team.findUnique({ where: { id: team.id } });
      expect(teamWithVenue!.venueId).toBe(TEST_VENUE.id);

      // Then remove it
      const res = await request(app)
        .put('/api/teams/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ venueId: null });

      expect(res.status).toBe(200);
      expect(res.body.venueId).toBeNull();

      // Verify in DB
      const updatedTeam = await prisma.team.findUnique({ where: { id: team.id } });
      expect(updatedTeam!.venueId).toBeNull();
    });

    it('should reject invalid venue ID', async () => {
      const { token, team } = await createUserWithTeam();
      const originalTeam = await prisma.team.findUnique({ where: { id: team.id } });

      const res = await request(app)
        .put('/api/teams/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ venueId: 'non-existent-venue' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();

      // Verify venue was NOT changed in DB
      const unchangedTeam = await prisma.team.findUnique({ where: { id: team.id } });
      expect(unchangedTeam!.venueId).toBe(originalTeam!.venueId);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .put('/api/teams/current')
        .send({ venueId: TEST_VENUE.id });

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.tokenMissing);
    });

    it('should reject non-leader member without permission', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      // Create a second member
      const { token: memberToken } = await createAuthenticatedUser();

      // Create invite
      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ expiresInHours: 24, maxUses: 1 });

      if (inviteRes.body.code) {
        // Join team
        await request(app)
          .post(`/api/invites/${inviteRes.body.code}/join`)
          .set('Authorization', `Bearer ${memberToken}`);

        // Try to change venue as non-leader (should fail without permission)
        const res = await request(app)
          .put('/api/teams/current')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ venueId: TEST_VENUE.id });

        expect(res.status).toBe(403);
        expect(res.body.errors).toBeDefined();

        // Verify venue was NOT changed in DB
        const unchangedTeam = await prisma.team.findUnique({ where: { id: team.id } });
        expect(unchangedTeam!.venueId).not.toBe(TEST_VENUE.id);
      }
    });
  });
});
