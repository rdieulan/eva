// Integration tests - Scrim proposals (a team answers a search; accepting makes the match)
//
// eva.gg is never called: the sessions lookup is mocked so searches can open.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH } from '@shared/constants/validation.constants';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', slug: 'nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 2 };
const MONTPELLIER = { id: 'venue-montpellier', slug: 'montpellier', name: 'Montpellier', city: 'Montpellier', address: '3 rue', externalId: 52, arenaCount: 1 };
const DATE = '2030-06-10';
const MONTH = '2030-06';

function slot(slotId: string, startTime: string, endTime: string, arenaNumber = 1) {
  return { slotId, startTime, endTime, convocationTime: startTime === '20:00' ? '19:50' : startTime, arenaNumber, gameId: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true };
}

// The searching team offers the whole evening on arena 1 of Nîmes, plus arena 2 from 20:00
const NIMES_SLOTS = [
  slot('a1-1920', '19:20', '20:00'),
  slot('a1-2000', '20:00', '20:40'),
  slot('a1-2040', '20:40', '21:20'),
  slot('a1-2120', '21:20', '22:00'),
  slot('a2-2000', '20:00', '20:40', 2),
  slot('a2-2040', '20:40', '21:20', 2),
];
const MONTPELLIER_SLOTS = [
  slot('m1-2000', '20:00', '20:40'),
  slot('m1-2040', '20:40', '21:20'),
];
const OFFERED = ['a1-1920', 'a1-2000', 'a1-2040', 'a1-2120', 'a2-2000', 'a2-2040'];
const RUN = ['a1-2000', 'a1-2040'];

const atNimes = (...evaSlotIds: string[]) => ({ venueId: NIMES.id, evaSlotIds });
const atMontpellier = (...evaSlotIds: string[]) => ({ venueId: MONTPELLIER.id, evaSlotIds });

beforeEach(async () => {
  sessions.mockReset();
  sessions.mockImplementation(async externalId => (externalId === MONTPELLIER.externalId ? MONTPELLIER_SLOTS : NIMES_SLOTS));
  clearVenueSlotsCache();
  await prisma.venue.createMany({ data: [NIMES, MONTPELLIER] });
});

async function openSearch(token: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await request(app)
    .post('/api/scrims/searches')
    .set('Authorization', `Bearer ${token}`)
    .send({ date: DATE, venues: [atNimes(...OFFERED)], slotCount: 2, matchCount: 1, ...body })
    .expect(201);
  return res.body.id;
}

function propose(token: string, searchId: string, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/scrims/searches/${searchId}/proposals`)
    .set('Authorization', `Bearer ${token}`)
    .send({ evaSlotIds: RUN, ...body });
}

function listAtVenue(token: string) {
  return request(app)
    .get('/api/scrims/searches')
    .query({ month: MONTH, venueIds: NIMES.id })
    .set('Authorization', `Bearer ${token}`);
}

async function setup(searchBody: Record<string, unknown> = {}) {
  const searcher = await createUserWithTeam();
  const proposer = await createUserWithTeam();
  const searchId = await openSearch(searcher.token, searchBody);
  return { searcher, proposer, searchId };
}

function accept(token: string, proposalId: string) {
  return request(app).put(`/api/scrims/proposals/${proposalId}/accept`).set('Authorization', `Bearer ${token}`);
}

async function statusOf(proposalId: string) {
  return (await prisma.scrimProposal.findUnique({ where: { id: proposalId } }))!.status;
}

// Where a proposal stands, and why when it was declined
async function outcomeOf(proposalId: string) {
  const { status, declineReason } = await prisma.scrimProposal.findUniqueOrThrow({ where: { id: proposalId } });
  return { status, declineReason };
}

describe('POST /api/scrims/searches/:id/proposals', () => {
  it('should send a proposal naming its run and its venue, with a trimmed message', async () => {
    const { proposer, searchId } = await setup();

    const res = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2040', 'a1-2000'], message: '  On est chauds  ' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      searchId,
      team: { id: proposer.team.id, name: proposer.team.name },
      message: 'On est chauds',
      status: 'PENDING',
      venueId: NIMES.id,
      evaSlotIds: ['a1-2000', 'a1-2040'],
      arenaNumber: 1,
      startTime: '20:00',
      endTime: '21:20',
      convocationTime: '19:50',
      isMine: true,
    });
  });

  it('should propose a run in any venue of the search, reading that venue on eva.gg', async () => {
    const { proposer, searchId } = await setup({ venues: [atNimes(...OFFERED), atMontpellier('m1-2000', 'm1-2040')] });
    // Opening the search filled the cache: start from a cold one to see which venue is read
    clearVenueSlotsCache();
    sessions.mockClear();

    const res = await propose(proposer.token, searchId, { evaSlotIds: ['m1-2000', 'm1-2040'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ venueId: MONTPELLIER.id, evaSlotIds: ['m1-2000', 'm1-2040'], startTime: '20:00', endTime: '21:20' });
    expect(sessions).toHaveBeenCalledWith(MONTPELLIER.externalId, DATE);
  });

  it('should refuse a run with a slot the search does not offer', async () => {
    const { proposer, searchId } = await setup();

    const res = await propose(proposer.token, searchId, { evaSlotIds: ['a1-1840', 'a1-1920'] });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimProposalSlotsNotOffered);
  });

  it('should refuse a run that does not hold together', async () => {
    const { proposer, searchId } = await setup({ venues: [atNimes(...OFFERED), atMontpellier('m1-2000', 'm1-2040')] });

    const gap = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000', 'a1-2120'] });
    expect(gap.status).toBe(400);
    expect(gap.body.errors).toContain(ERROR.scrimSlotsNotConsecutive);

    const twoArenas = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000', 'a2-2040'] });
    expect(twoArenas.status).toBe(400);
    expect(twoArenas.body.errors).toContain(ERROR.scrimSlotsNotConsecutive);

    const twoVenues = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000', 'm1-2040'] });
    expect(twoVenues.status).toBe(400);
    expect(twoVenues.body.errors).toContain(ERROR.scrimSlotsNotConsecutive);

    const none = await propose(proposer.token, searchId, { evaSlotIds: [] });
    expect(none.status).toBe(400);
    expect(none.body.errors).toContain(ERROR.evaSlotsInvalid);
  });

  it('should refuse a run of another length than the search asks for', async () => {
    const { proposer, searchId } = await setup();

    const short = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000'] });
    expect(short.status).toBe(400);
    expect(short.body.errors).toContain(ERROR.scrimProposalRunLength);

    const long = await propose(proposer.token, searchId, { evaSlotIds: ['a1-1920', 'a1-2000', 'a1-2040'] });
    expect(long.status).toBe(400);
    expect(long.body.errors).toContain(ERROR.scrimProposalRunLength);
  });

  it('should accept a proposal without a message', async () => {
    const { proposer, searchId } = await setup();

    const res = await propose(proposer.token, searchId);

    expect(res.status).toBe(201);
    expect(res.body.message).toBeNull();
  });

  it('should show the proposals to the searching team, and only its own to another team', async () => {
    const { searcher, proposer, searchId } = await setup();
    const third = await createUserWithTeam();
    await propose(proposer.token, searchId).expect(201);
    await propose(third.token, searchId).expect(201);
    const bystander = await createUserWithTeam();

    const asSearcher = await listAtVenue(searcher.token);
    expect(asSearcher.body[0].proposals).toHaveLength(2);
    expect(asSearcher.body[0].proposals.map((p: { isMine: boolean }) => p.isMine)).toEqual([false, false]);

    const asProposer = await listAtVenue(proposer.token);
    expect(asProposer.body[0].proposals).toHaveLength(1);
    expect(asProposer.body[0].proposals[0]).toMatchObject({ team: { id: proposer.team.id }, isMine: true });

    const asBystander = await listAtVenue(bystander.token);
    expect(asBystander.body[0].proposals).toEqual([]);
  });

  it('should refuse answering the team\'s own search', async () => {
    const { searcher, searchId } = await setup();

    const res = await propose(searcher.token, searchId);

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimProposalOwnSearch);
  });

  it('should refuse a second pending proposal from the same team', async () => {
    const { proposer, searchId } = await setup();
    await propose(proposer.token, searchId).expect(201);

    const res = await propose(proposer.token, searchId);

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimProposalAlreadySent);
  });

  it('should let a team propose again after taking a proposal back', async () => {
    const { proposer, searchId } = await setup();
    const first = await propose(proposer.token, searchId).expect(201);
    await request(app).delete(`/api/scrims/proposals/${first.body.id}`).set('Authorization', `Bearer ${proposer.token}`).expect(204);

    const res = await propose(proposer.token, searchId);

    expect(res.status).toBe(201);
  });

  it('should refuse a search that already found an opponent', async () => {
    const { searcher, proposer, searchId } = await setup();
    const third = await createUserWithTeam();
    const first = await propose(proposer.token, searchId).expect(201);
    await accept(searcher.token, first.body.id).expect(200);

    const res = await propose(third.token, searchId);

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchNotOpen);
  });

  it('should refuse a run at the time of a match the search already made, on any arena or venue', async () => {
    const { searcher, proposer, searchId } = await setup({ venues: [atNimes(...OFFERED), atMontpellier('m1-2000', 'm1-2040')], matchCount: 2 });
    const third = await createUserWithTeam();
    // 19:20 to 20:40: the evening after it still holds a match, so the search stays open
    const first = await propose(proposer.token, searchId, { evaSlotIds: ['a1-1920', 'a1-2000'] }).expect(201);
    await accept(searcher.token, first.body.id).expect(200);

    for (const evaSlotIds of [['a1-2000', 'a1-2040'], ['a2-2000', 'a2-2040'], ['m1-2000', 'm1-2040']]) {
      const res = await propose(third.token, searchId, { evaSlotIds });
      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.scrimProposalTimeTaken);
    }
  });

  it('should let the team of the first match propose the next one', async () => {
    const { searcher, proposer, searchId } = await setup({ matchCount: 2 });
    const first = await propose(proposer.token, searchId, { evaSlotIds: ['a1-1920', 'a1-2000'] }).expect(201);
    await accept(searcher.token, first.body.id).expect(200);

    const next = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2040', 'a1-2120'] });
    expect(next.status).toBe(201);
    await accept(searcher.token, next.body.id).expect(200);

    const search = await prisma.scrimSearch.findUnique({ where: { id: searchId } });
    expect(search!.status).toBe('MATCHED');
    const events = await prisma.calendarEvent.findMany({ where: { scrimSearchId: searchId, teamId: proposer.team.id }, orderBy: { startTime: 'asc' } });
    expect(events.map(event => [event.startTime, event.endTime])).toEqual([['19:20', '20:40'], ['20:40', '22:00']]);
  });

  it('should refuse a message that runs too long, and answer 404 for an unknown search', async () => {
    const { proposer, searchId } = await setup();

    const tooLong = await propose(proposer.token, searchId, { message: 'x'.repeat(SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH + 1) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.errors).toContain(ERROR.scrimProposalMessageTooLong);

    const unknown = await propose(proposer.token, 'no-such-search');
    expect(unknown.status).toBe(404);
  });

  it('should refuse a run booked by someone at the venue since the search opened', async () => {
    const { proposer, searchId } = await setup();
    sessions.mockImplementation(async () => NIMES_SLOTS.map(item => (item.slotId === 'a1-2040' ? { ...item, takenSeats: 2 } : item)));
    clearVenueSlotsCache();

    const res = await propose(proposer.token, searchId);

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimProposalRunTaken);
    expect(await prisma.scrimProposal.count()).toBe(0);
  });

  it('should refuse a player without a team', async () => {
    const { searchId } = await setup();
    const loner = await createAuthenticatedUser();

    expect((await propose(loner.token, searchId)).status).toBe(403);
    expect((await request(app).post(`/api/scrims/searches/${searchId}/proposals`).send({})).status).toBe(401);
  });
});

describe('PUT /api/scrims/proposals/:id/accept', () => {
  it('should match the search and put the match in both calendars', async () => {
    const { searcher, proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);

    const res = await accept(searcher.token, proposal.body.id);

    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('ACCEPTED');
    expect(res.body.events).toHaveLength(2);

    const search = await prisma.scrimSearch.findUnique({ where: { id: searchId } });
    expect(search!.status).toBe('MATCHED');

    const events = await prisma.calendarEvent.findMany({ where: { scrimSearchId: searchId }, orderBy: { title: 'asc' } });
    expect(events).toHaveLength(2);
    const ours = events.find(event => event.teamId === searcher.team.id)!;
    const theirs = events.find(event => event.teamId === proposer.team.id)!;
    // The match takes the run the proposal named, not the whole offer
    expect(ours).toMatchObject({
      type: 'MATCH',
      title: `Scrim vs ${proposer.team.name}`,
      startTime: '20:00',
      endTime: '21:20',
      venueId: NIMES.id,
      arenaNumber: 1,
      evaSlotIds: RUN,
      createdById: searcher.user.playerId,
    });
    expect(theirs).toMatchObject({
      title: `Scrim vs ${searcher.team.name}`,
      venueId: NIMES.id,
      evaSlotIds: RUN,
      createdById: proposer.user.playerId,
    });

    // Each team sees its match in its own calendar
    const calendar = await request(app)
      .get(`/api/calendar/events?month=${MONTH}`)
      .set('Authorization', `Bearer ${proposer.token}`);
    expect(calendar.body).toHaveLength(1);
    expect(calendar.body[0]).toMatchObject({ title: `Scrim vs ${searcher.team.name}`, venue: { id: NIMES.id }, arenaNumber: 1 });

    // The search is no longer on the venue board
    expect((await listAtVenue(searcher.token)).body).toEqual([]);
  });

  it('should play the match in the venue of the run the proposal named', async () => {
    const { searcher, proposer, searchId } = await setup({ venues: [atNimes(...OFFERED), atMontpellier('m1-2000', 'm1-2040')] });
    const proposal = await propose(proposer.token, searchId, { evaSlotIds: ['m1-2000', 'm1-2040'] }).expect(201);

    await accept(searcher.token, proposal.body.id).expect(200);

    const events = await prisma.calendarEvent.findMany({ where: { scrimSearchId: searchId } });
    expect(events).toHaveLength(2);
    expect(events.every(event => event.venueId === MONTPELLIER.id && event.arenaNumber === 1)).toBe(true);
  });

  it('should decline the other pending proposals', async () => {
    const { searcher, proposer, searchId } = await setup();
    const third = await createUserWithTeam();
    const first = await propose(proposer.token, searchId).expect(201);
    const second = await propose(third.token, searchId).expect(201);

    await accept(searcher.token, first.body.id).expect(200);

    const other = await prisma.scrimProposal.findUnique({ where: { id: second.body.id } });
    expect(other).toMatchObject({ status: 'DECLINED', declineReason: 'TIME_TAKEN' });
    expect(other!.respondedAt).not.toBeNull();
  });

  it('should keep a search for two matches open after the first, declining the proposals at the same time wherever they are', async () => {
    const { searcher, proposer, searchId } = await setup({ venues: [atNimes(...OFFERED), atMontpellier('m1-2000', 'm1-2040')], matchCount: 2 });
    const sameSlots = await createUserWithTeam();
    const otherArena = await createUserWithTeam();
    const otherVenue = await createUserWithTeam();
    const later = await createUserWithTeam();
    // 19:20 to 20:40 in Nîmes
    const first = await propose(proposer.token, searchId, { evaSlotIds: ['a1-1920', 'a1-2000'] }).expect(201);
    const overlapping = await propose(sameSlots.token, searchId, { evaSlotIds: ['a1-2000', 'a1-2040'] }).expect(201);
    const sideBySide = await propose(otherArena.token, searchId, { evaSlotIds: ['a2-2000', 'a2-2040'] }).expect(201);
    const elsewhere = await propose(otherVenue.token, searchId, { evaSlotIds: ['m1-2000', 'm1-2040'] }).expect(201);
    const rightAfter = await propose(later.token, searchId, { evaSlotIds: ['a1-2040', 'a1-2120'] }).expect(201);

    const res = await accept(searcher.token, first.body.id);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect((await prisma.scrimSearch.findUnique({ where: { id: searchId } }))!.status).toBe('OPEN');
    for (const declined of [overlapping, sideBySide, elsewhere]) {
      expect(await outcomeOf(declined.body.id)).toEqual({ status: 'DECLINED', declineReason: 'TIME_TAKEN' });
    }
    // Starting when the match ends, it can still be played
    expect(await outcomeOf(rightAfter.body.id)).toEqual({ status: 'PENDING', declineReason: null });

    // Still on the venue board, with the match it already has and every slot at its time
    const board = await listAtVenue(later.token);
    expect(board.body).toHaveLength(1);
    expect(board.body[0]).toMatchObject({ matchCount: 2, matchedCount: 1 });
    expect([...board.body[0].takenSlotIds].sort()).toEqual(['a1-1920', 'a1-2000', 'a2-2000', 'm1-2000']);
  });

  it('should close the search with its last match, declining what is left', async () => {
    const { searcher, proposer, searchId } = await setup({ matchCount: 2 });
    const third = await createUserWithTeam();
    const fourth = await createUserWithTeam();
    const first = await propose(proposer.token, searchId, { evaSlotIds: ['a1-1920', 'a1-2000'] }).expect(201);
    await accept(searcher.token, first.body.id).expect(200);
    const last = await propose(third.token, searchId, { evaSlotIds: ['a1-2040', 'a1-2120'] }).expect(201);
    const late = await propose(fourth.token, searchId, { evaSlotIds: ['a1-2040', 'a1-2120'] }).expect(201);

    await accept(searcher.token, last.body.id).expect(200);

    expect((await prisma.scrimSearch.findUnique({ where: { id: searchId } }))!.status).toBe('MATCHED');
    expect(await outcomeOf(late.body.id)).toEqual({ status: 'DECLINED', declineReason: 'TIME_TAKEN' });
    expect(await prisma.calendarEvent.count({ where: { scrimSearchId: searchId } })).toBe(4);
    expect((await listAtVenue(searcher.token)).body).toEqual([]);
  });

  it('should say a proposal at another time was left out because the search found all its matches', async () => {
    const { searcher, proposer, searchId } = await setup({ slotCount: 1 });
    const other = await createUserWithTeam();
    const first = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000'] }).expect(201);
    const later = await propose(other.token, searchId, { evaSlotIds: ['a1-2120'] }).expect(201);

    await accept(searcher.token, first.body.id).expect(200);

    expect((await prisma.scrimSearch.findUnique({ where: { id: searchId } }))!.status).toBe('MATCHED');
    expect(await outcomeOf(later.body.id)).toEqual({ status: 'DECLINED', declineReason: 'SEARCH_FILLED' });
  });

  it('should close the search early when its remaining slots no longer hold a match', async () => {
    const { searcher, proposer, searchId } = await setup({ matchCount: 2 });
    const third = await createUserWithTeam();
    // Right in the middle of the evening: what is left before and after is too short, and arena 2 is at the same time
    const middle = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000', 'a1-2040'] }).expect(201);
    const other = await propose(third.token, searchId, { evaSlotIds: ['a1-2040', 'a1-2120'] }).expect(201);

    await accept(searcher.token, middle.body.id).expect(200);

    expect((await prisma.scrimSearch.findUnique({ where: { id: searchId } }))!.status).toBe('MATCHED');
    expect(await outcomeOf(other.body.id)).toEqual({ status: 'DECLINED', declineReason: 'TIME_TAKEN' });
  });

  it('should refuse a proposal whose time another match took meanwhile', async () => {
    const { searcher, proposer, searchId } = await setup({ matchCount: 2 });
    const third = await createUserWithTeam();
    const first = await propose(proposer.token, searchId, { evaSlotIds: ['a1-2000', 'a1-2040'] }).expect(201);
    const second = await propose(third.token, searchId, { evaSlotIds: ['a2-2000', 'a2-2040'] }).expect(201);
    // Taken by another answer while this one waited
    await prisma.scrimProposal.update({ where: { id: first.body.id }, data: { status: 'ACCEPTED' } });

    const res = await accept(searcher.token, second.body.id);

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimProposalTimeTaken);
    expect(await statusOf(second.body.id)).toBe('PENDING');
  });

  it('should decline a proposal whose run was booked meanwhile, and make no match', async () => {
    const { searcher, proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);
    sessions.mockImplementation(async () => NIMES_SLOTS.map(item => (item.slotId === 'a1-2000' ? { ...item, takenSeats: 4 } : item)));
    clearVenueSlotsCache();

    const res = await accept(searcher.token, proposal.body.id);

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimProposalRunTaken);
    expect(await outcomeOf(proposal.body.id)).toEqual({ status: 'DECLINED', declineReason: 'RUN_TAKEN' });
    expect(await prisma.calendarEvent.count()).toBe(0);
    expect((await prisma.scrimSearch.findUniqueOrThrow({ where: { id: searchId } })).status).toBe('OPEN');
  });

  it('should only let the searching team answer', async () => {
    const { proposer, searchId } = await setup();
    const third = await createUserWithTeam();
    const proposal = await propose(proposer.token, searchId).expect(201);

    for (const token of [proposer.token, third.token]) {
      const res = await accept(token, proposal.body.id);
      expect(res.status).toBe(403);
    }
    expect(await prisma.calendarEvent.count()).toBe(0);
  });

  it('should refuse a proposal already answered, and answer 404 for an unknown one', async () => {
    const { searcher, proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);
    await request(app).put(`/api/scrims/proposals/${proposal.body.id}/decline`).set('Authorization', `Bearer ${searcher.token}`).expect(200);

    const again = await accept(searcher.token, proposal.body.id);
    expect(again.status).toBe(409);
    expect(again.body.errors).toContain(ERROR.scrimProposalNotPending);

    const unknown = await accept(searcher.token, 'nope');
    expect(unknown.status).toBe(404);
  });
});

describe('PUT /api/scrims/proposals/:id/decline', () => {
  it('should turn the proposal down and keep the search open', async () => {
    const { searcher, proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);

    const res = await request(app)
      .put(`/api/scrims/proposals/${proposal.body.id}/decline`)
      .set('Authorization', `Bearer ${searcher.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'DECLINED', declineReason: 'BY_TEAM' });
    expect((await prisma.scrimSearch.findUnique({ where: { id: searchId } }))!.status).toBe('OPEN');
    expect(await prisma.calendarEvent.count()).toBe(0);

    // The searching team no longer sees it; the proposer sees what became of it, and why
    expect((await listAtVenue(searcher.token)).body[0].proposals).toEqual([]);
    expect((await listAtVenue(proposer.token)).body[0].proposals[0]).toMatchObject({ status: 'DECLINED', declineReason: 'BY_TEAM' });
  });

  it('should keep a reason with a declined proposal and with no other: the database refuses anything else', async () => {
    const { proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);

    expect(await outcomeOf(proposal.body.id)).toEqual({ status: 'PENDING', declineReason: null });
    await expect(prisma.scrimProposal.update({ where: { id: proposal.body.id }, data: { status: 'DECLINED' } })).rejects.toThrow();
    await expect(prisma.scrimProposal.update({ where: { id: proposal.body.id }, data: { declineReason: 'BY_TEAM' } })).rejects.toThrow();
    expect(await outcomeOf(proposal.body.id)).toEqual({ status: 'PENDING', declineReason: null });
  });

  it('should only let the searching team decline', async () => {
    const { proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);

    const res = await request(app).put(`/api/scrims/proposals/${proposal.body.id}/decline`).set('Authorization', `Bearer ${proposer.token}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/scrims/proposals/:id', () => {
  it('should take back a pending proposal of the team', async () => {
    const { searcher, proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);

    const res = await request(app).delete(`/api/scrims/proposals/${proposal.body.id}`).set('Authorization', `Bearer ${proposer.token}`);

    expect(res.status).toBe(204);
    expect(await statusOf(proposal.body.id)).toBe('WITHDRAWN');
    expect((await listAtVenue(searcher.token)).body[0].proposals).toEqual([]);
  });

  it('should refuse another team, and a proposal already answered', async () => {
    const { searcher, proposer, searchId } = await setup();
    const proposal = await propose(proposer.token, searchId).expect(201);

    expect((await request(app).delete(`/api/scrims/proposals/${proposal.body.id}`).set('Authorization', `Bearer ${searcher.token}`)).status).toBe(403);

    await accept(searcher.token, proposal.body.id).expect(200);
    const late = await request(app).delete(`/api/scrims/proposals/${proposal.body.id}`).set('Authorization', `Bearer ${proposer.token}`);
    expect(late.status).toBe(409);
  });

  it('should go away with the search it answered', async () => {
    const { searcher, proposer, searchId } = await setup();
    await propose(proposer.token, searchId).expect(201);

    await request(app).delete(`/api/scrims/searches/${searchId}`).set('Authorization', `Bearer ${searcher.token}`).expect(204);

    expect(await prisma.scrimProposal.count()).toBe(0);
  });
});

describe('DELETE /api/scrims/matches/:eventId', () => {
  // A match made on the run, and the copy each team holds
  async function made(searchBody: Record<string, unknown> = {}, run: string[] = RUN) {
    const context = await setup(searchBody);
    const proposal = await propose(context.proposer.token, context.searchId, { evaSlotIds: run }).expect(201);
    const accepted = await accept(context.searcher.token, proposal.body.id).expect(200);
    const events = accepted.body.events as { id: string; title: string }[];
    return { ...context, proposalId: proposal.body.id, events };
  }

  function cancel(token: string, eventId: string) {
    return request(app).delete(`/api/scrims/matches/${eventId}`).set('Authorization', `Bearer ${token}`);
  }

  it('should call the match off from either team: both calendars lose it, and its proposal says so', async () => {
    const { proposer, proposalId, events } = await made();
    const proposerCopy = events.find(event => event.title.startsWith('Scrim vs '))!;
    const theirs = await prisma.calendarEvent.findMany({ where: { scrimSearchId: { not: null } } });
    expect(theirs).toHaveLength(2);

    const copy = theirs.find(event => event.teamId === proposer.team.id)!;
    await cancel(proposer.token, copy.id).expect(204);

    expect(proposerCopy).toBeDefined();
    expect(await prisma.calendarEvent.count()).toBe(0);
    expect(await statusOf(proposalId)).toBe('CANCELLED');
  });

  it('should give a search still open the time of the match back for another one', async () => {
    // 19:20 to 20:40 leaves 20:40 to 22:00 for a second match: the search stays open
    const { searcher, searchId } = await made({ matchCount: 2 }, ['a1-1920', 'a1-2000']);
    const searcherCopy = (await prisma.calendarEvent.findMany()).find(event => event.teamId === searcher.team.id)!;

    await cancel(searcher.token, searcherCopy.id).expect(204);

    const listed = await listAtVenue(searcher.token).expect(200);
    expect(listed.body[0]).toMatchObject({ id: searchId, matchedCount: 0, takenSlotIds: [], status: 'OPEN' });
    const another = await createUserWithTeam();
    const again = await propose(another.token, searchId, { evaSlotIds: ['a1-1920', 'a1-2000'] }).expect(201);
    await accept(searcher.token, again.body.id).expect(200);
  });

  it('should keep a closed search closed', async () => {
    const { searcher, searchId } = await made();
    const searcherCopy = (await prisma.calendarEvent.findMany()).find(event => event.teamId === searcher.team.id)!;

    await cancel(searcher.token, searcherCopy.id).expect(204);

    expect((await prisma.scrimSearch.findUniqueOrThrow({ where: { id: searchId } })).status).toBe('MATCHED');
  });

  it('should keep the match a withdrawn search made, still to be called off from either side', async () => {
    // 19:20 to 20:40 leaves 20:40 to 22:00 for a second match: the search stays open
    const { searcher, proposer, searchId } = await made({ matchCount: 2 }, ['a1-1920', 'a1-2000']);
    const waiting = await propose((await createUserWithTeam()).token, searchId, { evaSlotIds: ['a1-2040', 'a1-2120'] }).expect(201);

    await request(app).delete(`/api/scrims/searches/${searchId}`).set('Authorization', `Bearer ${searcher.token}`).expect(204);

    // Out of the market, its pending proposal fallen, its match still tied to it
    expect((await prisma.scrimSearch.findUniqueOrThrow({ where: { id: searchId } })).status).toBe('MATCHED');
    expect(await outcomeOf(waiting.body.id)).toEqual({ status: 'DECLINED', declineReason: 'SEARCH_WITHDRAWN' });
    expect((await listAtVenue(searcher.token).expect(200)).body).toHaveLength(0);
    const copies = await prisma.calendarEvent.findMany({ where: { scrimSearchId: searchId } });
    expect(copies).toHaveLength(2);

    const proposerCopy = copies.find(event => event.teamId === proposer.team.id)!;
    await cancel(proposer.token, proposerCopy.id).expect(204);
    expect(await prisma.calendarEvent.count()).toBe(0);
  });

  it('should leave a match whose day has passed in both calendars', async () => {
    const { searcher, proposalId } = await made();
    // The day went by since the match was made
    await prisma.calendarEvent.updateMany({ data: { date: new Date('2020-01-01') } });
    const searcherCopy = (await prisma.calendarEvent.findMany()).find(event => event.teamId === searcher.team.id)!;

    const refused = await cancel(searcher.token, searcherCopy.id);

    expect(refused.status).toBe(400);
    expect(refused.body.errors).toContain(ERROR.scrimMatchPast);
    expect(await prisma.calendarEvent.count()).toBe(2);
    expect(await statusOf(proposalId)).toBe('ACCEPTED');
  });

  it('should refuse another team\'s copy, an event the matchmaking did not make, and a player without a team', async () => {
    const { searcher } = await made();
    const outsider = await createUserWithTeam();
    const copy = (await prisma.calendarEvent.findMany()).find(event => event.teamId === searcher.team.id)!;
    expect((await cancel(outsider.token, copy.id)).status).toBe(403);

    const plain = await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${searcher.token}`)
      .send({ date: DATE, startTime: '14:00', endTime: '15:00', type: 'EVENT', title: 'Réunion' })
      .expect(201);
    expect((await cancel(searcher.token, plain.body.id)).status).toBe(404);
    expect((await cancel(searcher.token, 'no-such-event')).status).toBe(404);

    const loner = await createAuthenticatedUser();
    expect((await cancel(loner.token, copy.id)).status).toBe(403);
    expect(await prisma.calendarEvent.count({ where: { scrimSearchId: { not: null } } })).toBe(2);
  });

  it('should leave a match of the matchmaking to its calling off, and keep its time and place; its title may change', async () => {
    const { searcher } = await made();
    const copy = (await prisma.calendarEvent.findMany()).find(event => event.teamId === searcher.team.id)!;
    const auth = { Authorization: `Bearer ${searcher.token}` };

    const deleted = await request(app).delete(`/api/calendar/events/${copy.id}`).set(auth);
    expect(deleted.status).toBe(409);
    expect(deleted.body.errors).toContain(ERROR.eventFromMatchmaking);

    const moved = await request(app).put(`/api/calendar/events/${copy.id}`).set(auth).send({ startTime: '21:20', endTime: '22:40' });
    expect(moved.status).toBe(409);
    expect(moved.body.errors).toContain(ERROR.eventFromMatchmakingPlace);

    // The form sends everything back: what does not move goes through
    const renamed = await request(app).put(`/api/calendar/events/${copy.id}`).set(auth).send({
      date: DATE, startTime: copy.startTime, endTime: copy.endTime, type: 'MATCH', title: 'Scrim du jeudi', description: 'Bo3',
      venueId: copy.venueId, arenaNumber: copy.arenaNumber, evaSlotIds: copy.evaSlotIds,
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.title).toBe('Scrim du jeudi');
    expect(renamed.body.scrimSearchId).toBe(copy.scrimSearchId);
  });
});
