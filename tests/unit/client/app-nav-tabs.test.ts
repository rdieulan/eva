// Tests for the tabs between the pages of the role the session acts as: a
// player's home and team, a manager's venue; the one in sight marked, the
// team's tab showing its logo
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

  it('keeps each role to its own pages: a player\'s team, the tabs of a manager\'s space', () => {
    account.value = { accountType: 'player', teamId: 'team-1', roles: ['player', 'manager'] };
    expect(labels(mountTabs('/'))).toEqual(['Accueil', 'Calendrier', ...(PLANNER_ENABLED ? ['Planificateur'] : []), 'Équipe']);

    account.value = { accountType: 'manager', teamId: null, roles: ['player', 'manager'] };
    const manager = mountTabs('/gestion/competition');
    expect(labels(manager)).toEqual(['Ma salle', 'Compétition', 'Événements']);
    expect(manager.findAllComponents(RouterLinkStub).map(tab => tab.props('to')))
      .toEqual(['/gestion', '/gestion/competition', '/gestion/evenements']);
    // The space's own address is Ma salle's alone: the tabs under it are marked on their own
    expect(manager.findAll('[aria-current="page"]').map(tab => tab.text())).toEqual(['Compétition']);
    expect(mountTabs('/gestion').findAll('[aria-current="page"]').map(tab => tab.text())).toEqual(['Ma salle']);
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
