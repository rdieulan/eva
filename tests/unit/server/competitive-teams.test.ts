// @vitest-environment node
// Tests for reading the league teams of competitive.eva.gg: the list asked for
// page by page the way the site's own pages ask for it, each entry made fit to
// keep, and a logo taken only when it is an image a logo can be, not too large.
// Run under Node, as the server: fetch is stubbed, the site is never called.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CompetitiveApiError,
  fetchLeagueTeamLogo,
  fetchLeagueTeamsPage,
} from '../../../server/src/integrations/competitive/competitive-teams';

const RONIN = '2444500737328074751';

// An entry of the list, the way the site gives it
function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: RONIN,
    name: 'RONIN',
    discipline: 'after_humanity',
    playerOwner: { id: '2444271500114552831' },
    logo: { id: '2444500885940652031' },
    memberCount: 7,
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// A page of the list as the site answers it, from `offset` on
function page(items: unknown[], total = items.length, offset = 0): Response {
  return json({ items, range: { offset, length: items.length, total } });
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

// A body that comes in two parts, with no size announced
function streamed(...parts: Uint8Array[]): Response {
  return new Response(new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  }));
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchLeagueTeamsPage', () => {
  it('asks for a page of After-H teams by offset and limit, the way the site\'s pages do', async () => {
    fetchMock.mockResolvedValueOnce(page([entry()], 1163, 50));

    const result = await fetchLeagueTeamsPage(50);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://competitive.eva.gg/api/teams?discipline=after_humanity&offset=50&limit=50');
    expect(init.headers).toEqual({ accept: 'application/json' });
    expect(result).toEqual({
      teams: [{ id: RONIN, name: 'RONIN', memberCount: 7, logoId: '2444500885940652031' }],
      skipped: 0,
      total: 1163,
    });
  });

  it('keeps a name fit to show, a team with no logo as such, and nothing of who owns a team', async () => {
    fetchMock.mockResolvedValueOnce(page([entry({ name: ' Paradox \n', logo: null })]));

    const { teams } = await fetchLeagueTeamsPage(0);

    expect(teams).toEqual([{ id: RONIN, name: 'Paradox', memberCount: 7, logoId: null }]);
  });

  it('leaves out what is no team of the game, and counts it', async () => {
    fetchMock.mockResolvedValueOnce(page([
      entry({ id: '../admin' }),
      entry({ discipline: 'another_game' }),
      entry({ name: ' \u200B ' }),
      entry({ name: 42 }),
      null,
      'a team',
      entry({ id: '1', name: 'Kept' }),
    ]));

    const result = await fetchLeagueTeamsPage(0);

    expect(result.teams.map(team => team.name)).toEqual(['Kept']);
    expect(result.skipped).toBe(6);
  });

  it('reads an odd member count as none, an odd logo as none, and cuts an endless name', async () => {
    fetchMock.mockResolvedValueOnce(page([entry({ memberCount: -1, logo: { id: 'x' }, name: 'x'.repeat(200) })]));

    const [team] = (await fetchLeagueTeamsPage(0)).teams;

    expect(team).toMatchObject({ memberCount: 0, logoId: null });
    expect(team!.name).toHaveLength(80);
  });

  it('refuses a page from another place in the list than the one asked for', async () => {
    // A site that no longer reads the offset answers its first teams, again and again
    fetchMock.mockResolvedValueOnce(page([entry()], 1163, 0));

    await expect(fetchLeagueTeamsPage(50)).rejects.toBeInstanceOf(CompetitiveApiError);
  });

  it('fails on a refusal, an unreadable answer or no answer', async () => {
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 503 }));
    await expect(fetchLeagueTeamsPage(0)).rejects.toMatchObject({ name: 'CompetitiveApiError', status: 503 });

    fetchMock.mockResolvedValueOnce(json({ items: 'none' }));
    await expect(fetchLeagueTeamsPage(0)).rejects.toBeInstanceOf(CompetitiveApiError);

    fetchMock.mockResolvedValueOnce(new Response('<html>maintenance</html>'));
    await expect(fetchLeagueTeamsPage(0)).rejects.toBeInstanceOf(CompetitiveApiError);

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(fetchLeagueTeamsPage(0)).rejects.toBeInstanceOf(CompetitiveApiError);
  });
});

describe('fetchLeagueTeamLogo', () => {
  it('takes a team\'s logo in the size asked for, typed by what it really is', async () => {
    fetchMock.mockResolvedValueOnce(new Response(PNG, { headers: { 'Content-Type': 'image/jpeg' } }));

    const logo = await fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024);

    expect(fetchMock.mock.calls[0]![0]).toBe(`https://competitive.eva.gg/api/teams/${RONIN}/logo/logo_medium`);
    expect(logo.type).toBe('image/png');
    expect([...logo.data]).toEqual([...PNG]);
  });

  it('reads a logo that comes in parts', async () => {
    fetchMock.mockResolvedValueOnce(streamed(PNG.slice(0, 5), PNG.slice(5)));

    expect([...(await fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024)).data]).toEqual([...PNG]);
  });

  it('refuses what is not a PNG, JPEG or WebP image, whatever the site declares', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<svg onload="alert(1)"/>', { headers: { 'Content-Type': 'image/png' } }));

    await expect(fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024)).rejects.toBeInstanceOf(CompetitiveApiError);
  });

  it('refuses a logo larger than allowed, whether it says so or not', async () => {
    fetchMock.mockResolvedValueOnce(new Response(PNG, { headers: { 'Content-Length': '5000' } }));
    await expect(fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024)).rejects.toBeInstanceOf(CompetitiveApiError);

    fetchMock.mockResolvedValueOnce(streamed(PNG, new Uint8Array(1020)));
    await expect(fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024)).rejects.toBeInstanceOf(CompetitiveApiError);
  });

  it('refuses a logo handed over to an unencrypted address', async () => {
    const response = new Response(PNG);
    Object.defineProperty(response, 'url', { value: 'http://cdn.example/logo.png' });
    fetchMock.mockResolvedValueOnce(response);

    await expect(fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024)).rejects.toBeInstanceOf(CompetitiveApiError);
  });

  it('fails on a refusal, and never calls the site for what is no team id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(fetchLeagueTeamLogo(RONIN, 'logo_medium', 1024)).rejects.toMatchObject({ status: 404 });

    fetchMock.mockClear();
    await expect(fetchLeagueTeamLogo('../../admin', 'logo_medium', 1024)).rejects.toBeInstanceOf(CompetitiveApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
