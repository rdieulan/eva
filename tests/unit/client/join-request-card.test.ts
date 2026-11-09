// Tests for the player's request to join a team on their no-team screen:
// waiting, taken back; refused, seen; and watched while it waits, the player
// going to their team page once accepted
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { MyJoinRequest } from '@shared/types';
import { cancelMyJoinRequest, fetchMyJoinRequest, markMyRefusalSeen } from '@/api';
import JoinRequestCard from '@/components/team/JoinRequestCard.vue';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

const auth = vi.hoisted(() => ({ hasTeam: null as unknown, refreshAccount: vi.fn() }));
vi.mock('@/composables/useAuth', () => ({ useAuth: () => auth }));

vi.mock('@/api', () => ({
  cancelMyJoinRequest: vi.fn(),
  fetchMyJoinRequest: vi.fn(),
  markMyRefusalSeen: vi.fn(),
}));

const WAITING: MyJoinRequest = { id: 'request-1', status: 'PENDING', team: { id: 'team-zero', name: 'zero', logoUrl: null }, createdAt: '2026-11-09T20:00:00Z' };
const REFUSED: MyJoinRequest = { ...WAITING, status: 'REFUSED' };

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
  push.mockReset();
  auth.hasTeam = ref(false);
  auth.refreshAccount.mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchMyJoinRequest).mockReset().mockResolvedValue(WAITING);
  vi.mocked(cancelMyJoinRequest).mockReset().mockResolvedValue();
  vi.mocked(markMyRefusalSeen).mockReset().mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JoinRequestCard', () => {
  it('shows a request waiting, and takes it back', async () => {
    const wrapper = mount(JoinRequestCard, { props: { request: WAITING } });
    expect(wrapper.text()).toContain('Demande envoyée à zero');

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(cancelMyJoinRequest).toHaveBeenCalled();
    expect(wrapper.emitted('changed')).toEqual([[null]]);
  });

  it('shows a refusal once, until seen', async () => {
    const wrapper = mount(JoinRequestCard, { props: { request: REFUSED } });
    expect(wrapper.text()).toContain('zero n\'a pas accepté ta demande');

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(markMyRefusalSeen).toHaveBeenCalled();
    expect(wrapper.emitted('changed')).toEqual([[null]]);
  });

  it('takes the player to their team page once the request is accepted', async () => {
    mount(JoinRequestCard, { props: { request: WAITING } });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(push).not.toHaveBeenCalled();

    vi.mocked(fetchMyJoinRequest).mockResolvedValueOnce(null);
    auth.refreshAccount.mockImplementationOnce(async () => { (auth.hasTeam as { value: boolean }).value = true; });
    await vi.advanceTimersByTimeAsync(15_000);
    await flushPromises();

    expect(push).toHaveBeenCalledWith('/team');
  });

  it('shows a refusal that came while it waited', async () => {
    const wrapper = mount(JoinRequestCard, { props: { request: WAITING } });
    vi.mocked(fetchMyJoinRequest).mockResolvedValueOnce(REFUSED);

    await vi.advanceTimersByTimeAsync(15_000);
    await flushPromises();

    expect(wrapper.emitted('changed')).toEqual([[REFUSED]]);
  });

  it('reads nothing while the page is out of sight', async () => {
    setVisibility('hidden');
    mount(JoinRequestCard, { props: { request: WAITING } });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMyJoinRequest).not.toHaveBeenCalled();
  });
});
