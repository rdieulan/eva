// Tests for finding a league team by its name: the directory searched once the
// player stops typing, the last text only, and each team listed the way the
// player knows it, with the team of ours it already is
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { LeagueTeamSummary } from '@shared/types';
import { searchLeagueTeams } from '@/api';
import LeagueTeamSearch from '@/components/team/LeagueTeamSearch.vue';

vi.mock('@/api', () => ({ searchLeagueTeams: vi.fn() }));

const RONIN: LeagueTeamSummary = { id: '1', name: 'RONIN', memberCount: 5, logoUrl: '/api/league-teams/1/logo?v=7', team: null };
const TWIN: LeagueTeamSummary = { id: '2', name: 'RONIN', memberCount: 1, logoUrl: null, team: { id: 'team-zero', name: 'zero' } };

async function type(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.get('input').setValue(text);
}

async function pause() {
  await vi.advanceTimersByTimeAsync(300);
  await flushPromises();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(searchLeagueTeams).mockReset().mockResolvedValue([RONIN, TWIN]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LeagueTeamSearch', () => {
  it('searches once the player stops typing, and lists each team as the player knows it', async () => {
    const wrapper = mount(LeagueTeamSearch);

    await type(wrapper, 'ronin');
    expect(searchLeagueTeams).not.toHaveBeenCalled();
    await pause();

    expect(searchLeagueTeams).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchLeagueTeams).mock.calls[0]![0]).toBe('ronin');
    const rows = wrapper.findAll('.league-search-result');
    expect(rows.map(row => row.find('.league-search-text').text())).toEqual(['RONIN5 membres', 'RONIN1 membreDéjà sur l\'application : zero']);
    // Known by its logo, or by its initials when it has none
    expect(rows[0]!.find('img').attributes('src')).toBe(RONIN.logoUrl);
    expect(rows[1]!.find('.team-logo-mark--initials').text()).toBe('R');
  });

  it('searches the last text typed only', async () => {
    const wrapper = mount(LeagueTeamSearch);

    await type(wrapper, 'ro');
    await vi.advanceTimersByTimeAsync(100);
    await type(wrapper, 'ron');
    await pause();

    expect(vi.mocked(searchLeagueTeams).mock.calls.map(([text]) => text)).toEqual(['ron']);
  });

  it('waits for a second letter, and says when no team answers', async () => {
    const wrapper = mount(LeagueTeamSearch);

    await type(wrapper, 'r');
    await pause();
    expect(searchLeagueTeams).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Encore une lettre');

    vi.mocked(searchLeagueTeams).mockResolvedValueOnce([]);
    await type(wrapper, 'zz');
    await pause();
    expect(wrapper.text()).toContain('Aucune équipe de ligue ne porte ce nom.');
  });

  it('says when the search failed', async () => {
    vi.mocked(searchLeagueTeams).mockRejectedValueOnce(new Error('down'));
    const wrapper = mount(LeagueTeamSearch);

    await type(wrapper, 'ronin');
    await pause();

    expect(wrapper.text()).toContain('La recherche n\'a pas abouti');
  });

  it('tells which team the player picked', async () => {
    const wrapper = mount(LeagueTeamSearch);
    await type(wrapper, 'ronin');
    await pause();

    await wrapper.findAll('.league-search-result')[1]!.trigger('click');

    expect(wrapper.emitted('select')).toEqual([[TWIN]]);
  });
});
