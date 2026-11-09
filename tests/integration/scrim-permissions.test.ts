// Integration tests - Matchmaking permissions: the team's leader decides who
// searches, who proposes matches to other teams, and who answers proposals
//
// eva.gg is never called: the sessions lookup is mocked so searches can open.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createTeamMember, createUserWithTeam, authHeader } from './helpers/auth';
import { prisma } from './helpers/db';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import type { MatchmakingPermissions } from '@shared/types';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', slug: 'nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 1 };
const DATE = '2030-06-10';

function slot(slotId: string, startTime: string, endTime: string) {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber: 1, gameId: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true };
}

const NIMES_SLOTS = [slot('a1-2000', '20:00', '20:40'), slot('a1-2040', '20:40', '21:20'), slot('a1-2120', '21:20', '22:00'), slot('a1-2200', '22:00', '22:40')];
const OFFER = { date: DATE, venues: [{ venueId: NIMES.id, evaSlotIds: ['a1-2000', 'a1-2040'] }], slotCount: 2, matchCount: 1 };

beforeEach(async () => {
  sessions.mockReset();
  sessions.mockResolvedValue(NIMES_SLOTS);
  clearVenueSlotsCache();
  await prisma.venue.create({ data: NIMES });
});

// A member of the leader's team, given these matchmaking permissions by the leader, and nothing else
async function memberWith(leaderToken: string, teamId: string, matchmaking: Partial<MatchmakingPermissions>): Promise<string> {
  return (await createTeamMember(leaderToken, teamId, matchmaking)).token;
}

function open(token: string) {
  return request(app).post('/api/scrims/searches').set(authHeader(token)).send(OFFER);
}

function change(token: string, searchId: string) {
  return request(app)
    .put(`/api/scrims/searches/${searchId}`)
    .set(authHeader(token))
    .send({ venues: [{ venueId: NIMES.id, evaSlotIds: ['a1-2120', 'a1-2200'] }], slotCount: 2, matchCount: 1 });
}

function withdraw(token: string, searchId: string) {
  return request(app).delete(`/api/scrims/searches/${searchId}`).set(authHeader(token));
}

function propose(token: string, searchId: string) {
  return request(app).post(`/api/scrims/searches/${searchId}/proposals`).set(authHeader(token)).send({ evaSlotIds: ['a1-2000', 'a1-2040'] });
}

function respond(token: string, proposalId: string, answer: 'accept' | 'decline') {
  return request(app).put(`/api/scrims/proposals/${proposalId}/${answer}`).set(authHeader(token));
}

describe('Matchmaking permissions', () => {
  it('lets a member the leader allowed to search open, change and withdraw the team\'s searches, and nothing more', async () => {
    const { token: leader, team } = await createUserWithTeam();
    const searcher = await memberWith(leader, team.id, { canSearch: true });
    const other = await createUserWithTeam();
    const theirs = await open(other.token).expect(201);

    const opened = await open(searcher).expect(201);
    await change(searcher, opened.body.id).expect(200);
    expect((await propose(searcher, theirs.body.id)).status).toBe(403);
    await withdraw(searcher, opened.body.id).expect(204);
  });

  it('lets a member the leader allowed to propose answer other teams and take the proposal back, and nothing more', async () => {
    const { token: leader, team } = await createUserWithTeam();
    const proposer = await memberWith(leader, team.id, { canPropose: true });
    const other = await createUserWithTeam();
    const theirs = await open(other.token).expect(201);

    expect((await open(proposer)).status).toBe(403);
    const sent = await propose(proposer, theirs.body.id).expect(201);
    await request(app).delete(`/api/scrims/proposals/${sent.body.id}`).set(authHeader(proposer)).expect(204);
  });

  it('lets a member the leader allowed to respond accept and decline the proposals the team received, and nothing more', async () => {
    const { token: leader, team } = await createUserWithTeam();
    const responder = await memberWith(leader, team.id, { canRespond: true });
    const ours = await open(leader).expect(201);
    const first = await createUserWithTeam();
    const second = await createUserWithTeam();
    const declined = await propose(first.token, ours.body.id).expect(201);
    const accepted = await propose(second.token, ours.body.id).expect(201);

    expect((await withdraw(responder, ours.body.id)).status).toBe(403);
    await respond(responder, declined.body.id, 'decline').expect(200);
    await respond(responder, accepted.body.id, 'accept').expect(200);
    expect(await prisma.calendarEvent.count()).toBe(2);
  });

  it('refuses every matchmaking action to a member the leader gave none, events or not', async () => {
    const { token: leader, team } = await createUserWithTeam();
    const invite = await request(app).post(`/api/teams/${team.id}/invites`).set(authHeader(leader)).send({ expiresInHours: 24, maxUses: 1 }).expect(201);
    const { token: member, user } = await createAuthenticatedUser();
    await request(app).post(`/api/invites/${invite.body.code}/join`).set(authHeader(member)).expect(200);
    // Creating events is a calendar permission: it opens no search
    await request(app)
      .put(`/api/teams/current/members/${user.id}/permissions`)
      .set(authHeader(leader))
      .send({ permissions: { ...DEFAULT_PLAYER_PERMISSIONS, calendar: { ...DEFAULT_PLAYER_PERMISSIONS.calendar, canCreateEvents: true } } })
      .expect(200);
    const ours = await open(leader).expect(201);
    const other = await createUserWithTeam();
    const theirs = await open(other.token).expect(201);
    const received = await propose(other.token, ours.body.id).expect(201);

    expect((await open(member)).status).toBe(403);
    expect((await change(member, ours.body.id)).status).toBe(403);
    expect((await withdraw(member, ours.body.id)).status).toBe(403);
    expect((await propose(member, theirs.body.id)).status).toBe(403);
    expect((await respond(member, received.body.id, 'accept')).status).toBe(403);
    expect((await respond(member, received.body.id, 'decline')).status).toBe(403);

    // Reading the searches stays open to every member
    expect((await request(app).get('/api/scrims/searches').query({ month: '2030-06', venueIds: NIMES.id }).set(authHeader(member))).status).toBe(200);
  });

  it('keeps to the permissions the app knows when the leader saves them, and reads old ones as nothing granted', async () => {
    const { token: leader, team } = await createUserWithTeam();
    const member = await memberWith(leader, team.id, { canSearch: true });
    const player = await prisma.player.findFirstOrThrow({ where: { teamId: team.id, ledTeam: null } });
    expect(player.permissions).toMatchObject({ matchmaking: { canSearch: true, canPropose: false, canRespond: false } });

    // Saved before the matchmaking permissions existed
    await prisma.player.update({ where: { id: player.id }, data: { permissions: { calendar: { canCreateEvents: true } } } });
    expect((await open(member)).status).toBe(403);
    const members = await request(app).get('/api/teams/current/members').set(authHeader(leader)).expect(200);
    const listed = members.body.find((entry: { isLeader: boolean }) => !entry.isLeader);
    expect(listed.permissions.matchmaking).toEqual({ canSearch: false, canPropose: false, canRespond: false });
    expect(listed.permissions.calendar.canCreateEvents).toBe(true);
  });
});
