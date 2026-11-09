// Tests for the requests to join, on the team page: who asks, let in at once,
// or refused once the refusal is confirmed; nothing shown when none waits
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { TeamJoinRequestView } from '@shared/types';
import { acceptJoinRequest, fetchTeamJoinRequests, refuseJoinRequest } from '@/api';
import TeamJoinRequests from '@/components/team/TeamJoinRequests.vue';

vi.mock('@/api', () => ({
  acceptJoinRequest: vi.fn(),
  fetchTeamJoinRequests: vi.fn(),
  refuseJoinRequest: vi.fn(),
}));

const RAPH: TeamJoinRequestView = { id: 'request-1', playerName: 'Raph', evaUsername: 'RONxSib#177352', createdAt: new Date().toISOString() };
const NOVA: TeamJoinRequestView = { id: 'request-2', playerName: 'Nova', evaUsername: null, createdAt: new Date().toISOString() };

// The confirmation stands in as its message and a yes, shown while open
const ConfirmStub = defineComponent({
  name: 'ConfirmModal',
  props: { open: Boolean, message: { type: String, default: '' } },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    return () => props.open
      ? h('div', { class: 'confirm' }, [h('p', props.message), h('button', { class: 'yes', onClick: () => emit('confirm') }, 'yes')])
      : null;
  },
});

async function mountRequests() {
  const wrapper = mount(TeamJoinRequests, { global: { stubs: { ConfirmModal: ConfirmStub } } });
  await flushPromises();
  return wrapper;
}

function button(wrapper: Awaited<ReturnType<typeof mountRequests>>, row: number, label: string) {
  return wrapper.findAll('.request')[row]!.findAll('button').find(candidate => candidate.text() === label)!;
}

beforeEach(() => {
  vi.mocked(fetchTeamJoinRequests).mockReset().mockResolvedValue([RAPH, NOVA]);
  vi.mocked(acceptJoinRequest).mockReset().mockResolvedValue();
  vi.mocked(refuseJoinRequest).mockReset().mockResolvedValue();
});

describe('TeamJoinRequests', () => {
  it('lists who asks, with their eva.gg account when they linked one', async () => {
    const wrapper = await mountRequests();

    const rows = wrapper.findAll('.request-who');
    expect(rows[0]!.text()).toContain('Raph');
    expect(rows[0]!.text()).toContain('eva.gg : RONxSib#177352');
    expect(rows[1]!.text()).toContain('Pas de compte eva.gg relié');
    expect(wrapper.get('.count').text()).toBe('2');
  });

  it('lets a player in at once, and says who came', async () => {
    const wrapper = await mountRequests();

    await button(wrapper, 0, 'Accepter').trigger('click');
    await flushPromises();

    expect(acceptJoinRequest).toHaveBeenCalledWith('request-1');
    expect(wrapper.emitted('accepted')).toEqual([['Raph']]);
    expect(wrapper.findAll('.request')).toHaveLength(1);
  });

  it('refuses only once the refusal, for good, is confirmed', async () => {
    const wrapper = await mountRequests();

    await button(wrapper, 1, 'Refuser').trigger('click');
    expect(refuseJoinRequest).not.toHaveBeenCalled();
    expect(wrapper.get('.confirm').text()).toContain('Nova ne pourra plus demander à rejoindre l\'équipe');

    await wrapper.get('.yes').trigger('click');
    await flushPromises();

    expect(refuseJoinRequest).toHaveBeenCalledWith('request-2');
    expect(wrapper.findAll('.request')).toHaveLength(1);
  });

  it('shows nothing when no request waits', async () => {
    vi.mocked(fetchTeamJoinRequests).mockResolvedValueOnce([]);

    const wrapper = await mountRequests();

    expect(wrapper.find('.team-join-requests').exists()).toBe(false);
  });
});
