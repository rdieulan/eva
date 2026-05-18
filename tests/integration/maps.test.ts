// Integration tests - Maps routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';

describe('Maps API', () => {
  describe('GET /api/maps', () => {
    it('should return maps with game plans for authenticated user with team', async () => {
      const { token, team } = await createUserWithTeam();

      // Verify game plans exist in DB for this team
      const gamePlansInDb = await prisma.gamePlan.findMany({
        where: { teamId: team.id },
        include: { map: true },
      });
      expect(gamePlansInDb.length).toBeGreaterThan(0);

      const res = await request(app)
        .get('/api/maps')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Verify each map has expected structure
      for (const map of res.body) {
        expect(map).toHaveProperty('id');
        expect(map).toHaveProperty('name');
        expect(typeof map.id).toBe('string');
        expect(typeof map.name).toBe('string');
      }

      // Verify maps correspond to those in DB
      const mapIdsInDb = gamePlansInDb.map(gp => gp.mapId);
      const mapIdsReturned = res.body.map((m: any) => m.id);
      expect(mapIdsReturned.sort()).toEqual([...new Set(mapIdsInDb)].sort());
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/maps');

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.tokenMissing);
    });

    it('should reject user without team', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/maps')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.teamRequiredForMaps);
    });

    it('should isolate game plans by team', async () => {
      // Create two teams - each will have default game plans created via API
      const { token: token1, team: team1 } = await createUserWithTeam({
        email: 'team1@example.com',
      });
      const { token: token2, team: team2 } = await createUserWithTeam({
        email: 'team2@example.com',
      });

      // Rename one plan for team1 to identify it
      const team1Plans = await prisma.gamePlan.findMany({ where: { teamId: team1.id } });
      expect(team1Plans.length).toBeGreaterThan(0);
      await prisma.gamePlan.update({
        where: { id: team1Plans[0].id },
        data: { name: 'Team1 Unique Plan' },
      });

      // Rename one plan for team2 to identify it
      const team2Plans = await prisma.gamePlan.findMany({ where: { teamId: team2.id } });
      expect(team2Plans.length).toBeGreaterThan(0);
      await prisma.gamePlan.update({
        where: { id: team2Plans[0].id },
        data: { name: 'Team2 Unique Plan' },
      });

      // Team1 should only see their plans
      const res1 = await request(app)
        .get('/api/maps')
        .set('Authorization', `Bearer ${token1}`);

      expect(res1.status).toBe(200);
      const allPlanNames1 = res1.body.flatMap((m: any) => m.gamePlans?.map((p: any) => p.name) || []);
      expect(allPlanNames1).toContain('Team1 Unique Plan');
      expect(allPlanNames1).not.toContain('Team2 Unique Plan');

      // Team2 should only see their plans
      const res2 = await request(app)
        .get('/api/maps')
        .set('Authorization', `Bearer ${token2}`);

      expect(res2.status).toBe(200);
      const allPlanNames2 = res2.body.flatMap((m: any) => m.gamePlans?.map((p: any) => p.name) || []);
      expect(allPlanNames2).toContain('Team2 Unique Plan');
      expect(allPlanNames2).not.toContain('Team1 Unique Plan');
    });
  });
});
