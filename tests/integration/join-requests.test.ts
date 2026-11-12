// Integration tests - Requests to join a team: a player without a team asks,
// those who may invite are told and answer; one request at a time, a refusal
// for good, the same team asked again only a day on, a request dropped once
// the player has a team another way

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { JOIN_REQUEST_AGAIN_PAUSE_MS } from '../../server/src/services/join-requests.service';
import { authHeader, createAuthenticatedUser, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';

function ask(token: string, teamId: unknown) {
  return request(app).post('/api/join-requests').set(authHeader(token)).send({ teamId });
}

function mine(token: string) {
  return request(app).get('/api/join-requests/mine').set(authHeader(token));
}

function waiting(token: string) {
  return request(app).get('/api/teams/current/join-requests').set(authHeader(token));
}

function answer(token: string, requestId: string, verdict: 'accept' | 'refuse') {
  return request(app).post(`/api/teams/current/join-requests/${requestId}/${verdict}`).set(authHeader(token));
}

// A member the leader lets invite others, and so answer the requests
async function inviter(leaderToken: string, teamId: string) {
  const member = await createTeamMember(leaderToken, teamId);
  await request(app)
    .put(`/api/teams/current/members/${member.user.id}/permissions`)
    .set(authHeader(leaderToken))
    .send({ permissions: { ...DEFAULT_PLAYER_PERMISSIONS, team: { ...DEFAULT_PLAYER_PERMISSIONS.team, canInviteMembers: true } } })
    .expect(200);
  return member;
}

// The players a notification of that kind reached
async function toldOf(kind: 'TEAM_JOIN_REQUESTED') {
  const entries = await prisma.notificationInboxEntry.findMany({ where: { notification: { kind } }, select: { playerId: true } });
  return entries.map(entry => entry.playerId).sort();
}

describe('Asking to join a team', () => {
  it('reaches the leader and the members who may invite, with who asks', async () => {
    const leader = await createUserWithTeam();
    const allowed = await inviter(leader.token, leader.team.id);
    await createTeamMember(leader.token, leader.team.id);
    const asking = await createAuthenticatedUser();
    await prisma.player.update({ where: { id: asking.user.playerId }, data: { evaUsername: 'RONxSib#177352' } });

    const res = await ask(asking.token, leader.team.id);

    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ status: 'PENDING', team: { id: leader.team.id, name: leader.team.name, logoUrl: null } });
    expect(await toldOf('TEAM_JOIN_REQUESTED')).toEqual([leader.user.playerId, allowed.playerId].sort());
    const notification = await prisma.notification.findFirstOrThrow({ where: { kind: 'TEAM_JOIN_REQUESTED' } });
    expect(notification).toMatchObject({ teamId: leader.team.id, data: { requestId: res.body.request.id, playerName: asking.user.name, evaUsername: 'RONxSib#177352' } });
  });

  it('waits on one request at a time', async () => {
    const first = await createUserWithTeam();
    const second = await createUserWithTeam();
    const asking = await createAuthenticatedUser();
    await ask(asking.token, first.team.id).expect(201);

    const again = await ask(asking.token, second.team.id);
    expect(again.status).toBe(409);
    expect(again.body.errors).toContain(ERROR.joinRequestAlreadyPending);

    await request(app).delete('/api/join-requests/mine').set(authHeader(asking.token)).expect(204);
    expect((await mine(asking.token)).body.request).toBeNull();
    await ask(asking.token, second.team.id).expect(201);
    expect((await waiting(first.token)).body.requests).toEqual([]);
  });

  it('asks a team it took its request back from again only a day after asking it', async () => {
    const leader = await createUserWithTeam();
    const asking = await createAuthenticatedUser();
    const sent = (await ask(asking.token, leader.team.id)).body.request;
    await request(app).delete('/api/join-requests/mine').set(authHeader(asking.token)).expect(204);

    const tooSoon = await ask(asking.token, leader.team.id);
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.errors).toContain(ERROR.joinRequestTooSoon);
    expect((await waiting(leader.token)).body.requests).toEqual([]);
    expect(await toldOf('TEAM_JOIN_REQUESTED')).toEqual([leader.user.playerId]);

    // A day after the request taken back, the team may hear from them again
    await prisma.teamJoinRequest.update({ where: { id: sent.id }, data: { createdAt: new Date(Date.now() - JOIN_REQUEST_AGAIN_PAUSE_MS) } });
    const again = await ask(asking.token, leader.team.id);
    expect(again.status).toBe(201);
    expect((await mine(asking.token)).body.request).toMatchObject({ id: again.body.request.id, status: 'PENDING' });
    expect((await waiting(leader.token)).body.requests).toMatchObject([{ id: again.body.request.id }]);
    expect(await toldOf('TEAM_JOIN_REQUESTED')).toEqual([leader.user.playerId, leader.user.playerId]);
  });

  it('never asks again a team that refused, and sees the refusal once', async () => {
    const leader = await createUserWithTeam();
    const other = await createUserWithTeam();
    const asking = await createAuthenticatedUser();
    const sent = (await ask(asking.token, leader.team.id)).body.request;
    expect((await mine(asking.token)).body.request).toMatchObject({ id: sent.id, status: 'PENDING' });

    await answer(leader.token, sent.id, 'refuse').expect(204);

    expect((await mine(asking.token)).body.request).toMatchObject({ id: sent.id, status: 'REFUSED', team: { name: leader.team.name } });
    await request(app).post('/api/join-requests/mine/seen').set(authHeader(asking.token)).expect(204);
    expect((await mine(asking.token)).body.request).toBeNull();

    const refused = await ask(asking.token, leader.team.id);
    expect(refused.status).toBe(403);
    expect(refused.body.errors).toContain(ERROR.joinRequestRefusedBefore);
    await ask(asking.token, other.team.id).expect(201);
  });

  it('is for a player without a team, to a team that exists', async () => {
    const leader = await createUserWithTeam();
    const member = await createUserWithTeam();
    const asking = await createAuthenticatedUser();

    const inTeam = await ask(member.token, leader.team.id);
    expect(inTeam.status).toBe(400);
    expect(inTeam.body.errors).toContain(ERROR.userAlreadyInTeam);
    expect((await ask(asking.token, 'no-such-team')).status).toBe(404);
    expect((await ask(asking.token, undefined)).status).toBe(400);
  });
});

describe('Answering the requests', () => {
  it('lists the waiting requests with who asks, oldest first', async () => {
    const leader = await createUserWithTeam();
    const first = await createAuthenticatedUser();
    const second = await createAuthenticatedUser();
    await prisma.player.update({ where: { id: second.user.playerId }, data: { evaUsername: 'Nova#424242' } });
    await ask(first.token, leader.team.id).expect(201);
    await ask(second.token, leader.team.id).expect(201);

    const res = await waiting(leader.token);

    expect(res.status).toBe(200);
    expect(res.body.requests.map((one: { playerName: string; evaUsername: string | null }) => [one.playerName, one.evaUsername]))
      .toEqual([[first.user.name, null], [second.user.name, 'Nova#424242']]);
  });

  it('lets the player in as a new member, and the request goes', async () => {
    const leader = await createUserWithTeam();
    const allowed = await inviter(leader.token, leader.team.id);
    const asking = await createAuthenticatedUser();
    const sent = (await ask(asking.token, leader.team.id)).body.request;

    await answer(allowed.token, sent.id, 'accept').expect(204);

    const player = await prisma.player.findUniqueOrThrow({ where: { id: asking.user.playerId } });
    expect(player.teamId).toBe(leader.team.id);
    expect(player.permissions).toEqual(DEFAULT_PLAYER_PERMISSIONS);
    expect(await prisma.teamJoinRequest.count()).toBe(0);
    expect((await mine(asking.token)).body.request).toBeNull();
    expect((await request(app).get('/api/teams/current').set(authHeader(asking.token))).body.id).toBe(leader.team.id);
  });

  it('drops a request once the player has a team another way', async () => {
    const asked = await createUserWithTeam();
    const elsewhere = await createUserWithTeam();
    const byLink = await createAuthenticatedUser();
    const byOwnTeam = await createAuthenticatedUser();
    await ask(byLink.token, asked.team.id).expect(201);
    await ask(byOwnTeam.token, asked.team.id).expect(201);

    const invite = await request(app).post(`/api/teams/${elsewhere.team.id}/invites`).set(authHeader(elsewhere.token)).send({ expiresInHours: 24, maxUses: 1 });
    await request(app).post(`/api/invites/${invite.body.code}/join`).set(authHeader(byLink.token)).expect(200);
    await request(app).post('/api/teams').set(authHeader(byOwnTeam.token)).send({ name: 'Les Nouveaux' }).expect(201);

    expect((await waiting(asked.token)).body.requests).toEqual([]);
  });

  it('leaves a player who joined another team meanwhile where they are', async () => {
    const leader = await createUserWithTeam();
    const elsewhere = await createUserWithTeam();
    const asking = await createAuthenticatedUser();
    const sent = (await ask(asking.token, leader.team.id)).body.request;
    // Joined at the same moment, past the request
    await prisma.player.update({ where: { id: asking.user.playerId }, data: { teamId: elsewhere.team.id } });

    const res = await answer(leader.token, sent.id, 'accept');

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.joinRequestPlayerTaken);
    expect((await prisma.player.findUniqueOrThrow({ where: { id: asking.user.playerId } })).teamId).toBe(elsewhere.team.id);
    expect(await prisma.teamJoinRequest.count()).toBe(0);
  });

  it('is for those who may invite, on their own team\'s requests', async () => {
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id);
    const other = await createUserWithTeam();
    const asking = await createAuthenticatedUser();
    const sent = (await ask(asking.token, leader.team.id)).body.request;

    expect((await waiting(member.token)).status).toBe(403);
    expect((await answer(member.token, sent.id, 'accept')).status).toBe(403);
    for (const verdict of ['accept', 'refuse'] as const) {
      const res = await answer(other.token, sent.id, verdict);
      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.joinRequestNotFound);
    }
    expect((await mine(asking.token)).body.request.status).toBe('PENDING');
  });

  it('goes with the team when it is deleted', async () => {
    const leader = await createUserWithTeam();
    const asking = await createAuthenticatedUser();
    await ask(asking.token, leader.team.id).expect(201);

    await request(app).delete('/api/teams/current').set(authHeader(leader.token)).expect(200);

    expect((await mine(asking.token)).body.request).toBeNull();
  });
});
