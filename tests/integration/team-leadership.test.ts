// Integration tests - Handing a team over: the leader names another member
// leader; the former leader stays a member with every permission a leader has

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { LEADER_PERMISSIONS } from '@shared/types';

function handOver(token: string, memberId: unknown) {
  return request(app).put('/api/teams/current/leader').set(authHeader(token)).send({ memberId });
}

describe('PUT /api/teams/current/leader', () => {
  it('names another member leader: the team page follows for both', async () => {
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id);

    const res = await handOver(leader.token, member.user.id);

    expect(res.status).toBe(200);
    const team = await prisma.team.findUniqueOrThrow({ where: { id: leader.team.id } });
    expect(team.leaderId).toBe(member.playerId);
    expect((await request(app).get('/api/teams/current').set(authHeader(member.token))).body.isLeader).toBe(true);
    expect((await request(app).get('/api/teams/current').set(authHeader(leader.token))).body.isLeader).toBe(false);
  });

  it('keeps the former leader in the team with every permission, for the new leader to adjust', async () => {
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id);
    const third = await createTeamMember(leader.token, leader.team.id);
    await handOver(leader.token, member.user.id).expect(200);

    const former = await prisma.player.findUniqueOrThrow({ where: { id: leader.user.playerId } });
    expect(former.teamId).toBe(leader.team.id);
    expect(former.permissions).toEqual(LEADER_PERMISSIONS);
    // Still able to manage: removing a member
    await request(app).delete(`/api/teams/current/members/${third.user.id}`).set(authHeader(leader.token)).expect(200);
    // But the team is the new leader's: only they delete it
    const deleting = await request(app).delete('/api/teams/current').set(authHeader(leader.token));
    expect(deleting.status).toBe(403);
    expect(deleting.body.errors).toContain(ERROR.onlyLeaderCanDelete);
  });

  it('is for the leader only', async () => {
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id, { canSearch: true, canPropose: true, canRespond: true });
    const other = await createTeamMember(leader.token, leader.team.id);

    const res = await handOver(member.token, other.user.id);

    expect(res.status).toBe(403);
    expect(res.body.errors).toContain(ERROR.onlyLeaderCanTransfer);
    const team = await prisma.team.findUniqueOrThrow({ where: { id: leader.team.id } });
    expect(team.leaderId).toBe(leader.user.playerId);
  });

  it('refuses someone outside the team, nobody, and the leader themself', async () => {
    const leader = await createUserWithTeam();
    const stranger = await createAuthenticatedUser();
    const otherTeam = await createUserWithTeam();

    for (const target of [stranger.user.id, otherTeam.user.id, 'nobody']) {
      const res = await handOver(leader.token, target);
      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.memberNotFound);
    }
    expect((await handOver(leader.token, undefined)).status).toBe(400);

    const self = await handOver(leader.token, leader.user.id);
    expect(self.status).toBe(400);
    expect(self.body.errors).toContain(ERROR.memberAlreadyLeader);
  });

  it('lets one of two hand-overs at once win', async () => {
    const leader = await createUserWithTeam();
    const first = await createTeamMember(leader.token, leader.team.id);
    const second = await createTeamMember(leader.token, leader.team.id);

    const results = await Promise.all([handOver(leader.token, first.user.id), handOver(leader.token, second.user.id)]);

    expect(results.map(res => res.status).sort()).toEqual([200, 403]);
    const team = await prisma.team.findUniqueOrThrow({ where: { id: leader.team.id } });
    expect([first.playerId, second.playerId]).toContain(team.leaderId);
  });
});
