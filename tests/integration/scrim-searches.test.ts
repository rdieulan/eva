// Integration tests - Scrim searches (a team offers slots of one venue or more, for a day, to an opponent)
//
// eva.gg is never called: the sessions lookup is mocked so each test decides
// which slots each venue runs that day.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam, authHeader } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { SCRIM_SEARCH_VENUES_MAX } from '@shared/constants/eva.constants';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { EvaApiError } from '../../server/src/integrations/eva/eva-graphql';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', slug: 'nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 2 };
const MONTPELLIER = { id: 'venue-montpellier', slug: 'montpellier', name: 'Montpellier', city: 'Montpellier', address: '3 rue', externalId: 52, arenaCount: 1 };
const HAND_MADE = { id: 'venue-hand', slug: 'garage', name: 'Garage', city: 'Paris', address: '2 rue' };

// A far-off day, so the tests never fall into the past
const DATE = '2030-06-10';
const MONTH = '2030-06';

type Slot = ReturnType<typeof slot>;

function slot(slotId: string, startTime: string, endTime: string, arenaNumber: number, extra: Partial<{ takenSeats: number; isCompetitiveAvailable: boolean; gameId: number; passQuotaLeft: number | null }> = {}) {
  return {
    slotId,
    startTime,
    endTime,
    convocationTime: startTime === '20:00' ? '19:50' : startTime,
    arenaNumber,
    gameId: 1,
    takenSeats: 0,
    totalSeats: 10,
    isCompetitiveAvailable: true,
    tokenType: 'offPeak' as 'offPeak' | 'peak' | null,
    passQuotaLeft: null as number | null,
    ...extra,
  };
}

// What Nîmes runs that evening
const NIMES_SLOTS = [
  slot('a1-1720', '17:20', '18:00', 1, { gameId: 7 }),
  slot('a1-1800', '18:00', '18:40', 1, { isCompetitiveAvailable: false }),
  slot('a1-2000', '20:00', '20:40', 1),
  slot('a1-2040', '20:40', '21:20', 1),
  slot('a1-2120', '21:20', '22:00', 1, { takenSeats: 3 }),
  slot('a2-2040', '20:40', '21:20', 2),
];

// What Montpellier runs that evening
const MONTPELLIER_SLOTS = [
  slot('m1-2000', '20:00', '20:40', 1),
  slot('m1-2040', '20:40', '21:20', 1),
  slot('m1-2120', '21:20', '22:00', 1),
  slot('m1-2200', '22:00', '22:40', 1),
];

// Which slots each venue runs, by its id on eva.gg
function serve(slots: { nimes?: Slot[]; montpellier?: Slot[] } = {}) {
  sessions.mockImplementation(async externalId => {
    if (externalId === MONTPELLIER.externalId) return slots.montpellier ?? MONTPELLIER_SLOTS;
    return slots.nimes ?? NIMES_SLOTS;
  });
}

beforeEach(async () => {
  sessions.mockReset();
  serve();
  clearVenueSlotsCache();
  await prisma.venue.createMany({ data: [NIMES, MONTPELLIER, HAND_MADE] });
});

const atNimes = (...evaSlotIds: string[]) => ({ venueId: NIMES.id, evaSlotIds });
const atMontpellier = (...evaSlotIds: string[]) => ({ venueId: MONTPELLIER.id, evaSlotIds });

function open(token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/scrims/searches')
    .set(authHeader(token))
    .send({ date: DATE, venues: [atNimes('a1-2000', 'a1-2040')], slotCount: 2, matchCount: 1, ...body });
}

function list(token: string, query: Record<string, string>) {
  return request(app).get('/api/scrims/searches').query(query).set(authHeader(token));
}

async function joinAsMember(leaderToken: string, teamId: string): Promise<string> {
  const invite = await request(app)
    .post(`/api/teams/${teamId}/invites`)
    .set(authHeader(leaderToken))
    .send({ expiresInHours: 24, maxUses: 1 })
    .expect(201);
  const { token } = await createAuthenticatedUser();
  await request(app).post(`/api/invites/${invite.body.code}/join`).set(authHeader(token)).expect(200);
  return token;
}

describe('POST /api/scrims/searches', () => {
  it('should open a search carrying the venue, arena and times eva.gg gives each slot', async () => {
    const { token, team } = await createUserWithTeam();

    const res = await open(token, {});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      team: { id: team.id, name: team.name, logoUrl: null },
      date: DATE,
      slots: [
        { slotId: 'a1-2000', venueId: NIMES.id, arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' },
        { slotId: 'a1-2040', venueId: NIMES.id, arenaNumber: 1, startTime: '20:40', endTime: '21:20', convocationTime: '20:40' },
      ],
      startTime: '20:00',
      endTime: '21:20',
      convocationTime: '19:50',
      slotCount: 2,
      matchCount: 1,
      matchedCount: 0,
      takenSlotIds: [],
      status: 'OPEN',
      isMine: true,
    });
    expect(sessions).toHaveBeenCalledWith(NIMES.externalId, DATE);
  });

  it('should put the slots of a venue in time order whatever order they were sent in', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atNimes('a1-2040', 'a1-2000')] });

    expect(res.status).toBe(201);
    expect(res.body.slots.map((offered: { slotId: string }) => offered.slotId)).toEqual(['a1-2000', 'a1-2040']);
    expect(res.body.startTime).toBe('20:00');
  });

  it('should accept a single slot for a one-slot match', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atNimes('a2-2040')], slotCount: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slots: [{ slotId: 'a2-2040', arenaNumber: 2 }], startTime: '20:40', endTime: '21:20', slotCount: 1 });
  });

  it('should offer slots in several venues at once, venue by venue in the order the team gave them', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atMontpellier('m1-2040', 'm1-2000'), atNimes('a1-2000', 'a1-2040')] });

    expect(res.status).toBe(201);
    expect(res.body.slots.map((offered: { slotId: string; venueId: string }) => [offered.venueId, offered.slotId])).toEqual([
      [MONTPELLIER.id, 'm1-2000'],
      [MONTPELLIER.id, 'm1-2040'],
      [NIMES.id, 'a1-2000'],
      [NIMES.id, 'a1-2040'],
    ]);
    expect(sessions).toHaveBeenCalledWith(MONTPELLIER.externalId, DATE);
    expect(sessions).toHaveBeenCalledWith(NIMES.externalId, DATE);
    expect(await prisma.scrimSearch.count()).toBe(1);
  });

  it('should refuse an offer with no room for a match of the asked length', async () => {
    const { token } = await createUserWithTeam();

    const single = await open(token, { venues: [atNimes('a2-2040')] });
    expect(single.status).toBe(400);
    expect(single.body.errors).toContain(ERROR.scrimSearchOfferTooShort);

    const twoArenas = await open(token, { venues: [atNimes('a1-2000', 'a2-2040')] });
    expect(twoArenas.status).toBe(400);
    expect(twoArenas.body.errors).toContain(ERROR.scrimSearchOfferTooShort);

    // Two venues never make one run, even at the right times
    const twoVenues = await open(token, { venues: [atNimes('a1-2000'), atMontpellier('m1-2040')] });
    expect(twoVenues.status).toBe(400);
    expect(twoVenues.body.errors).toContain(ERROR.scrimSearchOfferTooShort);
  });

  it('should open a search for several matches when the offer holds them one after the other', async () => {
    const { token } = await createUserWithTeam();
    serve({ nimes: [
      slot('a1-2000', '20:00', '20:40', 1),
      slot('a1-2040', '20:40', '21:20', 1),
      slot('a1-2120', '21:20', '22:00', 1),
      slot('a1-2200', '22:00', '22:40', 1),
    ] });

    const backToBack = await open(token, { venues: [atNimes('a1-2000', 'a1-2040', 'a1-2120', 'a1-2200')], matchCount: 2 });

    expect(backToBack.status).toBe(201);
    expect(backToBack.body).toMatchObject({ slotCount: 2, matchCount: 2, matchedCount: 0 });
  });

  it('should count the matches of an offer across its venues, the next one starting when the first ends', async () => {
    const { token } = await createUserWithTeam();

    // 20:00 to 21:20 in Nîmes, then 21:20 to 22:40 in Montpellier
    const res = await open(token, { venues: [atNimes('a1-2000', 'a1-2040'), atMontpellier('m1-2120', 'm1-2200')], matchCount: 2 });

    expect(res.status).toBe(201);
  });

  it('should refuse two matches at the same time: the team plays one at a time', async () => {
    const { token } = await createUserWithTeam();
    serve({ nimes: [
      slot('a1-2000', '20:00', '20:40', 1),
      slot('a1-2040', '20:40', '21:20', 1),
      slot('a2-2000', '20:00', '20:40', 2),
      slot('a2-2040', '20:40', '21:20', 2),
    ] });

    const twoArenas = await open(token, { venues: [atNimes('a1-2000', 'a1-2040', 'a2-2000', 'a2-2040')], matchCount: 2 });
    expect(twoArenas.status).toBe(400);
    expect(twoArenas.body.errors).toContain(ERROR.scrimSearchOfferTooShort);

    const twoVenues = await open(token, { venues: [atNimes('a1-2000', 'a1-2040'), atMontpellier('m1-2000', 'm1-2040')], matchCount: 2 });
    expect(twoVenues.status).toBe(400);
    expect(twoVenues.body.errors).toContain(ERROR.scrimSearchOfferTooShort);

    // Half an overlap is still an overlap: 20:40 to 22:00 runs into 20:00 to 21:20
    const halfway = await open(token, { venues: [atNimes('a1-2000', 'a1-2040'), atMontpellier('m1-2040', 'm1-2120')], matchCount: 2 });
    expect(halfway.status).toBe(400);
    expect(halfway.body.errors).toContain(ERROR.scrimSearchOfferTooShort);
  });

  it('should refuse an offer that does not hold every match asked for', async () => {
    const { token } = await createUserWithTeam();
    serve({ nimes: [
      slot('a1-2000', '20:00', '20:40', 1),
      slot('a1-2040', '20:40', '21:20', 1),
      slot('a1-2120', '21:20', '22:00', 1),
    ] });

    // Three slots in a row hold one match of two, not two
    const threeInARow = await open(token, { venues: [atNimes('a1-2000', 'a1-2040', 'a1-2120')], matchCount: 2 });
    expect(threeInARow.status).toBe(400);
    expect(threeInARow.body.errors).toContain(ERROR.scrimSearchOfferTooShort);
  });

  it('should refuse a number of matches out of bounds', async () => {
    const { token } = await createUserWithTeam();

    for (const matchCount of [0, 5, 1.5, 'deux', undefined]) {
      const res = await open(token, { matchCount });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.scrimSearchMatchCountInvalid);
    }
  });

  it('should refuse a match length out of bounds', async () => {
    const { token } = await createUserWithTeam();

    for (const slotCount of [0, 5, 1.5, 'deux', undefined]) {
      const res = await open(token, { slotCount });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.scrimSearchSlotCountInvalid);
    }
  });

  it('should refuse a slot eva.gg does not list that day at that venue', async () => {
    const { token } = await createUserWithTeam();

    const unknown = await open(token, { venues: [atNimes('a1-2000', 'nope')] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors).toContain(ERROR.scrimSearchSlotsUnknown);

    // A slot of Nîmes offered as one of Montpellier
    const elsewhere = await open(token, { venues: [atMontpellier('a1-2000', 'a1-2040')] });
    expect(elsewhere.status).toBe(400);
    expect(elsewhere.body.errors).toContain(ERROR.scrimSearchSlotsUnknown);
  });

  it('should offer slots that do not follow each other, as long as a run of the match length fits', async () => {
    const { token } = await createUserWithTeam();
    serve({ nimes: [...NIMES_SLOTS, slot('a1-1440', '14:40', '15:20', 1)] });

    const res = await open(token, { venues: [atNimes('a1-2040', 'a1-1440', 'a1-2000')] });

    expect(res.status).toBe(201);
    expect(res.body.slots.map((offered: { slotId: string }) => offered.slotId)).toEqual(['a1-1440', 'a1-2000', 'a1-2040']);
    expect(res.body).toMatchObject({ slotCount: 2, startTime: '14:40', endTime: '21:20', convocationTime: '14:40' });
  });

  it('should offer slots on two arenas, arena by arena', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atNimes('a2-2040', 'a1-2000', 'a1-2040')] });

    expect(res.status).toBe(201);
    expect(res.body.slots.map((offered: { slotId: string }) => offered.slotId)).toEqual(['a1-2000', 'a1-2040', 'a2-2040']);
    expect(res.body).toMatchObject({ startTime: '20:00', endTime: '21:20' });
  });

  it('should refuse a slot given to another game', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atNimes('a1-1720')] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsOtherGame);
  });

  it('should refuse a slot closed to the competitive mode', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atNimes('a1-1800')] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotCompetitive);
  });

  it('should refuse a slot somebody is already booked on', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [atNimes('a1-2040', 'a1-2120')] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotFree);
  });

  it('should refuse a peak slot the venue no longer opens to EVA Pass holders that day', async () => {
    const { token } = await createUserWithTeam();
    serve({ nimes: [
      slot('a1-2000', '20:00', '20:40', 1, { passQuotaLeft: 0 }),
      slot('a1-2040', '20:40', '21:20', 1, { passQuotaLeft: 0 }),
      slot('a2-2000', '20:00', '20:40', 2, { passQuotaLeft: 3 }),
      slot('a2-2040', '20:40', '21:20', 2, { passQuotaLeft: 3 }),
    ] });

    const reached = await open(token, { venues: [atNimes('a1-2000', 'a1-2040')] });
    expect(reached.status).toBe(409);
    expect(reached.body.errors).toContain(ERROR.scrimSearchSlotsPassQuota);

    // Some sessions still open to the pass: the slot can be offered
    expect((await open(token, { venues: [atNimes('a2-2000', 'a2-2040')] })).status).toBe(201);
  });

  it('should keep to one open search per team and day, whatever its slots and venues', async () => {
    const { token } = await createUserWithTeam();
    const first = await open(token, {}).expect(201);

    const res = await open(token, { venues: [atMontpellier('m1-2120', 'm1-2200')] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchAlreadyOpen);
    expect(await prisma.scrimSearch.count()).toBe(1);

    // Once the first has its match, the day can have another
    await prisma.scrimSearch.update({ where: { id: first.body.id }, data: { status: 'MATCHED' } });
    expect((await open(token, { venues: [atMontpellier('m1-2120', 'm1-2200')] })).status).toBe(201);
  });

  it('should open a single search when the same offer is sent twice at once', async () => {
    const { token } = await createUserWithTeam();

    const answers = await Promise.all([open(token, {}), open(token, {})]);

    expect(answers.map(answer => answer.status).sort()).toEqual([201, 409]);
    expect(await prisma.scrimSearch.count()).toBe(1);
  });

  it('should let another team search on the same slots', async () => {
    const { token: first } = await createUserWithTeam();
    const { token: second } = await createUserWithTeam();
    await open(first, {}).expect(201);

    const res = await open(second, {});

    expect(res.status).toBe(201);
  });

  it('should refuse a day gone by', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { date: '2020-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimSearchDateInPast);
    expect(sessions).not.toHaveBeenCalled();
  });

  it('should refuse a venue that is not on eva.gg', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [{ venueId: HAND_MADE.id, evaSlotIds: ['a1-2000'] }] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.venueNotOnEva);
  });

  it('should answer 404 for a venue that does not exist', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venues: [{ venueId: 'no-such-venue', evaSlotIds: ['a1-2000'] }] });

    expect(res.status).toBe(404);
    expect(res.body.errors).toContain(ERROR.venueNotFound);
  });

  it('should refuse a malformed list of venues', async () => {
    const { token } = await createUserWithTeam();
    const tooMany = Array.from({ length: SCRIM_SEARCH_VENUES_MAX + 1 }, (_, index) => ({ venueId: `venue-${index}`, evaSlotIds: [`s-${index}`] }));

    for (const venues of [undefined, [], 'venue-nimes', [null], [{ evaSlotIds: ['a1-2000'] }], [atNimes('a1-2000'), atNimes('a1-2040')], tooMany]) {
      const res = await open(token, { venues });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.scrimSearchVenuesInvalid);
    }
  });

  it('should refuse a malformed list of slots', async () => {
    const { token } = await createUserWithTeam();

    for (const venues of [
      [atNimes()],
      [atNimes('a1-2000', 'a1-2000')],
      [{ venueId: NIMES.id, evaSlotIds: 'a1-2000' }],
      [{ venueId: NIMES.id, evaSlotIds: [42] }],
      [atNimes('a1-2000'), atMontpellier('a1-2000')],
    ]) {
      const res = await open(token, { venues });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.scrimOfferSlotsInvalid);
    }

    expect((await open(token, { date: '2030-13-45' })).body.errors).toContain(ERROR.dateInvalid);
  });

  it('should answer 502 when eva.gg cannot be read', async () => {
    const { token } = await createUserWithTeam();
    sessions.mockRejectedValue(new EvaApiError('down', [], 500));

    const res = await open(token, {});

    expect(res.status).toBe(502);
    expect(res.body.errors).toContain(ERROR.evaUnavailable);
  });

  it('should refuse a member the leader did not allow to search', async () => {
    const { token: leaderToken, team } = await createUserWithTeam();
    const memberToken = await joinAsMember(leaderToken, team.id);

    const res = await open(memberToken, {});

    expect(res.status).toBe(403);
  });

  it('should refuse a player without a team', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await open(token, {});

    expect(res.status).toBe(403);
  });

  it('should reject without authentication', async () => {
    const res = await request(app).post('/api/scrims/searches').send({});

    expect(res.status).toBe(401);
  });
});

describe('GET /api/scrims/searches', () => {
  it('should list the searches of every team offering slots in the venue, flagging the reader\'s own', async () => {
    const { token: mine, team: myTeam } = await createUserWithTeam();
    const { token: theirs, team: theirTeam } = await createUserWithTeam();
    await open(mine, {}).expect(201);
    await open(theirs, { venues: [atNimes('a2-2040')], slotCount: 1 }).expect(201);

    const res = await list(mine, { month: MONTH, venueIds: NIMES.id });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ team: { id: myTeam.id }, isMine: true, startTime: '20:00' });
    expect(res.body[1]).toMatchObject({ team: { id: theirTeam.id }, isMine: false, startTime: '20:40' });
  });

  it('should list a search spanning venues under each of them, with all its slots', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    await open(theirs, { venues: [atNimes('a1-2000', 'a1-2040'), atMontpellier('m1-2120', 'm1-2200')] }).expect(201);

    for (const venueIds of [NIMES.id, MONTPELLIER.id, `${NIMES.id},${MONTPELLIER.id}`]) {
      const res = await list(mine, { month: MONTH, venueIds });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].slots).toHaveLength(4);
    }
  });

  it('should list the searches of several venues at once', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: atOne } = await createUserWithTeam();
    const { token: atOther } = await createUserWithTeam();
    await open(atOne, {}).expect(201);
    await open(atOther, { venues: [atMontpellier('m1-2120', 'm1-2200')] }).expect(201);

    const one = await list(mine, { month: MONTH, venueIds: MONTPELLIER.id });
    expect(one.body).toHaveLength(1);

    const both = await list(mine, { month: MONTH, venueIds: `${NIMES.id},${MONTPELLIER.id}` });
    expect(both.body).toHaveLength(2);
  });

  it('should list the reader\'s own searches wherever they are, along with the other teams\' in the venues asked for', async () => {
    const { token: mine, team: myTeam } = await createUserWithTeam();
    const { token: theirs, team: theirTeam } = await createUserWithTeam();
    const { token: elsewhere } = await createUserWithTeam();
    await open(mine, { venues: [atMontpellier('m1-2120', 'm1-2200')] }).expect(201);
    await open(theirs, {}).expect(201);
    await open(elsewhere, { venues: [atMontpellier('m1-2000', 'm1-2040')] }).expect(201);

    const res = await list(mine, { month: MONTH, venueIds: NIMES.id });

    expect(res.status).toBe(200);
    expect(res.body.map((search: { team: { id: string } }) => search.team.id).sort()).toEqual([myTeam.id, theirTeam.id].sort());
    expect(res.body.find((search: { isMine: boolean }) => search.isMine).slots[0].venueId).toBe(MONTPELLIER.id);
  });

  it('should list only the reader\'s team searches when no venue is given', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    await open(mine, {}).expect(201);
    await open(theirs, { venues: [atNimes('a2-2040')], slotCount: 1 }).expect(201);

    const res = await list(mine, { month: MONTH });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isMine).toBe(true);
  });

  it('should keep to the month asked for and to open searches', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);
    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'MATCHED' } });

    const sameMonth = await list(token, { month: MONTH, venueIds: NIMES.id });
    expect(sameMonth.body).toEqual([]);

    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'OPEN' } });
    const otherMonth = await list(token, { month: '2030-07', venueIds: NIMES.id });
    expect(otherMonth.body).toEqual([]);
  });

  it('should refuse a bad month, a bad list of venues and a player without a team', async () => {
    const { token } = await createUserWithTeam();
    expect((await list(token, { month: '2030-6' })).status).toBe(400);

    const tooMany = Array.from({ length: SCRIM_SEARCH_VENUES_MAX + 1 }, (_, index) => `venue-${index}`).join(',');
    for (const venueIds of ['', `${NIMES.id},`, `${NIMES.id},${NIMES.id}`, tooMany]) {
      const res = await list(token, { month: MONTH, venueIds });
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.scrimSearchVenuesInvalid);
    }

    const { token: loner } = await createAuthenticatedUser();
    expect((await list(loner, { month: MONTH })).status).toBe(403);
  });
});

describe('DELETE /api/scrims/searches/:id', () => {
  it('should withdraw an open search of the team, with its slots', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);

    const res = await request(app)
      .delete(`/api/scrims/searches/${opened.body.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(204);
    expect(await prisma.scrimSearch.count()).toBe(0);
    expect(await prisma.scrimSearchSlot.count()).toBe(0);
  });

  it('should refuse to withdraw another team\'s search', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    const opened = await open(theirs, {}).expect(201);

    const res = await request(app)
      .delete(`/api/scrims/searches/${opened.body.id}`)
      .set(authHeader(mine));

    expect(res.status).toBe(403);
    expect(await prisma.scrimSearch.count()).toBe(1);
  });

  it('should keep a search that already found an opponent', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);
    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'MATCHED' } });

    const res = await request(app)
      .delete(`/api/scrims/searches/${opened.body.id}`)
      .set(authHeader(token));

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchNotOpen);
  });

  it('should answer 404 for a search that does not exist', async () => {
    const { token } = await createUserWithTeam();

    const res = await request(app)
      .delete('/api/scrims/searches/no-such-search')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it('should go away with the team', async () => {
    const { token } = await createUserWithTeam();
    await open(token, {}).expect(201);

    await request(app).delete('/api/teams/current').set(authHeader(token)).expect(200);

    expect(await prisma.scrimSearch.count()).toBe(0);
  });
});

describe('PUT /api/scrims/searches/:id', () => {
  function change(token: string, id: string, body: Record<string, unknown>) {
    return request(app)
      .put(`/api/scrims/searches/${id}`)
      .set(authHeader(token))
      .send({ venues: [atNimes('a1-2000', 'a1-2040')], slotCount: 2, matchCount: 1, ...body });
  }

  function propose(token: string, searchId: string, evaSlotIds: string[]) {
    return request(app)
      .post(`/api/scrims/searches/${searchId}/proposals`)
      .set(authHeader(token))
      .send({ evaSlotIds });
  }

  // Montpellier's whole evening, 20:00 to 22:40
  const EVENING = atMontpellier('m1-2000', 'm1-2040', 'm1-2120', 'm1-2200');

  it('should change the slots, the venues, the length and the number of matches, the day and the search staying', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);

    const res = await change(token, opened.body.id, { venues: [EVENING], slotCount: 1, matchCount: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: opened.body.id, date: DATE, slotCount: 1, matchCount: 3, startTime: '20:00', endTime: '22:40', status: 'OPEN', isMine: true,
    });
    expect(res.body.slots.map((slot: { slotId: string }) => slot.slotId)).toEqual(['m1-2000', 'm1-2040', 'm1-2120', 'm1-2200']);
    expect(await prisma.scrimSearch.count()).toBe(1);
    expect(await prisma.scrimSearchSlot.count()).toBe(4);
  });

  it('should keep a pending proposal the new offer still holds, and decline one it no longer does', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: keeper } = await createUserWithTeam();
    const { token: dropped } = await createUserWithTeam();
    const opened = await open(mine, { venues: [EVENING] }).expect(201);
    const kept = await propose(keeper, opened.body.id, ['m1-2000', 'm1-2040']).expect(201);
    const lost = await propose(dropped, opened.body.id, ['m1-2120', 'm1-2200']).expect(201);

    // The evening now ends at 21:20: the second run is gone
    const res = await change(mine, opened.body.id, { venues: [atMontpellier('m1-2000', 'm1-2040')] });

    expect(res.status).toBe(200);
    expect(res.body.proposals.map((proposal: { id: string }) => proposal.id)).toEqual([kept.body.id]);
    expect((await prisma.scrimProposal.findUniqueOrThrow({ where: { id: kept.body.id } })).status).toBe('PENDING');
    expect(await prisma.scrimProposal.findUniqueOrThrow({ where: { id: lost.body.id } })).toMatchObject({ status: 'DECLINED', declineReason: 'SEARCH_CHANGED' });
  });

  it('should decline the pending proposals when a match changes length', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    const opened = await open(mine, { venues: [EVENING] }).expect(201);
    const sent = await propose(theirs, opened.body.id, ['m1-2000', 'm1-2040']).expect(201);

    await change(mine, opened.body.id, { venues: [EVENING], slotCount: 1 }).expect(200);

    expect(await prisma.scrimProposal.findUniqueOrThrow({ where: { id: sent.body.id } })).toMatchObject({ status: 'DECLINED', declineReason: 'SEARCH_CHANGED' });
  });

  it('should keep the matches made, want one more at least, and hold the next ones beside them', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    const opened = await open(mine, { venues: [EVENING], matchCount: 2 }).expect(201);
    const sent = await propose(theirs, opened.body.id, ['m1-2000', 'm1-2040']).expect(201);
    await request(app).put(`/api/scrims/proposals/${sent.body.id}/accept`).set(authHeader(mine)).expect(200);

    // One match made: one in all is no search any more
    const tooLow = await change(mine, opened.body.id, { venues: [atMontpellier('m1-2120', 'm1-2200')], matchCount: 1 });
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.errors).toContain(ERROR.scrimSearchMatchCountTooLow);

    // In Nîmes at the time of the match made: no room for the next one
    const sameTime = await change(mine, opened.body.id, { venues: [atNimes('a1-2000', 'a1-2040')], matchCount: 2 });
    expect(sameTime.status).toBe(400);
    expect(sameTime.body.errors).toContain(ERROR.scrimSearchOfferTooShort);

    const res = await change(mine, opened.body.id, { venues: [atMontpellier('m1-2120', 'm1-2200')], matchCount: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matchCount: 2, matchedCount: 1, status: 'OPEN', startTime: '21:20', endTime: '22:40' });
    expect(await prisma.calendarEvent.count()).toBe(2);
  });

  it('should refuse a slot a match cannot take, as when the search opened', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);

    const res = await change(token, opened.body.id, { venues: [atNimes('a1-2040', 'a1-2120')] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotFree);
    expect((await prisma.scrimSearchSlot.findMany({ where: { searchId: opened.body.id } })).map(slot => slot.evaSlotId).sort())
      .toEqual(['a1-2000', 'a1-2040']);
  });

  it('should refuse another team\'s search, a closed one, one gone by and one that does not exist', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    const opened = await open(theirs, {}).expect(201);
    expect((await change(mine, opened.body.id, {})).status).toBe(403);
    expect((await change(mine, 'no-such-search', {})).status).toBe(404);

    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'MATCHED' } });
    const closed = await change(theirs, opened.body.id, {});
    expect(closed.status).toBe(409);
    expect(closed.body.errors).toContain(ERROR.scrimSearchNotOpen);

    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'OPEN', date: new Date('2020-01-01') } });
    const past = await change(theirs, opened.body.id, {});
    expect(past.status).toBe(400);
    expect(past.body.errors).toContain(ERROR.scrimSearchDateInPast);
  });

  it('should refuse a malformed offer, bad settings and a member the leader did not allow to search', async () => {
    const { token, team } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);

    expect((await change(token, opened.body.id, { venues: [] })).body.errors).toContain(ERROR.scrimSearchVenuesInvalid);
    expect((await change(token, opened.body.id, { slotCount: 9 })).body.errors).toContain(ERROR.scrimSearchSlotCountInvalid);
    expect((await change(token, opened.body.id, { matchCount: 0 })).body.errors).toContain(ERROR.scrimSearchMatchCountInvalid);

    const memberToken = await joinAsMember(token, team.id);
    expect((await change(memberToken, opened.body.id, {})).status).toBe(403);
  });
});
