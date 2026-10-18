// Integration tests - Teams routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma, expectNoRecordCreated } from './helpers/db';
import { TEAM_NAME_MIN_LENGTH } from '@shared/constants/validation.constants';
import { ERROR } from '@shared/constants/error.constants';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';

// Valid test data based on validation rules
const VALID_TEAM_NAME = 'T'.repeat(TEAM_NAME_MIN_LENGTH);

describe('Teams API', () => {
  describe('POST /api/teams', () => {
    it('should create a team successfully', async () => {
      const { token, user } = await createAuthenticatedUser();

      // Count existing maps to know how many game plans should be created
      const mapCount = await prisma.map.count();

      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: VALID_TEAM_NAME, location: 'Europe - West' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(VALID_TEAM_NAME);

      // Verify team exists in DB
      const team = await prisma.team.findUnique({ where: { id: res.body.id } });
      expect(team).not.toBeNull();
      expect(team!.name).toBe(VALID_TEAM_NAME);
      expect(team!.leaderId).toBe(user.playerId);

      // Verify player is now in the team
      const updatedPlayer = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(updatedPlayer!.teamId).toBe(res.body.id);

      // Verify default game plans were created for each map
      const gamePlans = await prisma.gamePlan.findMany({
        where: { teamId: res.body.id },
      });
      expect(gamePlans.length).toBe(mapCount);
      expect(gamePlans.every(gp => gp.name === 'Default')).toBe(true);
      expect(gamePlans.every(gp => gp.teamId === res.body.id)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/teams')
        .send({ name: VALID_TEAM_NAME });

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.tokenMissing);
    });

    it('should reject if user already has a team', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: VALID_TEAM_NAME });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.userAlreadyInTeam);
    });
  });

  describe('GET /api/teams/current', () => {
    it('should return current team info', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/teams/current')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(team.id);
    });

    it('should identify the leader and key members by user id', async () => {
      const { token, user } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/teams/current')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLeader).toBe(true);
      // User id, not Player id: that is what the client session carries
      expect(res.body.leader).toMatchObject({ id: user.id, name: user.name, email: user.email });
      expect(res.body.leaderId).toBe(user.playerId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0]).toMatchObject({ id: user.id, isLeader: true });
      expect(res.body.members[0].name).toBe(user.name);
    });

    it('should not flag a regular member as leader', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(inviteRes.status).toBe(201);

      const { token: memberToken } = await createAuthenticatedUser();
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const res = await request(app)
        .get('/api/teams/current')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isLeader).toBe(false);
      expect(res.body.members).toHaveLength(2);
    });

    it('should return 404 if user has no team', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/teams/current')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.teamNotFound);
    });
  });

  describe('DELETE /api/teams/current', () => {
    it('should let the leader delete their team and free its members', async () => {
      const { token: leaderToken, user: leader, team } = await createUserWithTeam();

      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(inviteRes.status).toBe(201);

      const { user: member, token: memberToken } = await createAuthenticatedUser();
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const res = await request(app)
        .delete('/api/teams/current')
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(res.status).toBe(200);
      expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
      expect(await prisma.gamePlan.count({ where: { teamId: team.id } })).toBe(0);

      for (const playerId of [leader.playerId!, member.playerId!]) {
        const freed = await prisma.player.findUnique({ where: { id: playerId } });
        expect(freed!.teamId).toBeNull();
        expect(freed!.permissions).toEqual(DEFAULT_PLAYER_PERMISSIONS);
      }
    });

    it('should reject a member who is not the leader', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(inviteRes.status).toBe(201);

      const { token: memberToken } = await createAuthenticatedUser();
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const res = await request(app)
        .delete('/api/teams/current')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.onlyLeaderCanDelete);
      expect(await prisma.team.findUnique({ where: { id: team.id } })).not.toBeNull();
    });

    it('should return 404 when the user has no team', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .delete('/api/teams/current')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.teamNotFound);
    });
  });

  describe('POST /api/invites/:code/join', () => {
    it('should join with valid invite code', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      // Create invitation via API
      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ expiresInHours: 24, maxUses: 5 });

      expect(inviteRes.status).toBe(201);

      const { token: joinerToken } = await createAuthenticatedUser({
        email: 'joiner@example.com',
      });

      const res = await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set('Authorization', `Bearer ${joinerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('teamId');
      expect(res.body).toHaveProperty('teamName');
      expect(res.body.teamId).toBe(team.id);

      // Verify invite uses incremented
      const updatedInvite = await prisma.teamInvite.findUnique({ where: { code: inviteRes.body.code } });
      expect(updatedInvite!.uses).toBe(1);
    });

    it('should reject expired invite code', async () => {
      const { user: leader, team } = await createUserWithTeam();

      // NOTE: We use Prisma directly here because we need to create an INVALID invitation
      // (expired) that cannot be created via the API
      await prisma.teamInvite.create({
        data: {
          teamId: team.id,
          createdById: leader.playerId!,
          code: 'EXPIREDCODE',
          expiresAt: new Date(Date.now() - 1000), // Already expired
          maxUses: 5,
          uses: 0,
        },
      });

      const { token } = await createAuthenticatedUser({ email: 'joiner2@example.com' });

      const res = await request(app)
        .post('/api/invites/EXPIREDCODE/join')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.inviteExpired);
    });

    it('should reject invalid invite code', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .post('/api/invites/INVALIDCODE/join')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.inviteInvalid);
    });
  });

  describe('POST /api/teams/:teamId/invites', () => {
    it('should create an invitation link successfully', async () => {
      const { token, team, user } = await createUserWithTeam();

      // Leader has canInviteMembers by default
      const res = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expiresInHours: 24, maxUses: 5 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body.maxUses).toBe(5);

      // Verify invitation exists in DB
      const invite = await prisma.teamInvite.findUnique({ where: { code: res.body.code } });
      expect(invite).not.toBeNull();
      expect(invite!.teamId).toBe(team.id);
      expect(invite!.createdById).toBe(user.playerId);
      expect(invite!.maxUses).toBe(5);
      expect(invite!.uses).toBe(0);
    });

    it('should reject without authentication', async () => {
      const { team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .send({ expiresInHours: 24, maxUses: 1 })
      );

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.tokenMissing);
    });

    it('should reject user without canInviteMembers permission', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      // Create a member without invite permission
      const { token: memberToken } = await createAuthenticatedUser({
        email: 'member@example.com',
      });

      // Create invitation with leader
      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ expiresInHours: 24, maxUses: 1 });

      // Member joins via invite (they don't have canInviteMembers by default)
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set('Authorization', `Bearer ${memberToken}`);

      // Member tries to create an invite (should fail - no permission)
      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ expiresInHours: 24, maxUses: 1 })
      );

      expect(res.status).toBe(403);
    });

    it('should reject invalid expiresInHours', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set('Authorization', `Bearer ${token}`)
          .send({ expiresInHours: 200, maxUses: 1 }) // Max is 168
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.inviteExpirationInvalid);
    });

    it('should reject invalid maxUses', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set('Authorization', `Bearer ${token}`)
          .send({ expiresInHours: 24, maxUses: 100 }) // Max is 50
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.inviteMaxUsesInvalid);
    });

    it('should reject if user does not belong to team', async () => {
      const { team } = await createUserWithTeam();
      const { token: otherToken } = await createUserWithTeam({ email: 'other@example.com' });

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ expiresInHours: 24, maxUses: 1 })
      );

      expect(res.status).toBe(403);
    });
  });
});
