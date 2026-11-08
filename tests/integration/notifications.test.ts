// Integration tests - Notifications: what the matchmaking tells the teams, and
// the bell that keeps it for each player
//
// eva.gg is never called: the sessions lookup is mocked so searches can open.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedAdmin, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { NOTIFICATION_INBOX_SIZE, NOTIFICATION_RETENTION_DAYS } from '@shared/constants';
import type { InboxNotification, NotificationInbox } from '@shared/types';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';
import { upkeepScrimSearches } from '../../server/src/services/scrim-upkeep.service';
import { purgeOldNotifications } from '../../server/src/services/notification-inbox.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 2 };
const DATE = '2030-06-10';
const BEFORE_THE_DAY = new Date('2030-06-01T12:00:00Z');
const AFTER_THE_DAY = new Date('2030-06-12T12:00:00Z');

function slot(slotId: string, startTime: string, endTime: string, takenSeats = 0) {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber: 1, gameId: 1, takenSeats, totalSeats: 10, isCompetitiveAvailable: true };
}

// The evening on arena 1 of Nîmes, five slots: room for two matches of two slots
const EVENING = [
  slot('a1-1920', '19:20', '20:00'),
  slot('a1-2000', '20:00', '20:40'),
  slot('a1-2040', '20:40', '21:20'),
  slot('a1-2120', '21:20', '22:00'),
  slot('a1-2200', '22:00', '22:40'),
];
const RUN = ['a1-2000', 'a1-2040'];

// The evening with some slots booked by somebody at the venue
function served(...booked: string[]) {
  sessions.mockResolvedValue(EVENING.map(item => (booked.includes(item.slotId) ? { ...item, takenSeats: 2 } : item)));
  clearVenueSlotsCache();
}

beforeEach(async () => {
  sessions.mockReset();
  served();
  await prisma.venue.create({ data: NIMES });
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function open(token: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await request(app)
    .post('/api/scrims/searches')
    .set(auth(token))
    .send({ date: DATE, venues: [{ venueId: NIMES.id, evaSlotIds: EVENING.map(item => item.slotId) }], slotCount: 2, matchCount: 1, ...body })
    .expect(201);
  return res.body.id;
}

async function propose(token: string, searchId: string, evaSlotIds: string[] = RUN, message?: string): Promise<string> {
  const res = await request(app).post(`/api/scrims/searches/${searchId}/proposals`).set(auth(token)).send({ evaSlotIds, message }).expect(201);
  return res.body.id;
}

function accept(token: string, proposalId: string) {
  return request(app).put(`/api/scrims/proposals/${proposalId}/accept`).set(auth(token));
}

async function inbox(token: string): Promise<NotificationInbox> {
  return (await request(app).get('/api/notifications').set(auth(token)).expect(200)).body;
}

async function told(token: string): Promise<InboxNotification[]> {
  return (await inbox(token)).notifications;
}

async function kinds(token: string): Promise<string[]> {
  return (await told(token)).map(notification => notification.kind);
}

// A searching team of a leader, a member who may respond and a member who may not; a proposing team of a leader and a member
async function teams() {
  const searcher = await createUserWithTeam();
  const responder = await createTeamMember(searcher.token, searcher.team.id, { canRespond: true });
  const bystander = await createTeamMember(searcher.token, searcher.team.id);
  const proposer = await createUserWithTeam();
  const teammate = await createTeamMember(proposer.token, proposer.team.id);
  return { searcher, responder, bystander, proposer, teammate };
}

describe('Notifications of the matchmaking', () => {
  it('tells those who answer for the searching team of a proposal, with its message, and nobody else', async () => {
    const { searcher, responder, bystander, proposer, teammate } = await teams();
    const searchId = await open(searcher.token);

    await propose(proposer.token, searchId, RUN, 'On est chauds');

    const [notification] = await told(searcher.token);
    expect(notification).toMatchObject({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      isRead: false,
      data: {
        searchId, teamName: proposer.team.name, message: 'On est chauds',
        date: DATE, startTime: '20:00', endTime: '21:20', venueId: NIMES.id, venueName: 'Nîmes', arenaNumber: 1,
      },
    });
    expect(await kinds(responder.token)).toEqual(['SCRIM_PROPOSAL_RECEIVED']);
    expect(await kinds(bystander.token)).toEqual([]);
    expect(await kinds(proposer.token)).toEqual([]);
    expect(await kinds(teammate.token)).toEqual([]);
  });

  it('tells both teams of the match made, each of its own copy, except the player who accepted', async () => {
    const { searcher, responder, bystander, proposer, teammate } = await teams();
    const searchId = await open(searcher.token);
    const proposalId = await propose(proposer.token, searchId);

    await accept(responder.token, proposalId).expect(200);

    const copies = await prisma.calendarEvent.findMany({ where: { scrimSearchId: searchId } });
    const searcherCopy = copies.find(event => event.teamId === searcher.team.id)!;
    const proposerCopy = copies.find(event => event.teamId === proposer.team.id)!;
    const made = (notifications: InboxNotification[]) => notifications.filter(notification => notification.kind === 'SCRIM_MATCH_MADE');

    expect(made(await told(responder.token))).toEqual([]);
    for (const member of [searcher, bystander]) {
      expect(made(await told(member.token))).toMatchObject([{ data: { eventId: searcherCopy.id, opponentName: proposer.team.name } }]);
    }
    for (const member of [proposer, teammate]) {
      expect(made(await told(member.token))).toMatchObject([{ data: { eventId: proposerCopy.id, opponentName: searcher.team.name } }]);
    }
  });

  it('tells those who propose for a team that the other team said no', async () => {
    const { searcher, proposer, teammate } = await teams();
    const allowed = await createTeamMember(proposer.token, proposer.team.id, { canPropose: true });
    const searchId = await open(searcher.token);
    const proposalId = await propose(proposer.token, searchId);

    await request(app).put(`/api/scrims/proposals/${proposalId}/decline`).set(auth(searcher.token)).expect(200);

    for (const member of [proposer, allowed]) {
      expect(await told(member.token)).toMatchObject([
        { kind: 'SCRIM_PROPOSAL_DECLINED', data: { searchId, teamName: searcher.team.name, reason: 'byTeam', startTime: '20:00' } },
      ]);
    }
    expect(await kinds(teammate.token)).toEqual([]);
  });

  it('says why the proposals an acceptance turned down fell: the time taken, or the search closed', async () => {
    const searcher = await createUserWithTeam();
    const [first, overlapping, later] = [await createUserWithTeam(), await createUserWithTeam(), await createUserWithTeam()];
    const searchId = await open(searcher.token);
    const accepted = await propose(first.token, searchId, ['a1-2000', 'a1-2040']);
    await propose(overlapping.token, searchId, ['a1-1920', 'a1-2000']);
    await propose(later.token, searchId, ['a1-2120', 'a1-2200']);

    await accept(searcher.token, accepted).expect(200);

    expect(await told(overlapping.token)).toMatchObject([{ kind: 'SCRIM_PROPOSAL_DECLINED', data: { reason: 'timeTaken' } }]);
    expect(await told(later.token)).toMatchObject([{ kind: 'SCRIM_PROPOSAL_DECLINED', data: { reason: 'searchClosed' } }]);
  });

  it('says a proposal fell when a slot of its run was booked before the answer', async () => {
    const searcher = await createUserWithTeam();
    const proposer = await createUserWithTeam();
    const searchId = await open(searcher.token);
    const proposalId = await propose(proposer.token, searchId);
    served('a1-2040');

    expect((await accept(searcher.token, proposalId)).status).toBe(409);

    expect(await told(proposer.token)).toMatchObject([{ kind: 'SCRIM_PROPOSAL_DECLINED', data: { reason: 'runTaken' } }]);
  });

  it('says a proposal fell when the search changed and no longer holds its run', async () => {
    const searcher = await createUserWithTeam();
    const proposer = await createUserWithTeam();
    const searchId = await open(searcher.token);
    await propose(proposer.token, searchId);

    await request(app)
      .put(`/api/scrims/searches/${searchId}`)
      .set(auth(searcher.token))
      .send({ venues: [{ venueId: NIMES.id, evaSlotIds: ['a1-2120', 'a1-2200'] }], slotCount: 2, matchCount: 1 })
      .expect(200);

    expect(await told(proposer.token)).toMatchObject([{ kind: 'SCRIM_PROPOSAL_DECLINED', data: { reason: 'searchChanged' } }]);
  });

  it('tells the teams waiting on a search that it was withdrawn, whether it made a match or not', async () => {
    const searcher = await createUserWithTeam();
    const [waiting, made, stillWaiting] = [await createUserWithTeam(), await createUserWithTeam(), await createUserWithTeam()];

    // Withdrawn before any match: deleted
    const plain = await open(searcher.token);
    await propose(waiting.token, plain);
    await request(app).delete(`/api/scrims/searches/${plain}`).set(auth(searcher.token)).expect(204);
    expect(await told(waiting.token)).toMatchObject([
      { kind: 'SCRIM_SEARCH_WITHDRAWN', data: { teamName: searcher.team.name, date: DATE, startTime: '20:00', venueId: NIMES.id } },
    ]);

    // Withdrawn after a match: closed
    const matched = await open(searcher.token, { matchCount: 2 });
    await accept(searcher.token, await propose(made.token, matched, ['a1-1920', 'a1-2000'])).expect(200);
    await propose(stillWaiting.token, matched, ['a1-2040', 'a1-2120']);
    await request(app).delete(`/api/scrims/searches/${matched}`).set(auth(searcher.token)).expect(204);
    expect(await kinds(stillWaiting.token)).toEqual(['SCRIM_SEARCH_WITHDRAWN']);
    expect(await kinds(made.token)).toEqual(['SCRIM_MATCH_MADE']);
  });

  it('tells both teams a match was called off, and from which side, except the player who did it', async () => {
    const { searcher, bystander, proposer, teammate } = await teams();
    const searchId = await open(searcher.token);
    await accept(searcher.token, await propose(proposer.token, searchId)).expect(200);
    const proposerCopy = (await prisma.calendarEvent.findMany()).find(event => event.teamId === proposer.team.id)!;

    await request(app).delete(`/api/scrims/matches/${proposerCopy.id}`).set(auth(proposer.token)).expect(204);

    const cancelled = async (token: string) => (await told(token)).filter(notification => notification.kind === 'SCRIM_MATCH_CANCELLED');
    expect(await cancelled(proposer.token)).toEqual([]);
    expect(await cancelled(teammate.token)).toMatchObject([{ data: { opponentName: searcher.team.name, byOpponent: false } }]);
    for (const member of [searcher, bystander]) {
      expect(await cancelled(member.token)).toMatchObject([{ data: { opponentName: proposer.team.name, byOpponent: true, startTime: '20:00' } }]);
    }
  });

  it('tells the searching team its search closed with no match once its slots were booked, and why a proposal on them fell', async () => {
    const searcher = await createUserWithTeam();
    const searching = await createTeamMember(searcher.token, searcher.team.id, { canSearch: true });
    const bystander = await createTeamMember(searcher.token, searcher.team.id);
    const proposer = await createUserWithTeam();
    const searchId = await open(searcher.token, { venues: [{ venueId: NIMES.id, evaSlotIds: RUN }] });
    await propose(proposer.token, searchId);

    served('a1-2000');
    await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 });

    for (const member of [searcher, searching]) {
      expect((await told(member.token))[0]).toMatchObject({ kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId, date: DATE } });
    }
    expect(await kinds(bystander.token)).toEqual([]);
    expect(await told(proposer.token)).toMatchObject([{ kind: 'SCRIM_PROPOSAL_DECLINED', data: { reason: 'runTaken' } }]);
  });

  it('says nothing of a booking on the slots of a match made: its own players are taken to hold them', async () => {
    const searcher = await createUserWithTeam();
    const proposer = await createUserWithTeam();
    const searchId = await open(searcher.token, { matchCount: 2 });
    await accept(searcher.token, await propose(proposer.token, searchId)).expect(200);
    const before = await prisma.notification.count();

    served(...RUN);
    await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 });

    expect(await prisma.notification.count()).toBe(before);
  });

  it('says nothing when a proposal is taken back, nor when a search closes because its day passed', async () => {
    const searcher = await createUserWithTeam();
    const proposer = await createUserWithTeam();
    const other = await createUserWithTeam();
    const searchId = await open(searcher.token);
    const proposalId = await propose(proposer.token, searchId);
    await request(app).delete(`/api/scrims/proposals/${proposalId}`).set(auth(proposer.token)).expect(204);
    await propose(other.token, searchId);
    const before = await prisma.notification.count();

    await upkeepScrimSearches({ now: AFTER_THE_DAY, pauseMs: 0 });

    expect(await prisma.notification.count()).toBe(before);
    expect(await kinds(proposer.token)).toEqual([]);
    expect(await kinds(other.token)).toEqual([]);
  });
});

describe('GET /api/notifications', () => {
  it('lists the player\'s notifications newest first, with how many are unread, and none of another team\'s', async () => {
    const searcher = await createUserWithTeam();
    const [first, second] = [await createUserWithTeam(), await createUserWithTeam()];
    const outsider = await createUserWithTeam();
    const searchId = await open(searcher.token, { matchCount: 2 });
    await propose(first.token, searchId, ['a1-1920', 'a1-2000']);
    await propose(second.token, searchId, ['a1-2040', 'a1-2120']);

    const listed = await inbox(searcher.token);
    expect(listed.unreadCount).toBe(2);
    expect(listed.notifications.map(notification => notification.data)).toMatchObject([{ teamName: second.team.name }, { teamName: first.team.name }]);
    expect((await request(app).get('/api/notifications/unread-count').set(auth(searcher.token)).expect(200)).body).toEqual({ unreadCount: 2 });
    expect(await inbox(outsider.token)).toEqual({ notifications: [], unreadCount: 0 });
  });

  it('lists the latest only, and counts every unread one', async () => {
    const { user, token, team } = await createUserWithTeam();
    const playerId = user.playerId;
    // More notifications than the bell lists: written directly, the API has no way to make that many
    for (let index = 0; index <= NOTIFICATION_INBOX_SIZE; index += 1) {
      await prisma.notification.create({
        data: {
          kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: `search-${index}`, date: DATE }, teamId: team.id,
          createdAt: new Date(Date.UTC(2030, 0, 1, 0, index)),
          inboxEntries: { create: { playerId: playerId! } },
        },
      });
    }

    const listed = await inbox(token);

    expect(listed.notifications).toHaveLength(NOTIFICATION_INBOX_SIZE);
    expect(listed.notifications[0]!.data).toEqual({ searchId: `search-${NOTIFICATION_INBOX_SIZE}`, date: DATE });
    expect(listed.unreadCount).toBe(NOTIFICATION_INBOX_SIZE + 1);
  });

  it('refuses an account that is not a player, and a request without a token', async () => {
    const admin = await createAuthenticatedAdmin();

    const res = await request(app).get('/api/notifications').set(auth(admin.token));

    expect(res.status).toBe(403);
    expect(res.body.errors).toContain(ERROR.playerAccountRequired);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).get('/api/notifications/unread-count')).status).toBe(401);
  });
});

describe('PUT /api/notifications/read', () => {
  it('marks the notifications the bell showed as seen, and only the player\'s own', async () => {
    const searcher = await createUserWithTeam();
    const responder = await createTeamMember(searcher.token, searcher.team.id, { canRespond: true });
    const [first, second] = [await createUserWithTeam(), await createUserWithTeam()];
    const searchId = await open(searcher.token, { matchCount: 2 });
    await propose(first.token, searchId, ['a1-1920', 'a1-2000']);
    await propose(second.token, searchId, ['a1-2040', 'a1-2120']);
    const [newest, oldest] = await told(searcher.token);

    await request(app).put('/api/notifications/read').set(auth(searcher.token)).send({ ids: [oldest!.id] }).expect(204);

    const after = await inbox(searcher.token);
    expect(after.unreadCount).toBe(1);
    expect(after.notifications.map(notification => [notification.id, notification.isRead])).toEqual([[newest!.id, false], [oldest!.id, true]]);
    // The same notification stays unread in a teammate's bell
    expect((await inbox(responder.token)).unreadCount).toBe(2);
  });

  it('refuses a list that is not one', async () => {
    const { token } = await createUserWithTeam();

    for (const body of [{}, { ids: 'notification-1' }, { ids: [42] }, { ids: [''] }, { ids: Array.from({ length: NOTIFICATION_INBOX_SIZE + 1 }, (_, index) => `n-${index}`) }]) {
      const res = await request(app).put('/api/notifications/read').set(auth(token)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.notificationsReadInvalid);
    }
  });
});

describe('Notifications past their retention', () => {
  it('are deleted with their inbox entries, the recent ones kept', async () => {
    const searcher = await createUserWithTeam();
    const proposer = await createUserWithTeam();
    await propose(proposer.token, await open(searcher.token));
    const kept = await prisma.notification.findFirstOrThrow();
    // Old enough to go: written directly, a notification is never dated in the past through the API
    const old = await prisma.notification.create({
      data: {
        kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: 'search-old', date: DATE }, teamId: searcher.team.id,
        createdAt: new Date(Date.now() - (NOTIFICATION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000),
        inboxEntries: { create: { playerId: (await prisma.notificationInboxEntry.findFirstOrThrow()).playerId } },
      },
    });

    expect(await purgeOldNotifications()).toBe(1);

    expect(await prisma.notification.findMany({ select: { id: true } })).toEqual([{ id: kept.id }]);
    expect(await prisma.notificationInboxEntry.count({ where: { notificationId: old.id } })).toBe(0);
  });
});
