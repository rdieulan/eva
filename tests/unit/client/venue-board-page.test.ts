// Tests for the public board of a venue: its searches day by day, readable without an account
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, ref } from 'vue';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import type { PublicScrimSearch, VenueBoard } from '@shared/types';
import { ERROR } from '@shared/constants';
import { ApiError } from '@/api/error';

const route = vi.hoisted(() => ({ params: { slug: 'nimes' } as Record<string, string> }));
vi.mock('vue-router', () => ({ useRoute: () => route }));

const auth = vi.hoisted(() => ({ account: null as unknown, isAuthenticated: null as unknown, hasTeam: null as unknown }));
vi.mock('@/composables/useAuth', () => ({ useAuth: () => auth }));

vi.mock('@/api', () => ({ fetchVenueBoard: vi.fn() }));

import { fetchVenueBoard } from '@/api';
import VenueBoardPage from '@/pages/VenueBoardPage.vue';

const VENUE = { id: 'venue-nimes', slug: 'nimes', name: 'Nîmes', arenaCount: 2 };

function search(id: string, overrides: Partial<PublicScrimSearch> = {}): PublicScrimSearch {
  return {
    id, date: '2030-06-10', team: { id: `team-${id}`, name: `Équipe ${id}`, logoUrl: null },
    ranges: [{ arenaNumber: 1, startTime: '20:00', endTime: '21:20' }],
    slotCount: 2, matchCount: 1, matchedCount: 0, ...overrides,
  };
}

function boardOf(searches: PublicScrimSearch[], venue = VENUE): VenueBoard {
  return { venue, searches };
}

function mountPage() {
  return mount(VenueBoardPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
}

// A player signed in, in a team
function signIn(teamId: string) {
  auth.account = ref({ teamId });
  auth.isAuthenticated = ref(true);
  auth.hasTeam = ref(true);
}

function visitor() {
  auth.account = ref(null);
  auth.isAuthenticated = ref(false);
  auth.hasTeam = ref(false);
}

beforeEach(() => {
  route.params = reactive({ slug: 'nimes' });
  visitor();
  vi.mocked(fetchVenueBoard).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VenueBoardPage', () => {
  it('shows the searches of the venue day by day: the team, what it wants, where a match still fits', async () => {
    vi.mocked(fetchVenueBoard).mockResolvedValue(boardOf([
      search('a', { ranges: [{ arenaNumber: 1, startTime: '19:20', endTime: '20:40' }, { arenaNumber: 2, startTime: '20:40', endTime: '22:00' }] }),
      search('b', { matchCount: 2, matchedCount: 1, slotCount: 1 }),
      search('c', { date: '2030-06-12' }),
    ]));
    const wrapper = mountPage();
    await flushPromises();

    expect(fetchVenueBoard).toHaveBeenCalledWith('nimes');
    expect(wrapper.find('h1').text()).toBe('Scrims à Nîmes');
    expect(document.title).toBe('EVA - Scrims à Nîmes');
    expect(wrapper.findAll('.board-day-title').map(title => title.text())).toEqual(['lundi 10 juin 2030', 'mercredi 12 juin 2030']);
    const [first, second] = wrapper.findAll('.board-day')[0]!.findAll('.board-search');
    expect(first!.find('.board-team').text()).toBe('Équipe a');
    expect(first!.find('.board-wanted').text()).toBe('1 match de 1h20');
    expect(first!.findAll('.board-range').map(range => range.text())).toEqual(['19:20 – 20:40 · arène 1', '20:40 – 22:00 · arène 2']);
    expect(second!.find('.board-wanted').text()).toBe('2 matchs de 40 min, 1 déjà calé');
    // No logo: the team's initials stand in
    expect(first!.find('.team-logo-mark--initials').text()).toBe('ÉA');
  });

  it('names no arena in a venue that has only one', async () => {
    vi.mocked(fetchVenueBoard).mockResolvedValue(boardOf([search('a')], { ...VENUE, arenaCount: 1 }));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('.board-range').text()).toBe('20:00 – 21:20');
  });

  it('leads to the sheet of a search in the calendar, the venue ticked; our own search reads as ours', async () => {
    signIn('team-b');
    vi.mocked(fetchVenueBoard).mockResolvedValue(boardOf([search('a'), search('b')]));
    const wrapper = mountPage();
    await flushPromises();

    const links = wrapper.findAll('.board-search').map(card => card.findComponent(RouterLinkStub));
    expect(links.map(link => link.text())).toEqual(['Proposer un match', 'Voir notre recherche']);
    expect(links[0]!.props('to')).toEqual({
      path: '/calendar',
      query: { date: '2030-06-10', mode: 'matchmaking', venue: 'venue-nimes', search: 'a' },
    });
  });

  it('says when no team looks for an opponent there, and offers a visitor an account', async () => {
    vi.mocked(fetchVenueBoard).mockResolvedValue(boardOf([]));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('.board-empty').text()).toContain('Aucune équipe ne cherche d\'adversaire à Nîmes pour le moment.');
    const link = wrapper.find('.board-empty').findComponent(RouterLinkStub);
    expect(link.text()).toBe('Créer un compte');
    expect(link.props('to')).toEqual({ name: 'register' });
  });

  it('offers a player of a team to look for an opponent there when nobody does', async () => {
    signIn('team-z');
    vi.mocked(fetchVenueBoard).mockResolvedValue(boardOf([]));
    const wrapper = mountPage();
    await flushPromises();

    const link = wrapper.find('.board-empty').findComponent(RouterLinkStub);
    expect(link.text()).toBe('Chercher un adversaire');
    expect(link.props('to')).toMatchObject({ path: '/calendar', query: { mode: 'matchmaking', venue: 'venue-nimes' } });
  });

  it('says a venue the address names nowhere', async () => {
    route.params = reactive({ slug: 'nulle-part' });
    vi.mocked(fetchVenueBoard).mockRejectedValue(new ApiError([ERROR.venueNotFound], ERROR.venueBoardFetchFailed));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('h1').text()).toBe('Salle introuvable');
    expect(wrapper.find('.board-search').exists()).toBe(false);
  });

  it('says when the board cannot be read', async () => {
    vi.mocked(fetchVenueBoard).mockRejectedValue(new ApiError([], ERROR.venueBoardFetchFailed));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain(ERROR.venueBoardFetchFailed);
  });

  it('copies the address of the page, and says so, or says it could not', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.mocked(fetchVenueBoard).mockResolvedValue(boardOf([search('a')]));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('.board-copy').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(wrapper.find('.board-copy').text()).toBe('Lien copié');

    writeText.mockRejectedValue(new Error('denied'));
    await wrapper.find('.board-copy').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe('Copie impossible ici : copiez l\'adresse de la page.');
  });
});
