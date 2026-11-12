// Tests for the app shell reading the team's balance rules: for a player in a
// team, again when the team changes; never for a session with no team, a
// manager's or an admin's, which the server answers with an error
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';

vi.mock('vue-router', () => ({ useRoute: () => ({ meta: {} }) }));

const account = ref<{ accountType: string; teamId: string | null; name: string } | null>(null);
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: ref(true), account, isLoading: ref(false), initAuth: vi.fn() }),
}));

const fetchRules = vi.fn();
vi.mock('@/composables/useBalanceRules', () => ({ useBalanceRules: () => ({ fetchRules }) }));
vi.mock('@/composables/useTeamLogo', () => ({ useTeamLogo: () => ({ teamLogoUrl: ref(null), load: vi.fn(), clear: vi.fn() }) }));

import App from '@/App.vue';

function mountApp() {
  return mount(App, { global: { stubs: { DynamicTopBar: true, AppNavTabs: true, RouterView: true } } });
}

beforeEach(() => {
  fetchRules.mockReset();
});

describe('App - the team\'s balance rules', () => {
  it('reads them for a player in a team, and again when the team changes', async () => {
    account.value = { accountType: 'player', teamId: 'team-1', name: 'Tranquille' };
    mountApp();
    expect(fetchRules).toHaveBeenCalledTimes(1);

    account.value = { accountType: 'player', teamId: 'team-2', name: 'Tranquille' };
    await nextTick();
    expect(fetchRules).toHaveBeenCalledTimes(2);
  });

  it('never asks them for a session with no team: a player without one, a manager, an admin', async () => {
    account.value = { accountType: 'player', teamId: null, name: 'Sans Équipe' };
    mountApp();
    for (const accountType of ['manager', 'admin']) {
      account.value = { accountType, teamId: null, name: 'Shark' };
      await nextTick();
    }

    expect(fetchRules).not.toHaveBeenCalled();
  });
});
