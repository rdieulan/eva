// Integration tests - Game Plans routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createUserWithTeam, createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';

describe('Plans API', () => {
  describe('PUT /api/plans/:planId - player assignments', () => {
    it('accepts the User.id the frontend sends and stores it as the Player.id foreign key', async () => {
      const { token, user, team } = await createUserWithTeam();

      const plan = await prisma.gamePlan.findFirst({ where: { teamId: team.id } });
      expect(plan).not.toBeNull();

      // The frontend identifies players by User.id (that is what /api/players
      // returns), so that is what it sends back on save.
      const res = await request(app)
        .put(`/api/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          players: [{ playerId: user.id, assignmentIds: [1, 2], mainAssignmentId: 1 }],
        });

      // Regression: this used to 500 with a GamePlanPlayer_playerId_fkey violation.
      expect(res.status).toBe(200);

      // The stored row must reference Player.id, not the User.id from the request.
      const rows = await prisma.gamePlanPlayer.findMany({ where: { gamePlanId: plan!.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.playerId).toBe(user.playerId);
      expect(rows[0]!.playerId).not.toBe(user.id);
      expect(rows[0]!.assignmentIds).toEqual([1, 2]);
      expect(rows[0]!.mainAssignmentId).toBe(1);

      // Read path round-trips back to the User.id space the frontend expects.
      const getRes = await request(app)
        .get(`/api/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.players).toHaveLength(1);
      expect(getRes.body.players[0].playerId).toBe(user.id);
      expect(getRes.body.players[0].assignmentIds).toEqual([1, 2]);
      expect(getRes.body.players[0].mainAssignmentId).toBe(1);
    });

    it('skips ids that are not team players instead of failing the whole save', async () => {
      const { token, team } = await createUserWithTeam({ email: 'leader-skip@example.com' });
      const { user: outsider } = await createAuthenticatedUser({ email: 'outsider@example.com' });

      const plan = await prisma.gamePlan.findFirst({ where: { teamId: team.id } });

      const res = await request(app)
        .put(`/api/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          players: [
            { playerId: outsider.id, assignmentIds: [1] }, // valid user, not in team -> skip
            { playerId: 'does-not-exist', assignmentIds: [2] }, // unknown id -> skip
          ],
        });

      expect(res.status).toBe(200);

      const rows = await prisma.gamePlanPlayer.findMany({ where: { gamePlanId: plan!.id } });
      expect(rows).toHaveLength(0);
    });

    it('replaces existing assignments and does not wipe them when the request is valid', async () => {
      const { token, user, team } = await createUserWithTeam({ email: 'leader-replace@example.com' });
      const plan = await prisma.gamePlan.findFirst({ where: { teamId: team.id } });

      await request(app)
        .put(`/api/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ players: [{ playerId: user.id, assignmentIds: [1] }] });

      const res = await request(app)
        .put(`/api/plans/${plan!.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ players: [{ playerId: user.id, assignmentIds: [3, 4], mainAssignmentId: 3 }] });

      expect(res.status).toBe(200);

      const rows = await prisma.gamePlanPlayer.findMany({ where: { gamePlanId: plan!.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.assignmentIds).toEqual([3, 4]);
      expect(rows[0]!.mainAssignmentId).toBe(3);
    });
  });
});
