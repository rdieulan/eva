// Integration tests - The home dashboard: what a player of a team has to do
// soon, the most pressing first, each seeing what is theirs to do; and the
// league registration read again at once, at a manager's asking
//
// The clock is set (Paris, a summer morning); eva.gg and competitive.eva.gg are
// never called: the slots and the tournaments are mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { DEFAULT_PLAYER_PERMISSIONS, type DashboardItem } from '@shared/types';
import { getVenueSlots } from '../../server/src/services/venue-slots.service';
import {
  fetchLeagueTeamTournaments,
  fetchLeagueTeamsPage,
} from '../../server/src/integrations/competitive/competitive-teams';
import { syncLeagueDirectory } from '../../server/src/services/league-directory.service';

vi.mock('../../server/src/services/venue-slots.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/services/venue-slots.service')>(),
  getVenueSlots: vi.fn(),
}));
vi.mock('../../server/src/integrations/competitive/competitive-teams', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/competitive/competitive-teams')>(),
  fetchLeagueTeamsPage: vi.fn(),
  fetchLeagueTeamLogo: vi.fn(),
  fetchLeagueTeamTournaments: vi.fn(),
}));

const slotsOf = vi.mocked(getVenueSlots);
const tournamentsOf = vi.mocked(fetchLeagueTeamTournaments);

// 10:00 in Paris, two hours ahead of UTC in June
const NOW = new Date('2030-06-10T08:00:00Z');
const TODAY = '2030-06-10';
const SLOT_A = 'slot-a';
const SLOT_B = 'slot-b';

function dashboard(token: string) {
  return request(app).get('/api/dashboard').set(authHeader(token));
}

async function items(token: string): Promise<DashboardItem[]> {
  const res = await dashboard(token);
  expect(res.status).toBe(200);
  return res.body.items;
}

function day(offset: number): string {
  const date = new Date(`${TODAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function venue() {
  return prisma.venue.create({ data: { slug: `nimes-${Math.random()}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test', externalId: 51 } });
}

function createMatch(token: string, body: Record<string, unknown>) {
  return request(app).post('/api/calendar/events').set(authHeader(token)).send({ type: 'MATCH', title: 'Match vs Les Rivaux', ...body });
}

function createCompetition(token: string, body: Record<string, unknown>) {
  return request(app).post('/api/calendar/events').set(authHeader(token)).send({ type: 'COMPETITION', title: 'Journée de la Division 2', ...body });
}

function giveAvailability(token: string, date: string, status = 'AVAILABLE') {
  return request(app).post('/api/calendar/availability').set(authHeader(token)).send({ date, status });
}

// A member the leader lets do what the permissions name, in one category
async function memberWith(leaderToken: string, teamId: string, category: 'team' | 'matchmaking', granted: Record<string, boolean>) {
  const member = await createTeamMember(leaderToken, teamId);
  await request(app)
    .put(`/api/teams/current/members/${member.user.id}/permissions`)
    .set(authHeader(leaderToken))
    .send({ permissions: { ...DEFAULT_PLAYER_PERMISSIONS, [category]: { ...DEFAULT_PLAYER_PERMISSIONS[category], ...granted } } })
    .expect(200);
  return member;
}

let lastLeagueTeamId = 2444800000000000000n;

// A team linked to a league team of the directory, named RONIN on the site
async function linkedTeam() {
  lastLeagueTeamId += 1n;
  const entry = { id: String(lastLeagueTeamId), name: 'RONIN', memberCount: 5, logoId: null };
  vi.mocked(fetchLeagueTeamsPage).mockResolvedValue({ teams: [entry], skipped: 0, total: 1 });
  await syncLeagueDirectory({ pauseMs: 0 });
  const leader = await createUserWithTeam();
  await request(app).put('/api/teams/current/league-team').set(authHeader(leader.token)).send({ leagueTeamId: entry.id }).expect(200);
  // Linking read the site for the team's venue: the reads counted are the checks'
  tournamentsOf.mockClear();
  return { ...leader, leagueTeamId: entry.id };
}

// A month of the team's league open to registration, the team not registered, as a night's read leaves it
async function openLeagueMonth(teamId: string, closesAt = '2030-06-29T22:00:00.000Z') {
  const tournament = await prisma.leagueTournament.create({
    data: { id: '2570000000000000100', name: 'NEMAUSUS LEAGUE - JUILLET', regionId: 'region-nimes', registrationClosesAt: new Date(closesAt), seenAt: NOW },
  });
  await prisma.leagueEntry.create({ data: { teamId, tournamentId: tournament.id, openNoticeAt: NOW, checkedAt: NOW } });
  return tournament;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  slotsOf.mockReset().mockResolvedValue({ slots: [] });
  tournamentsOf.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/dashboard', () => {
  it('is empty for a player without a team, and for signed-in players only', async () => {
    const { token } = await createAuthenticatedUser();

    expect((await dashboard(token)).body).toEqual({ items: [], next: null });
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });

  it('with nothing to do, gives the team\'s next match or competition beyond the coming week all the same', async () => {
    const { token } = await createUserWithTeam();
    await request(app).put('/api/teams/current').set(authHeader(token)).send({ availabilityHorizonDays: 7 }).expect(200);
    for (let offset = 0; offset < 7; offset += 1) await giveAvailability(token, day(offset)).expect(200);
    const nimes = await venue();
    for (const date of [day(12), day(8)]) {
      await createMatch(token, { date, startTime: '20:00', endTime: '21:00', venueId: nimes.id }).expect(201);
    }

    const quiet = await dashboard(token);
    expect(quiet.body.items).toEqual([]);
    expect(quiet.body.next).toEqual({ eventId: expect.any(String), type: 'MATCH', date: day(8), startTime: '20:00', title: 'Match vs Les Rivaux' });

    // A competition sooner comes first
    await createCompetition(token, { date: day(7), startTime: '14:00', endTime: '19:00' }).expect(201);
    expect((await dashboard(token)).body.next).toMatchObject({ type: 'COMPETITION', date: day(7), title: 'Journée de la Division 2' });

    await createMatch(token, { date: day(3), startTime: '20:00', endTime: '21:00', venueId: nimes.id }).expect(201);
    const busy = await dashboard(token);
    expect(busy.body.items.map((item: DashboardItem) => item.kind)).toEqual(['MATCH']);
    expect(busy.body.next).toBeNull();
  });

  it('lists the team\'s competitions of the coming week not over yet, for every player, with the venue that published one', async () => {
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id);
    const nimes = await venue();
    // Over already this morning, then today, then beyond the week
    await createCompetition(leader.token, { date: TODAY, startTime: '08:00', endTime: '09:30' }).expect(201);
    await createCompetition(leader.token, { date: TODAY, startTime: '14:00', endTime: '19:00' }).expect(201);
    await createCompetition(leader.token, { date: day(9), startTime: '14:00', endTime: '19:00' }).expect(201);
    const published = await prisma.venueCompetition.create({
      data: { venueId: nimes.id, division: 2, title: 'Journée de la Division 2', date: new Date(day(2)), startTime: '14:00', endTime: '19:00' },
    });
    await prisma.calendarEvent.create({
      data: {
        type: 'COMPETITION', teamId: leader.team.id, createdById: leader.user.playerId, venueCompetitionId: published.id,
        title: 'Journée de la Division 2', date: new Date(day(2)), startTime: '14:00', endTime: '19:00',
      },
    });
    await giveAvailability(member.token, day(2), 'UNAVAILABLE').expect(200);

    const competitions = (await items(member.token)).filter(item => item.kind === 'COMPETITION');

    expect(competitions.map(item => item.due)).toEqual([`${TODAY}T14:00`, `${day(2)}T14:00`]);
    expect(competitions[0]!.data).toMatchObject({ title: 'Journée de la Division 2', venueName: null, isUnavailable: false });
    expect(competitions[1]!.data).toMatchObject({ venueName: 'Nîmes', isUnavailable: true });
  });

  it('lists the team\'s matches of the coming week not over yet, with the players eva.gg counts', async () => {
    const { token } = await createUserWithTeam();
    const nimes = await venue();
    for (const [date, startTime, endTime] of [[TODAY, '08:00', '09:00'], [TODAY, '20:00', '21:20'], [day(3), '19:20', '20:40'], [day(7), '20:00', '21:00']]) {
      await createMatch(token, { date, startTime, endTime, venueId: nimes.id, evaSlotIds: [SLOT_A, SLOT_B] }).expect(201);
    }
    slotsOf.mockImplementation(async (_venueId, date) => ({
      slots: [{ slotId: SLOT_A, takenSeats: date === TODAY ? 8 : 6 }, { slotId: SLOT_B, takenSeats: date === TODAY ? 8 : 5 }] as never,
    }));

    const matches = (await items(token)).filter(item => item.kind === 'MATCH');

    expect(matches.map(item => item.due)).toEqual([`${TODAY}T20:00`, `${day(3)}T19:20`]);
    expect(matches[0]!.data).toMatchObject({ title: 'Match vs Les Rivaux', venueName: 'Nîmes', evaLocationId: 51, headcount: { takenSeats: 8, varies: false }, isUnavailable: false });
    expect(matches[1]!.data).toMatchObject({ headcount: { takenSeats: 5, varies: true } });
  });

  it('knows the days the reader cannot play, and goes on without what eva.gg cannot tell', async () => {
    const { token } = await createUserWithTeam();
    const nimes = await venue();
    await createMatch(token, { date: day(2), startTime: '20:00', endTime: '21:00', venueId: nimes.id, evaSlotIds: [SLOT_A] }).expect(201);
    await giveAvailability(token, day(2), 'UNAVAILABLE').expect(200);
    slotsOf.mockRejectedValue(new Error('eva.gg is down'));

    const [match] = (await items(token)).filter(item => item.kind === 'MATCH');

    expect(match!.data).toMatchObject({ isUnavailable: true, headcount: null });
  });

  it('asks for the availability left to give, as far ahead as the team says', async () => {
    const { token } = await createUserWithTeam();
    for (const date of [TODAY, day(1), day(3)]) await giveAvailability(token, date).expect(200);

    const [asked] = (await items(token)).filter(item => item.kind === 'AVAILABILITY');
    expect(asked).toEqual({ kind: 'AVAILABILITY', due: `${day(2)}T00:00`, data: { missingDays: 12, horizonDays: 15, firstMissingDate: day(2) } });

    await request(app).put('/api/teams/current').set(authHeader(token)).send({ availabilityHorizonDays: 7 }).expect(200);
    expect((await items(token)).find(item => item.kind === 'AVAILABILITY')!.data).toMatchObject({ missingDays: 4, horizonDays: 7 });

    for (let offset = 0; offset < 7; offset += 1) await giveAvailability(token, day(offset)).expect(200);
    expect((await items(token)).some(item => item.kind === 'AVAILABILITY')).toBe(false);
  });

  it('tells those who manage the team of a month of its league to register to, under the name it registers with, the others not', async () => {
    const leader = await linkedTeam();
    const member = await createTeamMember(leader.token, leader.team.id);
    const manager = await memberWith(leader.token, leader.team.id, 'team', { canManageTeam: true });
    const tournament = await openLeagueMonth(leader.team.id);

    for (const reader of [leader, manager]) {
      expect((await items(reader.token)).find(item => item.kind === 'LEAGUE_REGISTRATION')).toEqual({
        kind: 'LEAGUE_REGISTRATION',
        due: '2030-06-30T00:00',
        data: { tournamentId: tournament.id, tournamentName: 'NEMAUSUS LEAGUE - JUILLET', leagueTeamName: 'RONIN', closesAt: '2030-06-29T22:00:00.000Z' },
      });
    }
    expect((await items(member.token)).some(item => item.kind === 'LEAGUE_REGISTRATION')).toBe(false);
  });

  it('lists the proposals to answer for those who may respond, and the requests to join for those who may invite', async () => {
    const leader = await createUserWithTeam();
    const responder = await memberWith(leader.token, leader.team.id, 'matchmaking', { canRespond: true });
    const inviter = await memberWith(leader.token, leader.team.id, 'team', { canInviteMembers: true });
    const rivals = await createUserWithTeam();
    const nimes = await venue();
    const search = await prisma.scrimSearch.create({
      data: { teamId: leader.team.id, date: new Date(day(4)), startTime: '19:20', endTime: '22:00', convocationTime: '19:05', createdById: leader.user.playerId },
    });
    await prisma.scrimProposal.create({
      data: {
        searchId: search.id, teamId: rivals.team.id, createdById: rivals.user.playerId, venueId: nimes.id,
        evaSlotIds: [SLOT_A], arenaNumber: 1, startTime: '20:00', endTime: '21:20', convocationTime: '19:45',
      },
    });
    const asking = await createAuthenticatedUser();
    await request(app).post('/api/join-requests').set(authHeader(asking.token)).send({ teamId: leader.team.id }).expect(201);

    const kindsOf = async (token: string) => (await items(token)).map(item => item.kind).filter(kind => kind !== 'AVAILABILITY');
    expect(await kindsOf(leader.token)).toEqual(['SCRIM_PROPOSAL', 'JOIN_REQUESTS']);
    expect(await kindsOf(responder.token)).toEqual(['SCRIM_PROPOSAL']);
    expect(await kindsOf(inviter.token)).toEqual(['JOIN_REQUESTS']);
    expect((await items(leader.token)).find(item => item.kind === 'SCRIM_PROPOSAL')).toMatchObject({
      due: `${day(4)}T20:00`,
      data: { teamName: rivals.team.name, date: day(4), startTime: '20:00', endTime: '21:20', venueName: 'Nîmes', searchId: search.id },
    });
  });

  it('puts the most pressing first, what has no due last', async () => {
    const leader = await linkedTeam();
    const nimes = await venue();
    await createMatch(leader.token, { date: day(5), startTime: '20:00', endTime: '21:00', venueId: nimes.id }).expect(201);
    await giveAvailability(leader.token, TODAY).expect(200);
    await openLeagueMonth(leader.team.id, '2030-06-12T22:00:00.000Z');
    const asking = await createAuthenticatedUser();
    await request(app).post('/api/join-requests').set(authHeader(asking.token)).send({ teamId: leader.team.id }).expect(201);

    expect((await items(leader.token)).map(item => item.kind)).toEqual(['AVAILABILITY', 'LEAGUE_REGISTRATION', 'MATCH', 'JOIN_REQUESTS']);
  });
});

describe('POST /api/dashboard/league-registration/check', () => {
  function check(token: string) {
    return request(app).post('/api/dashboard/league-registration/check').set(authHeader(token));
  }

  it('reads the team\'s registration again at once: registered, the month leaves the dashboard', async () => {
    const leader = await linkedTeam();
    const tournament = await openLeagueMonth(leader.team.id);
    tournamentsOf.mockResolvedValue([{ id: tournament.id, name: tournament.name, startsOn: null, region: null, registration: { status: 'open', opensAt: null, closesAt: null } }]);

    const res = await check(leader.token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registered: [tournament.id] });
    expect(tournamentsOf).toHaveBeenCalledWith(leader.leagueTeamId);
    expect((await items(leader.token)).some(item => item.kind === 'LEAGUE_REGISTRATION')).toBe(false);
  });

  it('reads it at most once every five minutes for a team, whatever came of the read', async () => {
    const leader = await linkedTeam();
    await openLeagueMonth(leader.team.id);
    tournamentsOf.mockRejectedValueOnce(new Error('down'));

    const failed = await check(leader.token);
    expect(failed.status).toBe(502);
    expect(failed.body.errors).toContain(ERROR.leagueCheckFailed);

    const tooSoon = await check(leader.token);
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.errors).toContain(ERROR.leagueCheckTooSoon);

    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60 * 1000));
    expect((await check(leader.token)).status).toBe(200);
    expect(tournamentsOf).toHaveBeenCalledTimes(2);
  });

  it('is for those who manage a team linked to its league team', async () => {
    const leader = await linkedTeam();
    const member = await createTeamMember(leader.token, leader.team.id);
    const unlinked = await createUserWithTeam();

    expect((await check(member.token)).status).toBe(403);
    const notLinked = await check(unlinked.token);
    expect(notLinked.status).toBe(409);
    expect(notLinked.body.errors).toContain(ERROR.leagueTeamNotLinked);
    expect(tournamentsOf).not.toHaveBeenCalled();
  });
});

describe('PUT /api/teams/current, the availability horizon', () => {
  it('keeps a horizon within its bounds, and answers the information saved, never the team\'s secrets', async () => {
    const { token, team } = await createUserWithTeam();
    await prisma.team.update({ where: { id: team.id }, data: { discordWebhookUrl: 'https://discord.com/api/webhooks/1/secret' } });

    for (const availabilityHorizonDays of [6, 31, 10.5, '15']) {
      const refused = await request(app).put('/api/teams/current').set(authHeader(token)).send({ availabilityHorizonDays });
      expect(refused.status).toBe(400);
      expect(refused.body.errors).toContain(ERROR.availabilityHorizonInvalid);
    }

    const res = await request(app).put('/api/teams/current').set(authHeader(token)).send({ availabilityHorizonDays: 21 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: team.id, name: team.name, venueId: null, favoriteVenueIds: [], availabilityHorizonDays: 21 });
    expect((await request(app).get('/api/teams/current').set(authHeader(token))).body.availabilityHorizonDays).toBe(21);
  });
});
