// Tests for the tabs between the pages of a player's team: the home, the
// calendar and the team; the one in sight marked, the team's tab showing its logo
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { PLANNER_ENABLED } from '@shared/constants';

const route = vi.hoisted(() => ({ path: '/' }));
vi.mock('vue-router', () => ({ useRoute: () => route }));

const account = ref<{ accountType: string; teamId: string | null; roles: string[] } | null>(null);
vi.mock('@/composables/useAuth', () => ({ useAuth: () => ({ account }) }));

import AppNavTabs from '@/components/common/layout/AppNavTabs.vue';

function mountTabs(path: string, teamLogoUrl: string | null = null, placement: 'top' | 'bottom' = 'top') {
  route.path = path;
  return mount(AppNavTabs, {
    props: { placement, teamLogoUrl },
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}

const labels = (wrapper: ReturnType<typeof mountTabs>) => wrapper.findAllComponents(RouterLinkStub).map(tab => tab.text());

beforeEach(() => {
  account.value = { accountType: 'player', teamId: 'team-1', roles: ['player'] };
});

describe('AppNavTabs', () => {
  it('leads a player in a team to the home, the calendar and the team, the planner only while it is on', () => {
    const tabs = mountTabs('/').findAllComponents(RouterLinkStub);

    expect(tabs.map(tab => tab.text())).toEqual(['Accueil', 'Calendrier', ...(PLANNER_ENABLED ? ['Planificateur'] : []), 'Équipe']);
    expect(tabs.map(tab => tab.props('to'))).toEqual(['/', '/calendar', ...(PLANNER_ENABLED ? ['/planner'] : []), '/team']);
  });

  it('marks the page in sight, and only it', () => {
    for (const [path, current] of [['/', 'Accueil'], ['/calendar', 'Calendrier'], ['/team', 'Équipe']] as const) {
      const marked = mountTabs(path).findAll('[aria-current="page"]');
      expect(marked.map(tab => tab.text())).toEqual([current]);
    }
    expect(mountTabs('/profile').findAll('[aria-current="page"]')).toHaveLength(0);
  });

  it('shows the team\'s logo on its tab when it has one', () => {
    const team = () => mountTabs('/', '/api/teams/team-1/logo?v=1').findAllComponents(RouterLinkStub).at(-1)!;

    expect(team().get('img').attributes('src')).toBe('/api/teams/team-1/logo?v=1');
    expect(mountTabs('/').findAllComponents(RouterLinkStub).at(-1)!.find('img').exists()).toBe(false);
  });

  it('sits at the foot of the screen when asked to', () => {
    expect(mountTabs('/', null, 'bottom').get('nav').classes()).toContain('nav-tabs--bottom');
  });
});
