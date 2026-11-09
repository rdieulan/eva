// Integration tests - The directory of the league teams of competitive.eva.gg:
// the site's list read into it, the hours it is read again at, the search by
// name, and the logos copied the first time they show
//
// competitive.eva.gg is never called: the list and the logos are mocked, each
// test deciding what the site holds.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { LEAGUE_SEARCH_MAX_LENGTH } from '@shared/constants/league.constants';
import { TEAM_LOGO_MAX_BYTES } from '@shared/constants/team.constants';
import {
  CompetitiveApiError,
  fetchLeagueTeamLogo,
  fetchLeagueTeamsPage,
  type LeagueTeamEntry,
  type LeagueTeamLogo,
} from '../../server/src/integrations/competitive/competitive-teams';
import { isLeagueDirectoryDue, syncLeagueDirectory } from '../../server/src/services/league-directory.service';

vi.mock('../../server/src/integrations/competitive/competitive-teams', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/competitive/competitive-teams')>(),
  fetchLeagueTeamsPage: vi.fn(),
  fetchLeagueTeamLogo: vi.fn(),
}));

const listPage = vi.mocked(fetchLeagueTeamsPage);
const logoOf = vi.mocked(fetchLeagueTeamLogo);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

// Ids the way the site writes them: long numbers, a new one for each team
let lastId = 2444500000000000000n;
function team(name: string, overrides: Partial<LeagueTeamEntry> = {}): LeagueTeamEntry {
  lastId += 1n;
  return { id: String(lastId), name, memberCount: 5, logoId: null, ...overrides };
}

function teams(count: number, name = 'Team'): LeagueTeamEntry[] {
  return Array.from({ length: count }, (_, index) => team(`${name} ${index}`));
}

// The site lists these teams from now on, 50 a page as it serves them
function siteLists(list: LeagueTeamEntry[]) {
  listPage.mockImplementation(async offset => ({ teams: list.slice(offset, offset + 50), skipped: 0, total: list.length }));
}

function readList(list: LeagueTeamEntry[], now?: Date) {
  siteLists(list);
  return syncLeagueDirectory({ now, pauseMs: 0 });
}

function search(token: string, q?: string) {
  return request(app).get('/api/league-teams').query(q === undefined ? {} : { q }).set(authHeader(token));
}

function logo(token: string, leagueTeam: LeagueTeamEntry) {
  return request(app).get(`/api/league-teams/${leagueTeam.id}/logo?v=${leagueTeam.logoId}`).set(authHeader(token));
}

function served(data: Uint8Array, type: LeagueTeamLogo['type']): LeagueTeamLogo {
  return { data, type };
}

beforeEach(() => {
  listPage.mockReset();
  logoOf.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Reading the list into the directory', () => {
  it('reads the list page after page and keeps each team as it is named there', async () => {
    const list = teams(120);
    list[0] = { ...list[0]!, name: 'Les Rōnins', logoId: '77', memberCount: 7 };

    const report = await readList(list);

    expect(listPage.mock.calls.map(([offset]) => offset)).toEqual([0, 50, 100]);
    expect(report).toEqual({ pages: 3, teams: 120, skipped: 0, added: 120, changed: 0, removed: 0 });
    expect(await prisma.leagueTeam.count()).toBe(120);
    expect(await prisma.leagueTeam.findUniqueOrThrow({ where: { id: list[0]!.id } })).toMatchObject({
      name: 'Les Rōnins',
      searchName: 'les ronins',
      memberCount: 7,
      logoId: '77',
      logoData: null,
    });
  });

  it('brings in a new name, a new logo, another member count, and leaves the rest be', async () => {
    const ronin = team('RONIN', { logoId: '77' });
    const akuma = team('Akuma');
    await readList([ronin, akuma]);

    const report = await readList([{ ...ronin, name: 'RONIN Esport', logoId: '78', memberCount: 8 }, akuma]);

    expect(report).toMatchObject({ added: 0, changed: 1, removed: 0 });
    expect(await prisma.leagueTeam.findUniqueOrThrow({ where: { id: ronin.id } })).toMatchObject({
      name: 'RONIN Esport',
      searchName: 'ronin esport',
      logoId: '78',
      memberCount: 8,
    });
  });

  it('keeps a team missing from the list a week, then lets it go', async () => {
    const kept = team('Kept');
    const gone = team('Gone');
    const night = (day: number) => new Date(Date.UTC(2030, 0, 1 + day, 3));
    await readList([kept, gone], night(0));

    expect((await readList([kept], night(3))).removed).toBe(0);
    expect(await prisma.leagueTeam.findUnique({ where: { id: gone.id } })).not.toBeNull();

    expect((await readList([kept], night(8))).removed).toBe(1);
    expect(await prisma.leagueTeam.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await prisma.leagueTeam.findUnique({ where: { id: kept.id } })).not.toBeNull();
  });

  it('changes nothing when the list fails on the way', async () => {
    const list = teams(60);
    const firstRead = new Date('2030-01-01T03:00:00Z');
    await readList(list, firstRead);
    listPage.mockReset();
    listPage
      .mockResolvedValueOnce({ teams: [team('Newcomer'), ...list.slice(1, 50)], skipped: 0, total: 60 })
      .mockRejectedValueOnce(new CompetitiveApiError('Team list refused: HTTP 503', 503));

    await expect(syncLeagueDirectory({ now: new Date('2030-01-02T03:00:00Z'), pauseMs: 0 })).rejects.toBeInstanceOf(CompetitiveApiError);

    expect(await prisma.leagueTeam.count()).toBe(60);
    expect(await prisma.leagueTeam.count({ where: { seenAt: firstRead } })).toBe(60);
  });

  it('stops at the first page of a list far longer than it can be', async () => {
    listPage.mockResolvedValue({ teams: teams(50), skipped: 0, total: 6000 });

    await expect(syncLeagueDirectory({ pauseMs: 0 })).rejects.toBeInstanceOf(CompetitiveApiError);

    expect(listPage).toHaveBeenCalledTimes(1);
    expect(await prisma.leagueTeam.count()).toBe(0);
  });

  it('reads each page from where the one before stopped, however many teams the site gives in it', async () => {
    const list = teams(45);
    listPage.mockImplementation(async offset => ({ teams: list.slice(offset, offset + 20), skipped: 0, total: list.length }));

    const report = await syncLeagueDirectory({ pauseMs: 0 });

    expect(listPage.mock.calls.map(([offset]) => offset)).toEqual([0, 20, 40]);
    expect(report).toMatchObject({ pages: 3, teams: 45 });
  });

  it('stops a list that never ends, at a hundred pages, and changes nothing', async () => {
    listPage.mockImplementation(async () => ({ teams: [team('One more')], skipped: 0, total: 4000 }));

    await expect(syncLeagueDirectory({ pauseMs: 0 })).rejects.toBeInstanceOf(CompetitiveApiError);

    expect(listPage).toHaveBeenCalledTimes(100);
    expect(await prisma.leagueTeam.count()).toBe(0);
  });

  it('ends with a list that ends before the total it announced', async () => {
    listPage
      .mockResolvedValueOnce({ teams: teams(50), skipped: 2, total: 120 })
      .mockResolvedValueOnce({ teams: [], skipped: 0, total: 120 });

    expect(await syncLeagueDirectory({ pauseMs: 0 })).toMatchObject({ pages: 2, teams: 50, skipped: 2 });
  });
});

describe('When the list is read again', () => {
  it('at once on a new database, whatever the hour', async () => {
    expect(await isLeagueDirectoryDue(new Date('2030-01-15T13:00:00Z'))).toBe(true);
  });

  it('once a night, in the small hours of Paris', async () => {
    // Paris is an hour ahead of UTC in winter: 03:30 UTC is 4:30 there
    await readList([team('One')], new Date('2030-01-14T03:30:00Z'));

    expect(await isLeagueDirectoryDue(new Date('2030-01-14T05:30:00Z'))).toBe(false); // Read two hours ago
    expect(await isLeagueDirectoryDue(new Date('2030-01-14T22:00:00Z'))).toBe(false); // Read today, and 23:00 in Paris
    expect(await isLeagueDirectoryDue(new Date('2030-01-15T03:30:00Z'))).toBe(true);  // The next night, 4:30
    expect(await isLeagueDirectoryDue(new Date('2030-01-15T05:59:00Z'))).toBe(true);  // 6:59, a failed read retried
    expect(await isLeagueDirectoryDue(new Date('2030-01-15T06:00:00Z'))).toBe(false); // 7:00, the night is over
    expect(await isLeagueDirectoryDue(new Date('2030-01-15T13:00:00Z'))).toBe(false); // Never in the day
  });

  it('on Paris time in summer too', async () => {
    // Two hours ahead in summer: 02:30 UTC is 4:30 in Paris, 01:30 UTC is 3:30
    await readList([team('One')], new Date('2030-07-01T02:30:00Z'));

    expect(await isLeagueDirectoryDue(new Date('2030-07-02T01:30:00Z'))).toBe(false);
    expect(await isLeagueDirectoryDue(new Date('2030-07-02T02:30:00Z'))).toBe(true);
  });
});

describe('GET /api/league-teams', () => {
  it('is for signed-in players only', async () => {
    const res = await request(app).get('/api/league-teams').query({ q: 'ronin' });

    expect(res.status).toBe(401);
  });

  it('finds a team by its name, accents, case and punctuation aside, the best answers first', async () => {
    const { token } = await createAuthenticatedUser();
    const ronin = team('RONIN', { logoId: '77', memberCount: 7 });
    const twin = team('Rōnin');
    await readList([team('Kaironin'), team('The Ronins'), team('Ronin-Esport'), twin, ronin, team('Akuma')]);

    const res = await search(token, 'RONIN');

    expect(res.status).toBe(200);
    expect(res.body.teams.map((found: { name: string }) => found.name))
      .toEqual(['RONIN', 'Rōnin', 'Ronin-Esport', 'The Ronins', 'Kaironin']);
    expect(res.body.teams[0]).toEqual({ id: ronin.id, name: 'RONIN', memberCount: 7, logoUrl: `/api/league-teams/${ronin.id}/logo?v=77` });
    expect(res.body.teams[1]).toEqual({ id: twin.id, name: 'Rōnin', memberCount: 5, logoUrl: null });
  });

  it('lists ten teams at most', async () => {
    const { token } = await createAuthenticatedUser();
    await readList(teams(15, 'Faucons'));

    expect((await search(token, 'faucons')).body.teams).toHaveLength(10);
  });

  it('answers nothing to a search too short to mean anything', async () => {
    const { token } = await createAuthenticatedUser();
    await readList([team('RONIN')]);

    for (const q of ['', 'r', ' ! - ']) {
      const res = await search(token, q);
      expect(res.status).toBe(200);
      expect(res.body.teams).toEqual([]);
    }
  });

  it('refuses a search longer than any name, or none at all', async () => {
    const { token } = await createAuthenticatedUser();

    for (const res of [await search(token, 'x'.repeat(LEAGUE_SEARCH_MAX_LENGTH + 1)), await search(token)]) {
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.leagueSearchInvalid);
    }
  });
});

describe('GET /api/league-teams/:id/logo', () => {
  it('is for signed-in players only: the site is never called for whoever asks', async () => {
    const ronin = team('RONIN', { logoId: '77' });
    await readList([ronin]);

    const res = await request(app).get(`/api/league-teams/${ronin.id}/logo`);

    expect(res.status).toBe(401);
    expect(logoOf).not.toHaveBeenCalled();
  });

  it('copies a logo from the site the first time it shows, then serves the copy', async () => {
    const { token } = await createAuthenticatedUser();
    const ronin = team('RONIN', { logoId: '77' });
    await readList([ronin]);
    logoOf.mockResolvedValueOnce(served(PNG, 'image/png'));

    const first = await logo(token, ronin);

    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toBe('image/png');
    expect(first.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(Buffer.compare(first.body as Buffer, PNG)).toBe(0);
    expect(logoOf).toHaveBeenCalledWith(ronin.id, 'logo_medium', TEAM_LOGO_MAX_BYTES);

    const again = await logo(token, ronin);
    expect(Buffer.compare(again.body as Buffer, PNG)).toBe(0);
    expect(logoOf).toHaveBeenCalledTimes(1);
  });

  it('copies it again once the team shows a new logo', async () => {
    const { token } = await createAuthenticatedUser();
    const ronin = team('RONIN', { logoId: '77' });
    await readList([ronin]);
    logoOf.mockResolvedValueOnce(served(PNG, 'image/png'));
    await logo(token, ronin).expect(200);

    const renewed = { ...ronin, logoId: '78' };
    await readList([renewed]);
    logoOf.mockResolvedValueOnce(served(WEBP, 'image/webp'));
    const res = await logo(token, renewed);

    expect(res.headers['content-type']).toBe('image/webp');
    expect(Buffer.compare(res.body as Buffer, WEBP)).toBe(0);
    expect(logoOf).toHaveBeenCalledTimes(2);
  });

  it('answers none for a team with no logo, or no such team, without calling the site', async () => {
    const { token } = await createAuthenticatedUser();
    const plain = team('Plain');
    await readList([plain]);

    for (const res of [await logo(token, plain), await request(app).get('/api/league-teams/123/logo').set(authHeader(token))]) {
      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.leagueTeamLogoNotFound);
    }
    expect(logoOf).not.toHaveBeenCalled();
  });

  it('answers none when the site fails, and does not ask it again for a quarter of an hour', async () => {
    const { token } = await createAuthenticatedUser();
    const ronin = team('RONIN', { logoId: '77' });
    await readList([ronin]);
    logoOf.mockRejectedValue(new CompetitiveApiError('Logo refused: HTTP 503', 503));

    expect((await logo(token, ronin)).status).toBe(404);
    expect((await logo(token, ronin)).status).toBe(404);
    expect(logoOf).toHaveBeenCalledTimes(1);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    logoOf.mockResolvedValueOnce(served(PNG, 'image/png'));

    expect((await logo(token, ronin)).status).toBe(200);
    expect(logoOf).toHaveBeenCalledTimes(2);
  });

  it('asks the site once for two players showing it at once', async () => {
    const { token } = await createAuthenticatedUser();
    const ronin = team('RONIN', { logoId: '77' });
    await readList([ronin]);
    let answer!: (logo: LeagueTeamLogo) => void;
    logoOf.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));

    const both = Promise.all([logo(token, ronin), logo(token, ronin)]);
    await vi.waitFor(() => expect(logoOf).toHaveBeenCalledTimes(1));
    // Time for the second to come while the first read is under way
    await new Promise(resolve => setTimeout(resolve, 150));
    answer(served(PNG, 'image/png'));

    expect((await both).map(res => res.status)).toEqual([200, 200]);
    expect(logoOf).toHaveBeenCalledTimes(1);
  });
});
