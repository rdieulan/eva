// Tests for the screen of a player without a team: their request to join a
// team when they have one, else the ways in: their league team, a link, their
// own team
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { LeagueTeamSummary, MyJoinRequest } from '@shared/types';
import { fetchMyJoinRequest } from '@/api';
import NoTeamMessage from '@/components/common/NoTeamMessage.vue';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/api', () => ({ fetchMyJoinRequest: vi.fn() }));

const RONIN: LeagueTeamSummary = { id: '2444500737328074751', name: 'RONIN', memberCount: 5, logoUrl: null, team: null };
const WAITING: MyJoinRequest = { id: 'request-1', status: 'PENDING', team: { id: 'team-zero', name: 'zero', logoUrl: null }, createdAt: '2026-11-09T20:00:00Z' };

// The finder stands in as two buttons, one per outcome
const FinderStub = defineComponent({
  name: 'LeagueTeamFinder',
  emits: ['create', 'requested'],
  setup(_, { emit }) {
    return () => h('div', { class: 'finder' }, [
      h('button', { class: 'make', onClick: () => emit('create', RONIN) }, 'make'),
      h('button', { class: 'ask', onClick: () => emit('requested', WAITING) }, 'ask'),
    ]);
  },
});

const CardStub = defineComponent({
  name: 'JoinRequestCard',
  props: { request: { type: Object, required: true } },
  emits: ['changed'],
  setup(props, { emit }) {
    return () => h('div', { class: 'card' }, [
      h('span', (props.request as MyJoinRequest).team.name),
      h('button', { class: 'clear', onClick: () => emit('changed', null) }, 'clear'),
    ]);
  },
});

async function mountScreen() {
  const wrapper = mount(NoTeamMessage, { global: { stubs: { LeagueTeamFinder: FinderStub, JoinRequestCard: CardStub } } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(fetchMyJoinRequest).mockReset().mockResolvedValue(null);
});

describe('NoTeamMessage', () => {
  it('offers the ways in: the league team, a link, a team of one\'s own', async () => {
    const wrapper = await mountScreen();

    expect(wrapper.find('.finder').exists()).toBe(true);
    expect(wrapper.findAll('input').map(input => input.attributes('aria-label'))).toEqual(['Lien d\'invitation']);
    expect(wrapper.text()).toContain('Créer une équipe');
    expect(wrapper.find('.card').exists()).toBe(false);
  });

  it('makes the league team picked on the creation page', async () => {
    const wrapper = await mountScreen();

    await wrapper.get('.make').trigger('click');

    expect(push).toHaveBeenCalledWith({ path: '/team/create', query: { ligue: RONIN.id } });
  });

  it('shows the request in place of the ways in, from its sending to its end', async () => {
    const wrapper = await mountScreen();

    await wrapper.get('.ask').trigger('click');
    expect(wrapper.get('.card').text()).toContain('zero');
    expect(wrapper.find('.finder').exists()).toBe(false);

    await wrapper.get('.clear').trigger('click');
    expect(wrapper.find('.finder').exists()).toBe(true);
  });

  it('shows the request the player already has', async () => {
    vi.mocked(fetchMyJoinRequest).mockResolvedValueOnce(WAITING);

    const wrapper = await mountScreen();

    expect(wrapper.find('.card').exists()).toBe(true);
    expect(wrapper.find('.finder').exists()).toBe(false);
  });
});
