// Tests for finding one's team through its league team: once picked, made when
// no team of ours is it yet, or asked to join when one is; and picked again
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { LeagueTeamSummary, MyJoinRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { sendJoinRequest } from '@/api';
import { ApiError } from '@/api/error';
import LeagueTeamFinder from '@/components/team/LeagueTeamFinder.vue';

vi.mock('@/api', () => ({ sendJoinRequest: vi.fn() }));

const FREE: LeagueTeamSummary = { id: '1', name: 'RONIN', memberCount: 5, logoUrl: null, team: null };
const OURS: LeagueTeamSummary = { id: '2', name: 'RONIN', memberCount: 4, logoUrl: null, team: { id: 'team-zero', name: 'zero' } };
const SENT: MyJoinRequest = { id: 'request-1', status: 'PENDING', team: { id: 'team-zero', name: 'zero', logoUrl: null }, createdAt: '2026-11-09T20:00:00Z' };

// The search stands in as one button per league team: picking is what it does here
const SearchStub = defineComponent({
  name: 'LeagueTeamSearch',
  emits: ['select'],
  setup(_, { emit }) {
    return () => h('div', [FREE, OURS].map(team => h('button', { class: `pick-${team.id}`, onClick: () => emit('select', team) }, team.name)));
  },
});

function mountFinder() {
  return mount(LeagueTeamFinder, { global: { stubs: { LeagueTeamSearch: SearchStub } } });
}

function button(wrapper: ReturnType<typeof mountFinder>, label: string) {
  const found = wrapper.findAll('button').find(candidate => candidate.text().startsWith(label));
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

beforeEach(() => {
  vi.mocked(sendJoinRequest).mockReset().mockResolvedValue(SENT);
});

describe('LeagueTeamFinder', () => {
  it('offers to make a league team no team of ours is yet', async () => {
    const wrapper = mountFinder();

    await wrapper.get('.pick-1').trigger('click');
    expect(wrapper.text()).toContain('Elle n\'est pas encore sur l\'application');
    await button(wrapper, 'Créer RONIN').trigger('click');

    expect(wrapper.emitted('create')).toEqual([[FREE]]);
    expect(sendJoinRequest).not.toHaveBeenCalled();
  });

  it('asks to join the team of ours a league team already is, named as it is here', async () => {
    const wrapper = mountFinder();

    await wrapper.get('.pick-2').trigger('click');
    expect(wrapper.text()).toContain('sous le nom zero');
    await button(wrapper, 'Demander à rejoindre zero').trigger('click');
    await flushPromises();

    expect(sendJoinRequest).toHaveBeenCalledWith('team-zero');
    expect(wrapper.emitted('requested')).toEqual([[SENT]]);
  });

  it('says why a request could not go, and stays', async () => {
    vi.mocked(sendJoinRequest).mockRejectedValueOnce(new ApiError([ERROR.joinRequestRefusedBefore], ERROR.joinRequestFailed));
    const wrapper = mountFinder();

    await wrapper.get('.pick-2').trigger('click');
    await button(wrapper, 'Demander à rejoindre').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain(ERROR.joinRequestRefusedBefore);
    expect(wrapper.emitted('requested')).toBeUndefined();
  });

  it('goes back to the search for another pick, the list as it was left', async () => {
    // In the page: whether something shows is read from its styles there
    const wrapper = mount(LeagueTeamFinder, { attachTo: document.body, global: { stubs: { LeagueTeamSearch: SearchStub } } });
    await wrapper.get('.pick-1').trigger('click');
    expect(wrapper.get('.pick-2').isVisible()).toBe(false);

    await button(wrapper, 'Ce n\'est pas mon équipe').trigger('click');

    expect(wrapper.get('.pick-2').isVisible()).toBe(true);
    expect(wrapper.find('.league-chosen').exists()).toBe(false);
    wrapper.unmount();
  });
});
