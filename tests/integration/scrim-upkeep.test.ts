// Integration tests - Scrim searches kept in step with time: the slots they
// offer can be booked by anyone at the venue after the search opened, and the
// day of a search passes
//
// eva.gg is never called: the sessions lookup is mocked, each test deciding
// what each venue runs and who booked what.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { EvaApiError } from '../../server/src/integrations/eva/eva-graphql';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';
import { upkeepScrimSearches } from '../../server/src/services/scrim-upkeep.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 1 };
const MONTPELLIER = { id: 'venue-montpellier', name: 'Montpellier', city: 'Montpellier', address: '3 rue', externalId: 52, arenaCount: 1 };
const DATE = '2030-06-10';

function slot(slotId: string, startTime: string, endTime: string, takenSeats = 0) {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber: 1, gameId: 1, takenSeats, totalSeats: 10, isCompetitiveAvailable: true, tokenType: null, passQuotaLeft: null };
}

// Nîmes runs four slots in a row that evening; `booked` says which someone took since
function nimes(...booked: string[]) {
  return ['a1-2000', 'a1-2040', 'a1-2120', 'a1-2200'].map((slotId, index) =>
    slot(slotId, ['20:00', '20:40', '21:20', '22:00'][index]!, ['20:40', '21:20', '22:00', '22:40'][index]!, booked.includes(slotId) ? 3 : 0));
}

const MONTPELLIER_SLOTS = [slot('m1-2000', '20:00', '20:40'), slot('m1-2040', '20:40', '21:20')];

// What eva.gg answers from now on
function serve(nimesSlots = nimes(), montpellier: unknown = MONTPELLIER_SLOTS) {
  sessions.mockImplementation(async externalId => {
    if (externalId === MONTPELLIER.externalId) {
      if (montpellier instanceof Error) throw montpellier;
      return montpellier as typeof MONTPELLIER_SLOTS;
    }
    return nimesSlots;
  });
  clearVenueSlotsCache();
}

beforeEach(async () => {
  sessions.mockReset();
  serve();
  await prisma.venue.createMany({ data: [NIMES, MONTPELLIER] });
});

async function open(token: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await request(app)
    .post('/api/scrims/searches')
    .set('Authorization', `Bearer ${token}`)
    .send({ date: DATE, venues: [{ venueId: NIMES.id, evaSlotIds: ['a1-2000', 'a1-2040', 'a1-2120', 'a1-2200'] }], slotCount: 2, matchCount: 1, ...body })
    .expect(201);
  return res.body.id;
}

async function propose(token: string, searchId: string, evaSlotIds: string[]): Promise<string> {
  const res = await request(app).post(`/api/scrims/searches/${searchId}/proposals`).set('Authorization', `Bearer ${token}`).send({ evaSlotIds }).expect(201);
  return res.body.id;
}

async function searchOf(id: string) {
  return prisma.scrimSearch.findUniqueOrThrow({ where: { id }, include: { slots: { orderBy: { position: 'asc' } } } });
}

// Where a proposal stands, and why when it was declined
async function outcomeOf(proposalId: string) {
  const { status, declineReason } = await prisma.scrimProposal.findUniqueOrThrow({ where: { id: proposalId } });
  return { status, declineReason };
}

const BEFORE_THE_DAY = new Date('2030-06-01T12:00:00');
const AFTER_THE_DAY = new Date('2030-06-11T12:00:00');

describe('Scrim upkeep: the slots booked since a search opened', () => {
  it('takes a booked slot out of the offer and declines the proposal on it; the search stays open while it holds a match', async () => {
    const searcher = await createUserWithTeam();
    const proposer = await createUserWithTeam();
    const searchId = await open(searcher.token);
    const onBooked = await propose(proposer.token, searchId, ['a1-2120', 'a1-2200']);
    const onFree = await propose((await createUserWithTeam()).token, searchId, ['a1-2000', 'a1-2040']);
    serve(nimes('a1-2200'));

    const report = await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 });

    expect(report).toMatchObject({ daysRead: 1, slotsLost: 1, closedLost: 0, closedPast: 0 });
    const search = await searchOf(searchId);
    expect(search.status).toBe('OPEN');
    expect(search.slots.map(item => item.evaSlotId)).toEqual(['a1-2000', 'a1-2040', 'a1-2120']);
    expect(search.endTime).toBe('22:00');
    expect(await outcomeOf(onBooked)).toEqual({ status: 'DECLINED', declineReason: 'RUN_TAKEN' });
    expect(await outcomeOf(onFree)).toEqual({ status: 'PENDING', declineReason: null });
  });

  it('closes a search whose slots no longer hold a match, as expired, declining what is pending', async () => {
    const searcher = await createUserWithTeam();
    const searchId = await open(searcher.token);
    const pending = await propose((await createUserWithTeam()).token, searchId, ['a1-2000', 'a1-2040']);
    // Every other slot booked: no two free in a row
    serve(nimes('a1-2040', 'a1-2200'));

    const report = await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 });

    expect(report).toMatchObject({ slotsLost: 2, closedLost: 1 });
    expect((await searchOf(searchId)).status).toBe('EXPIRED');
    expect(await outcomeOf(pending)).toEqual({ status: 'DECLINED', declineReason: 'RUN_TAKEN' });
  });

  it('leaves alone the slots of a match made, its own players booking them, and closes as matched what holds no other', async () => {
    const searcher = await createUserWithTeam();
    const searchId = await open(searcher.token, { matchCount: 2 });
    const made = await propose((await createUserWithTeam()).token, searchId, ['a1-2000', 'a1-2040']);
    await request(app).put(`/api/scrims/proposals/${made}/accept`).set('Authorization', `Bearer ${searcher.token}`).expect(200);

    // The two teams booked their match on eva.gg
    serve(nimes('a1-2000', 'a1-2040'));
    expect(await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 })).toMatchObject({ slotsLost: 0, closedLost: 0 });
    expect((await searchOf(searchId)).status).toBe('OPEN');

    // Then someone books the next one: no room left for a second match
    serve(nimes('a1-2000', 'a1-2040', 'a1-2200'));
    await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 });
    expect((await searchOf(searchId)).status).toBe('MATCHED');
  });

  it('reads each venue day once, whatever the number of searches there, and keeps a search eva.gg cannot be read for', async () => {
    const first = await open((await createUserWithTeam()).token);
    const second = await open((await createUserWithTeam()).token);
    const elsewhere = await open((await createUserWithTeam()).token, {
      venues: [{ venueId: MONTPELLIER.id, evaSlotIds: ['m1-2000', 'm1-2040'] }],
    });
    serve(nimes('a1-2000'), new EvaApiError('eva.gg is down'));
    sessions.mockClear();

    const report = await upkeepScrimSearches({ now: BEFORE_THE_DAY, pauseMs: 0 });

    expect(report).toMatchObject({ daysRead: 1, daysFailed: 1, slotsLost: 2 });
    expect(sessions).toHaveBeenCalledTimes(2);
    expect((await searchOf(first)).slots).toHaveLength(3);
    expect((await searchOf(second)).slots).toHaveLength(3);
    expect((await searchOf(elsewhere)).slots).toHaveLength(2);
  });
});

describe('Scrim upkeep: the days gone by', () => {
  it('closes the searches whose day passed, matched or expired, declining what is pending, without asking eva.gg', async () => {
    const searcher = await createUserWithTeam();
    const withMatch = await open(searcher.token, { matchCount: 2 });
    const made = await propose((await createUserWithTeam()).token, withMatch, ['a1-2000', 'a1-2040']);
    await request(app).put(`/api/scrims/proposals/${made}/accept`).set('Authorization', `Bearer ${searcher.token}`).expect(200);
    const left = await propose((await createUserWithTeam()).token, withMatch, ['a1-2120', 'a1-2200']);
    const withoutMatch = await open((await createUserWithTeam()).token);
    sessions.mockClear();

    const report = await upkeepScrimSearches({ now: AFTER_THE_DAY, pauseMs: 0 });

    expect(report).toMatchObject({ closedPast: 2, daysRead: 0 });
    expect((await searchOf(withMatch)).status).toBe('MATCHED');
    expect((await searchOf(withoutMatch)).status).toBe('EXPIRED');
    expect(await outcomeOf(left)).toEqual({ status: 'DECLINED', declineReason: 'DAY_PASSED' });
    expect(sessions).not.toHaveBeenCalled();
  });

  it('drops the closed searches from the calendar', async () => {
    const searcher = await createUserWithTeam();
    await open(searcher.token);

    await upkeepScrimSearches({ now: AFTER_THE_DAY, pauseMs: 0 });

    const listed = await request(app).get('/api/scrims/searches').query({ month: '2030-06' }).set('Authorization', `Bearer ${searcher.token}`).expect(200);
    expect(listed.body).toEqual([]);
  });
});
