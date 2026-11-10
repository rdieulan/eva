// Integration tests - The monthly registration of our linked teams to their
// local league: read from the site, told to those who manage a team not
// registered when a month opens and three days before it closes, never twice
//
// competitive.eva.gg is never called: the tournaments are mocked, each test
// deciding what the site lists.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import {
  CompetitiveApiError,
  fetchLeagueRegionTournaments,
  fetchLeagueTeamTournaments,
  fetchLeagueTeamsPage,
  type LeagueTeamEntry,
  type LeagueTournament,
} from '../../server/src/integrations/competitive/competitive-teams';
import { syncLeagueDirectory } from '../../server/src/services/league-directory.service';
import { checkLeagueRegistrations } from '../../server/src/services/league-registrations.service';

vi.mock('../../server/src/integrations/competitive/competitive-teams', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/competitive/competitive-teams')>(),
  fetchLeagueTeamsPage: vi.fn(),
  fetchLeagueTeamLogo: vi.fn(),
  fetchLeagueTeamTournaments: vi.fn(),
  fetchLeagueRegionTournaments: vi.fn(),
}));

const listPage = vi.mocked(fetchLeagueTeamsPage);
const tournamentsOfTeam = vi.mocked(fetchLeagueTeamTournaments);
const tournamentsOfLeague = vi.mocked(fetchLeagueRegionTournaments);

const NIMES = { id: '2395742493876512767', name: 'NÎMES', machineName: 'nimes' };
const OCCITANIE = { id: '2395742493876512999', name: 'OCCITANIE', machineName: 'occitanie' };

const DAY_MS = 24 * 60 * 60 * 1000;
// The night of the check: the November month of the league is open, December not yet
const NIGHT = new Date('2030-11-20T03:00:00Z');
const NOVEMBER_CLOSES = '2030-11-30T23:00:00.000Z';

function month(id: string, name: string, startsOn: string, region: typeof NIMES | null, registration: LeagueTournament['registration']): LeagueTournament {
  return { id, name, startsOn, region, registration };
}

const OCTOBER = month('2570000000000000010', 'NEMAUSUS LEAGUE - OCTOBRE', '2030-10-01', NIMES, { status: 'finished', opensAt: '2030-09-25T22:00:00.000Z', closesAt: '2030-10-25T23:00:00.000Z' });
const NOVEMBER = month('2570000000000000011', 'NEMAUSUS LEAGUE - NOVEMBRE', '2030-11-01', NIMES, { status: 'open', opensAt: '2030-10-23T22:00:00.000Z', closesAt: NOVEMBER_CLOSES });
const DECEMBER = month('2570000000000000012', 'NEMAUSUS LEAGUE - DÉCEMBRE', '2030-12-01', NIMES, { status: 'pending', opensAt: '2030-11-23T23:00:00.000Z', closesAt: '2030-12-30T23:00:00.000Z' });

let lastLeagueTeamId = 2444700000000000000n;
function leagueTeam(name: string): LeagueTeamEntry {
  lastLeagueTeamId += 1n;
  return { id: String(lastLeagueTeamId), name, memberCount: 5, logoId: null };
}

// A team of ours linked to its league team, and the site's answers about it
async function linkedTeam(name: string) {
  const entry = leagueTeam(name);
  listPage.mockImplementation(async () => ({ teams: [entry], skipped: 0, total: 1 }));
  await syncLeagueDirectory({ pauseMs: 0, now: new Date(NIGHT.getTime() - DAY_MS) });
  const leader = await createUserWithTeam();
  await request(app).put('/api/teams/current/league-team').set(authHeader(leader.token)).send({ leagueTeamId: entry.id }).expect(200);
  return { ...leader, leagueTeamId: entry.id };
}

// What the site lists of the teams' tournaments and of the league's
function siteLists(teams: Record<string, LeagueTournament[]>, league: LeagueTournament[] = [DECEMBER, NOVEMBER, OCTOBER]) {
  tournamentsOfTeam.mockImplementation(async leagueTeamId => teams[leagueTeamId] ?? []);
  tournamentsOfLeague.mockImplementation(async () => league);
}

function check(now: Date = NIGHT) {
  return checkLeagueRegistrations({ now, pauseMs: 0 });
}

// The players a notification of that kind reached
async function toldOf(kind: 'LEAGUE_REGISTRATION_OPEN' | 'LEAGUE_REGISTRATION_CLOSING') {
  const entries = await prisma.notificationInboxEntry.findMany({ where: { notification: { kind } }, select: { playerId: true } });
  return entries.map(entry => entry.playerId).sort();
}

beforeEach(async () => {
  listPage.mockReset();
  tournamentsOfTeam.mockReset().mockResolvedValue([]);
  tournamentsOfLeague.mockReset().mockResolvedValue([]);
  await prisma.venue.create({ data: { slug: 'nimes', name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test' } });
});

describe('Checking the registrations to the local leagues', () => {
  it('tells those who manage a team not registered to the open month, once', async () => {
    const team = await linkedTeam('RONIN');
    const manager = await createTeamMember(team.token, team.team.id);
    await request(app)
      .put(`/api/teams/current/members/${manager.user.id}/permissions`)
      .set(authHeader(team.token))
      .send({ permissions: { ...DEFAULT_PLAYER_PERMISSIONS, team: { ...DEFAULT_PLAYER_PERMISSIONS.team, canManageTeam: true } } })
      .expect(200);
    await createTeamMember(team.token, team.team.id);
    siteLists({ [team.leagueTeamId]: [OCTOBER] });

    const report = await check();

    expect(report).toMatchObject({ teams: 1, leagues: 1, failed: 0, open: 1, registered: 0, openNotices: 1, closingNotices: 0 });
    expect(tournamentsOfLeague).toHaveBeenCalledWith(NIMES.id);
    expect(await toldOf('LEAGUE_REGISTRATION_OPEN')).toEqual([team.user.playerId, manager.playerId].sort());
    const notification = await prisma.notification.findFirstOrThrow({ where: { kind: 'LEAGUE_REGISTRATION_OPEN' } });
    expect(notification).toMatchObject({
      teamId: team.team.id,
      data: { tournamentId: NOVEMBER.id, tournamentName: 'NEMAUSUS LEAGUE - NOVEMBRE', closesAt: NOVEMBER_CLOSES },
    });
    expect(await prisma.leagueEntry.findUniqueOrThrow({ where: { teamId_tournamentId: { teamId: team.team.id, tournamentId: NOVEMBER.id } } }))
      .toMatchObject({ registeredAt: null, openNoticeAt: NIGHT, closingNoticeAt: null });

    expect((await check(new Date(NIGHT.getTime() + DAY_MS))).openNotices).toBe(0);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('gives the last reminder three days before the closing, once', async () => {
    const team = await linkedTeam('RONIN');
    siteLists({ [team.leagueTeamId]: [OCTOBER] });
    await check();
    const twoDaysBefore = new Date(Date.parse(NOVEMBER_CLOSES) - 2 * DAY_MS);

    expect(await check(twoDaysBefore)).toMatchObject({ openNotices: 0, closingNotices: 1 });
    expect((await check(new Date(twoDaysBefore.getTime() + DAY_MS))).closingNotices).toBe(0);
    expect(await toldOf('LEAGUE_REGISTRATION_CLOSING')).toEqual([team.user.playerId]);
  });

  it('gives a month first found in its last three days the last reminder alone', async () => {
    const team = await linkedTeam('RONIN');
    siteLists({ [team.leagueTeamId]: [OCTOBER] });

    const report = await check(new Date(Date.parse(NOVEMBER_CLOSES) - DAY_MS));

    expect(report).toMatchObject({ openNotices: 0, closingNotices: 1 });
    expect(await prisma.notification.count({ where: { kind: 'LEAGUE_REGISTRATION_OPEN' } })).toBe(0);
  });

  it('tells nothing to a registered team, and keeps when it was first found registered', async () => {
    const team = await linkedTeam('RONIN');
    siteLists({ [team.leagueTeamId]: [NOVEMBER, OCTOBER] });

    expect(await check()).toMatchObject({ open: 1, registered: 1, openNotices: 0, closingNotices: 0 });
    await check(new Date(NIGHT.getTime() + DAY_MS));

    expect(await prisma.notification.count()).toBe(0);
    expect((await prisma.leagueEntry.findFirstOrThrow({ where: { teamId: team.team.id } })).registeredAt).toEqual(NIGHT);
  });

  it('reads each league once, whatever the number of its teams', async () => {
    const first = await linkedTeam('RONIN');
    const second = await linkedTeam('Akuma');
    siteLists({ [first.leagueTeamId]: [OCTOBER], [second.leagueTeamId]: [NOVEMBER, OCTOBER] });

    const report = await check();

    expect(report).toMatchObject({ teams: 2, leagues: 1, open: 2, registered: 1, openNotices: 1 });
    expect(tournamentsOfLeague).toHaveBeenCalledTimes(1);
  });

  it('follows no team whose tournaments are played at none of our venues', async () => {
    const team = await linkedTeam('Les Occitans');
    siteLists({ [team.leagueTeamId]: [month('2570000000000000020', 'COUPE OCCITANIE', '2030-10-01', OCCITANIE, OCTOBER.registration)] });

    expect(await check()).toMatchObject({ teams: 1, leagues: 0, open: 0 });
    expect(tournamentsOfLeague).not.toHaveBeenCalled();
  });

  it('leaves a team the site could not read for the next night, and goes on with the others', async () => {
    const silent = await linkedTeam('Silent');
    const ronin = await linkedTeam('RONIN');
    siteLists({ [ronin.leagueTeamId]: [OCTOBER] });
    tournamentsOfTeam.mockImplementation(async leagueTeamId => {
      if (leagueTeamId === silent.leagueTeamId) throw new CompetitiveApiError('Tournament list refused: HTTP 503', 503);
      return [OCTOBER];
    });

    expect(await check()).toMatchObject({ teams: 1, failed: 1, openNotices: 1 });
    expect(await prisma.leagueEntry.count({ where: { teamId: silent.team.id } })).toBe(0);
  });

  it('takes no other league\'s month for this one\'s, and forgets a month a month after it closed', async () => {
    const team = await linkedTeam('RONIN');
    const elsewhere = month('2570000000000000030', 'AUTRE LIGUE - NOVEMBRE', '2030-11-01', OCCITANIE, NOVEMBER.registration);
    const september = month('2570000000000000009', 'NEMAUSUS LEAGUE - SEPTEMBRE', '2030-09-01', NIMES, { status: 'finished', opensAt: null, closesAt: '2030-09-29T22:00:00.000Z' });
    siteLists({ [team.leagueTeamId]: [OCTOBER] }, [elsewhere, NOVEMBER, OCTOBER, september]);

    expect(await check()).toMatchObject({ open: 1, removed: 0 });
    expect(await prisma.leagueTournament.findUnique({ where: { id: elsewhere.id } })).toBeNull();
    // Closed for longer than a month is kept: never kept at all
    expect(await prisma.leagueTournament.findUnique({ where: { id: september.id } })).toBeNull();

    siteLists({ [team.leagueTeamId]: [OCTOBER] }, []);
    const report = await check(new Date(Date.parse(NOVEMBER_CLOSES) + 31 * DAY_MS));
    expect(report.removed).toBe(2);
    expect(await prisma.leagueTournament.count()).toBe(0);
    expect(await prisma.leagueEntry.count()).toBe(0);
  });
});
