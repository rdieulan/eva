// Tests for the league team of the team, on the team page: linked from the
// search by whoever manages the team, changed, unlinked; seen by the others
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { LeagueTeamSummary } from '@shared/types';
import { ERROR } from '@shared/constants';
import { setTeamLeagueTeam } from '@/api';
import TeamLeague from '@/components/team/TeamLeague.vue';

vi.mock('@/api', () => ({ setTeamLeagueTeam: vi.fn() }));

const TEAM_ID = 'team-zero';
const RONIN: LeagueTeamSummary = { id: '1', name: 'RONIN', memberCount: 5, logoUrl: null, team: { id: TEAM_ID, name: 'zero' } };
const FREE: LeagueTeamSummary = { id: '2', name: 'Akuma', memberCount: 3, logoUrl: null, team: null };
const TAKEN: LeagueTeamSummary = { id: '3', name: 'Rivaux', memberCount: 4, logoUrl: null, team: { id: 'team-rivaux', name: 'Les Rivaux' } };

const SearchStub = defineComponent({
  name: 'LeagueTeamSearch',
  emits: ['select'],
  setup(_, { emit }) {
    return () => h('div', { class: 'search' }, [FREE, TAKEN].map(team => h('button', { class: `pick-${team.id}`, onClick: () => emit('select', team) }, team.name)));
  },
});

function mountLeague(props: { leagueTeam: LeagueTeamSummary | null; canManage: boolean }) {
  return mount(TeamLeague, { props: { teamId: TEAM_ID, ...props }, global: { stubs: { LeagueTeamSearch: SearchStub } } });
}

function button(wrapper: ReturnType<typeof mountLeague>, label: string) {
  return wrapper.findAll('button').find(candidate => candidate.text() === label);
}

beforeEach(() => {
  vi.mocked(setTeamLeagueTeam).mockReset();
});

describe('TeamLeague', () => {
  it('links the team to the league team picked, its logo and venue following', async () => {
    const link = { leagueTeam: { ...FREE, team: { id: TEAM_ID, name: 'zero' } }, logoUrl: '/api/teams/team-zero/logo?v=1', venueId: 'venue-nimes' };
    vi.mocked(setTeamLeagueTeam).mockResolvedValueOnce(link);
    const wrapper = mountLeague({ leagueTeam: null, canManage: true });

    await wrapper.get('.pick-2').trigger('click');
    await flushPromises();

    expect(setTeamLeagueTeam).toHaveBeenCalledWith('2');
    expect(wrapper.emitted('changed')).toEqual([[link]]);
  });

  it('says at once that another team of ours is the league team picked', async () => {
    const wrapper = mountLeague({ leagueTeam: null, canManage: true });

    await wrapper.get('.pick-3').trigger('click');

    expect(setTeamLeagueTeam).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(ERROR.leagueTeamTaken);
  });

  it('shows the league team linked, to change or to unlink', async () => {
    vi.mocked(setTeamLeagueTeam).mockResolvedValueOnce({ leagueTeam: null, logoUrl: null, venueId: null });
    const wrapper = mountLeague({ leagueTeam: RONIN, canManage: true });
    expect(wrapper.text()).toContain('RONIN');
    expect(wrapper.find('.search').exists()).toBe(false);

    await button(wrapper, 'Changer')!.trigger('click');
    expect(wrapper.find('.search').exists()).toBe(true);
    await button(wrapper, 'Annuler')!.trigger('click');

    await button(wrapper, 'Délier')!.trigger('click');
    await flushPromises();
    expect(setTeamLeagueTeam).toHaveBeenCalledWith(null);
    expect(wrapper.emitted('changed')).toEqual([[{ leagueTeam: null, logoUrl: null, venueId: null }]]);
  });

  it('lets the others see it, and nothing more', () => {
    const linked = mountLeague({ leagueTeam: RONIN, canManage: false });
    expect(linked.text()).toContain('RONIN');
    expect(linked.findAll('button')).toHaveLength(0);

    const unlinked = mountLeague({ leagueTeam: null, canManage: false });
    expect(unlinked.text()).toContain('L\'équipe n\'est reliée à aucune équipe de ligue.');
    expect(unlinked.find('.search').exists()).toBe(false);
  });
});
