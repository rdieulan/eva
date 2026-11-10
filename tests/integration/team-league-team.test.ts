// Integration tests - A team and its league team of competitive.eva.gg: made
// from the directory (named after it, its logo copied, linked to it), or an
// existing team linked to it from its page; one team of ours for each
//
// competitive.eva.gg is never called: the list and the logos are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma, expectNoRecordCreated } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { TEAM_LOGO_MAX_BYTES } from '@shared/constants/team.constants';
import {
  CompetitiveApiError,
  fetchLeagueTeamLogo,
  fetchLeagueTeamTournaments,
  fetchLeagueTeamsPage,
  type LeagueTeamEntry,
} from '../../server/src/integrations/competitive/competitive-teams';
import { syncLeagueDirectory } from '../../server/src/services/league-directory.service';

vi.mock('../../server/src/integrations/competitive/competitive-teams', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/competitive/competitive-teams')>(),
  fetchLeagueTeamsPage: vi.fn(),
  fetchLeagueTeamLogo: vi.fn(),
  fetchLeagueTeamTournaments: vi.fn(),
}));

const listPage = vi.mocked(fetchLeagueTeamsPage);
const logoOf = vi.mocked(fetchLeagueTeamLogo);
const tournamentsOf = vi.mocked(fetchLeagueTeamTournaments);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const OWN_LOGO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);

let lastId = 2444600000000000000n;
function leagueTeam(name: string, overrides: Partial<LeagueTeamEntry> = {}): LeagueTeamEntry {
  lastId += 1n;
  return { id: String(lastId), name, memberCount: 5, logoId: null, ...overrides };
}

// The directory holds these league teams, read on that night
async function directoryHolds(teams: LeagueTeamEntry[], now?: Date) {
  listPage.mockImplementation(async offset => ({ teams: teams.slice(offset, offset + 50), skipped: 0, total: teams.length }));
  await syncLeagueDirectory({ now, pauseMs: 0 });
}

function createTeam(token: string, body: Record<string, unknown>) {
  return request(app).post('/api/teams').set(authHeader(token)).send(body);
}

function linkTeam(token: string, leagueTeamId: string | null) {
  return request(app).put('/api/teams/current/league-team').set(authHeader(token)).send({ leagueTeamId });
}

// A month of a local league the team was read in, as a night leaves it
async function leagueMonthRead(teamId: string, tournamentId: string) {
  await prisma.leagueTournament.create({
    data: { id: tournamentId, name: 'NEMAUSUS LEAGUE - JUILLET', regionId: 'region-nimes', registrationClosesAt: new Date('2030-06-29T22:00:00Z'), seenAt: new Date() },
  });
  await prisma.leagueEntry.create({ data: { teamId, tournamentId, openNoticeAt: new Date(), checkedAt: new Date() } });
}

function leagueEntriesOf(teamId: string) {
  return prisma.leagueEntry.count({ where: { teamId } });
}

beforeEach(() => {
  listPage.mockReset();
  logoOf.mockReset();
  tournamentsOf.mockReset().mockResolvedValue([]);
});

describe('POST /api/teams from a league team', () => {
  it('makes the team linked to its league team, with the league logo in its largest size', async () => {
    const ronin = leagueTeam('RONIN', { logoId: '77' });
    await directoryHolds([ronin]);
    logoOf.mockResolvedValueOnce({ data: PNG, type: 'image/png' });
    const { token } = await createAuthenticatedUser();

    const res = await createTeam(token, { name: 'RONIN Esport', leagueTeamId: ronin.id });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'RONIN Esport', isLeader: true, logoCopied: true });
    expect(res.body.logoUrl).toMatch(new RegExp(`^/api/teams/${res.body.id}/logo\\?v=\\d+$`));
    expect(res.body).not.toHaveProperty('logoData');
    expect(logoOf).toHaveBeenCalledWith(ronin.id, 'logo_large', TEAM_LOGO_MAX_BYTES);

    const team = await prisma.team.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(team).toMatchObject({ leagueTeamId: ronin.id, logoType: 'image/png' });
    const current = await request(app).get('/api/teams/current').set(authHeader(token));
    expect(current.body.leagueTeam).toEqual({
      id: ronin.id,
      name: 'RONIN',
      memberCount: 5,
      logoUrl: `/api/league-teams/${ronin.id}/logo?v=77`,
      team: { id: res.body.id, name: 'RONIN Esport' },
    });
  });

  it('goes on without the logo when the site cannot give it, and says so', async () => {
    const ronin = leagueTeam('RONIN', { logoId: '77' });
    await directoryHolds([ronin]);
    logoOf.mockRejectedValueOnce(new CompetitiveApiError('Logo refused: HTTP 503', 503));
    const { token } = await createAuthenticatedUser();

    const res = await createTeam(token, { name: 'RONIN', leagueTeamId: ronin.id });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ logoCopied: false, logoUrl: null });
    expect((await prisma.team.findUniqueOrThrow({ where: { id: res.body.id } })).leagueTeamId).toBe(ronin.id);
  });

  it('says nothing of a logo for a league team that has none, and never asks the site', async () => {
    const plain = leagueTeam('Plain');
    await directoryHolds([plain]);
    const { token } = await createAuthenticatedUser();

    const res = await createTeam(token, { name: 'Plain', leagueTeamId: plain.id });

    expect(res.body).toMatchObject({ logoCopied: null, logoUrl: null });
    expect(logoOf).not.toHaveBeenCalled();
  });

  it('makes a team without a league team as before: no logo, nothing linked', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await createTeam(token, { name: 'Les Faucons' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Les Faucons', logoCopied: null, logoUrl: null, venueId: null, favoriteVenueIds: [] });
    expect((await prisma.team.findUniqueOrThrow({ where: { id: res.body.id } })).leagueTeamId).toBeNull();
  });

  it('refuses a league team another team is, or one the directory does not hold, and makes nothing', async () => {
    const ronin = leagueTeam('RONIN');
    await directoryHolds([ronin]);
    const first = await createAuthenticatedUser();
    await createTeam(first.token, { name: 'RONIN', leagueTeamId: ronin.id }).expect(201);
    const second = await createAuthenticatedUser();

    for (const [leagueTeamId, status, error] of [[ronin.id, 409, ERROR.leagueTeamTaken], ['999', 404, ERROR.leagueTeamNotFound]] as const) {
      const res = await expectNoRecordCreated(() => prisma.team.count(), () => createTeam(second.token, { name: 'RONIN bis', leagueTeamId }));
      expect(res.status).toBe(status);
      expect(res.body.errors).toContain(error);
    }
    expect((await prisma.player.findUniqueOrThrow({ where: { id: second.user.playerId } })).teamId).toBeNull();
  });

  it('keeps the venue chosen at creation, and refuses one that does not exist', async () => {
    const venue = await prisma.venue.create({ data: { slug: 'nimes', name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test' } });
    const { token } = await createAuthenticatedUser();

    const unknown = await createTeam(token, { name: 'Les Faucons', venueId: 'nowhere' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.errors).toContain(ERROR.venueNotFound);

    const res = await createTeam(token, { name: 'Les Faucons', venueId: venue.id });
    expect(res.body.venueId).toBe(venue.id);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: res.body.id } })).venueId).toBe(venue.id);
  });

  it('refuses ids that are not ids', async () => {
    const { token } = await createAuthenticatedUser();

    for (const body of [{ name: 'X Team', leagueTeamId: 42 }, { name: 'X Team', venueId: '' }]) {
      const res = await createTeam(token, body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.invalidRequest);
    }
  });

  it('shows in the directory which team of ours a league team is', async () => {
    const ronin = leagueTeam('RONIN');
    await directoryHolds([ronin, leagueTeam('Ronin Esport')]);
    const { token } = await createAuthenticatedUser();
    const team = (await createTeam(token, { name: 'Les Ronins', leagueTeamId: ronin.id })).body;

    const res = await request(app).get('/api/league-teams').query({ q: 'ronin' }).set(authHeader(token));

    expect(res.body.teams.map((found: { name: string; team: unknown }) => [found.name, found.team]))
      .toEqual([['RONIN', { id: team.id, name: 'Les Ronins' }], ['Ronin Esport', null]]);
    expect((await request(app).get(`/api/league-teams/${ronin.id}`).set(authHeader(token))).body.team).toEqual({ id: team.id, name: 'Les Ronins' });
  });
});

describe('PUT /api/teams/current/league-team', () => {
  it('links the team, taking the league logo when the team has none of its own', async () => {
    const ronin = leagueTeam('RONIN', { logoId: '77' });
    await directoryHolds([ronin]);
    logoOf.mockResolvedValueOnce({ data: PNG, type: 'image/png' });
    const { token, team } = await createUserWithTeam();

    const res = await linkTeam(token, ronin.id);

    expect(res.status).toBe(200);
    expect(res.body.leagueTeam).toMatchObject({ id: ronin.id, name: 'RONIN', team: { id: team.id } });
    expect(res.body.logoUrl).toMatch(new RegExp(`^/api/teams/${team.id}/logo\\?v=\\d+$`));
    expect(await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).toMatchObject({ leagueTeamId: ronin.id, logoType: 'image/png' });
    expect(logoOf).toHaveBeenCalledWith(ronin.id, 'logo_large', TEAM_LOGO_MAX_BYTES);
  });

  it('gives a team with no venue the venue of its local league, and leaves a venue chosen be', async () => {
    const nimes = await prisma.venue.create({ data: { slug: 'nimes', name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test' } });
    const avignon = await prisma.venue.create({ data: { slug: 'avignon', name: 'Avignon', city: 'Avignon', address: '2 rue du Test' } });
    const ronin = leagueTeam('RONIN');
    const other = leagueTeam('Other');
    await directoryHolds([ronin, other]);
    tournamentsOf.mockResolvedValue([{
      id: '2570489683180220415',
      name: 'NEMAUSUS LEAGUE - NOVEMBRE',
      startsOn: '2026-11-01',
      region: { id: '2395742493876512767', name: 'NÎMES', machineName: 'nimes' },
      registration: { status: 'open', opensAt: null, closesAt: null },
    }]);
    const withoutVenue = await createUserWithTeam();
    const withVenue = await createUserWithTeam();
    await prisma.team.update({ where: { id: withVenue.team.id }, data: { venueId: avignon.id } });

    const linked = await linkTeam(withoutVenue.token, ronin.id);
    await linkTeam(withVenue.token, other.id).expect(200);

    expect(linked.body.venueId).toBe(nimes.id);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: withoutVenue.team.id } })).venueId).toBe(nimes.id);
    expect((await prisma.team.findUniqueOrThrow({ where: { id: withVenue.team.id } })).venueId).toBe(avignon.id);
    expect(tournamentsOf).toHaveBeenCalledTimes(1);
  });

  it('keeps the logo the team has', async () => {
    const ronin = leagueTeam('RONIN', { logoId: '77' });
    await directoryHolds([ronin]);
    const { token, team } = await createUserWithTeam();
    await request(app).put('/api/teams/current/logo').set(authHeader(token)).set('Content-Type', 'image/jpeg').send(OWN_LOGO).expect(200);

    await linkTeam(token, ronin.id).expect(200);

    expect(logoOf).not.toHaveBeenCalled();
    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).logoType).toBe('image/jpeg');
  });

  it('changes the link, freeing the league team left, and removes it', async () => {
    const first = leagueTeam('First');
    const second = leagueTeam('Second');
    await directoryHolds([first, second]);
    const { token, team } = await createUserWithTeam();
    await linkTeam(token, first.id).expect(200);

    await linkTeam(token, second.id).expect(200);
    expect((await request(app).get(`/api/league-teams/${first.id}`).set(authHeader(token))).body.team).toBeNull();

    const removed = await linkTeam(token, null);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ leagueTeam: null, logoUrl: null, venueId: null });
    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).leagueTeamId).toBeNull();
  });

  it('drops what was read of the league registrations with the link it was read for', async () => {
    const first = leagueTeam('First');
    const second = leagueTeam('Second');
    await directoryHolds([first, second]);
    const { token, team } = await createUserWithTeam();
    await linkTeam(token, first.id).expect(200);
    await leagueMonthRead(team.id, '2570000000000000201');

    await linkTeam(token, first.id).expect(200);
    expect(await leagueEntriesOf(team.id)).toBe(1);

    await linkTeam(token, second.id).expect(200);
    expect(await leagueEntriesOf(team.id)).toBe(0);

    await leagueMonthRead(team.id, '2570000000000000202');
    await linkTeam(token, null).expect(200);
    expect(await leagueEntriesOf(team.id)).toBe(0);
  });

  it('refuses a league team another team is, and one the directory does not hold', async () => {
    const ronin = leagueTeam('RONIN');
    await directoryHolds([ronin]);
    const owner = await createUserWithTeam();
    await linkTeam(owner.token, ronin.id).expect(200);
    const other = await createUserWithTeam();

    const taken = await linkTeam(other.token, ronin.id);
    expect(taken.status).toBe(409);
    expect(taken.body.errors).toContain(ERROR.leagueTeamTaken);
    const unknown = await linkTeam(other.token, '999');
    expect(unknown.status).toBe(404);
    expect(unknown.body.errors).toContain(ERROR.leagueTeamNotFound);
    expect((await linkTeam(other.token, undefined as unknown as null)).status).toBe(400);
  });

  it('is for those who manage the team', async () => {
    const ronin = leagueTeam('RONIN');
    await directoryHolds([ronin]);
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id);

    expect((await linkTeam(member.token, ronin.id)).status).toBe(403);
  });

  it('leaves the team unlinked once its league team has left the directory', async () => {
    const ronin = leagueTeam('RONIN');
    const night = (day: number) => new Date(Date.UTC(2030, 0, 1 + day, 3));
    await directoryHolds([ronin], night(0));
    const { token, team } = await createUserWithTeam();
    await linkTeam(token, ronin.id).expect(200);
    await leagueMonthRead(team.id, '2570000000000000203');

    await directoryHolds([leagueTeam('Another')], night(8));

    expect((await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).leagueTeamId).toBeNull();
    expect((await request(app).get('/api/teams/current').set(authHeader(token))).body.leagueTeam).toBeNull();
    expect(await leagueEntriesOf(team.id)).toBe(0);
  });
});
