// Tests for the home dashboard: its cards in the order given, what to do from
// each, a word when there is nothing to do, a read again when it failed, and
// the league registration checked once done
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import type { Dashboard, DashboardItem } from '@shared/types';
import { ERROR } from '@shared/constants';
import { checkLeagueRegistration, fetchDashboard } from '@/api';
import { ApiError } from '@/api/error';
import HomeDashboard from '@/components/home/HomeDashboard.vue';

vi.mock('@/api', () => ({
  fetchDashboard: vi.fn(),
  checkLeagueRegistration: vi.fn(),
}));

// 10:00 in Paris on Monday 10 June 2030
const NOW = new Date('2030-06-10T08:00:00Z');

const LEAGUE: DashboardItem = {
  kind: 'LEAGUE_REGISTRATION',
  due: '2030-06-30T00:00',
  data: { tournamentId: 'league-july', tournamentName: 'NEMAUSUS LEAGUE - JUILLET', leagueTeamName: 'RONIN', closesAt: '2030-06-29T22:00:00.000Z' },
};
const MATCH: DashboardItem = {
  kind: 'MATCH',
  due: '2030-06-10T20:00',
  data: {
    eventId: 'event-1', date: '2030-06-10', startTime: '20:00', endTime: '21:20', title: 'Match vs Les Rivaux',
    venueName: 'Nîmes', arenaNumber: null, evaLocationId: 51, headcount: { takenSeats: 8, varies: false }, isUnavailable: false,
  },
};
const JOIN: DashboardItem = { kind: 'JOIN_REQUESTS', due: null, data: { count: 2 } };

function answers(items: DashboardItem[], next: Dashboard['next'] = null): Dashboard {
  return { items, next };
}

async function mountDashboard() {
  const wrapper = mount(HomeDashboard, { global: { stubs: { RouterLink: RouterLinkStub } } });
  await flushPromises();
  return wrapper;
}

function button(wrapper: Awaited<ReturnType<typeof mountDashboard>>, label: string) {
  return wrapper.findAll('button').find(candidate => candidate.text() === label)!;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(fetchDashboard).mockReset().mockResolvedValue(answers([MATCH, LEAGUE, JOIN]));
  vi.mocked(checkLeagueRegistration).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HomeDashboard', () => {
  it('shows a card for each item in the order given, the pressing ones marked', async () => {
    const wrapper = await mountDashboard();

    const cards = wrapper.findAll('.dashboard-card');
    expect(cards.map(card => card.get('.dashboard-title').text())).toEqual(['Match vs Les Rivaux', 'Inscription à la ligue', 'Demandes pour rejoindre']);
    expect(cards[0]!.get('.dashboard-when').text()).toBe('Aujourd\'hui à 20:00');
    expect(cards[0]!.classes()).toContain('urgent');
    expect(cards[1]!.classes()).not.toContain('urgent');
    expect(cards[2]!.find('.dashboard-when').exists()).toBe(false);
  });

  it('gives each card the colour and symbol of its subject, its main action in that colour, the players booked in their state', async () => {
    const wrapper = await mountDashboard();

    const cards = wrapper.findAll('.dashboard-card');
    expect(cards.map(card => card.classes().find(name => name.startsWith('subject--')))).toEqual(['subject--match', 'subject--competition', 'subject--team']);
    expect(wrapper.findAllComponents({ name: 'SubjectIcon' }).map(icon => icon.props('subject'))).toEqual(['match', 'competition', 'team']);
    expect(cards.map(card => card.findAll('.dashboard-action--main').map(action => action.text())))
      .toEqual([['Réserver ma place sur eva.gg ↗'], ['S\'inscrire sur competitive.eva.gg ↗'], ['Voir les demandes']]);
    expect(cards[0]!.get('.dashboard-detail').classes()).toContain('headcount-full');
  });

  it('opens another site in a new tab, and leads to the app\'s pages', async () => {
    const wrapper = await mountDashboard();

    const booking = wrapper.findAll('.dashboard-card')[0]!.get('a[target="_blank"]');
    expect(booking.text()).toContain('Réserver ma place sur eva.gg');
    expect(booking.attributes('rel')).toBe('noopener noreferrer');
    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.map(link => link.text())).toEqual(['Voir le match', 'Voir les demandes']);
    expect(links[1]!.props('to')).toEqual({ path: '/team' });
  });

  it('says there is nothing to do, with the team\'s next match when it has one', async () => {
    vi.mocked(fetchDashboard).mockResolvedValue(answers([], { eventId: 'event-9', type: 'MATCH', date: '2030-06-18', startTime: '20:00', title: 'Match vs Les Rivaux' }));
    const wrapper = await mountDashboard();

    expect(wrapper.get('.dashboard-quiet-title').text()).toBe('Rien à faire pour le moment.');
    expect(wrapper.get('.dashboard-quiet-next').text()).toBe('Prochain match dans 8 jours : Match vs Les Rivaux, mar. 18/06 à 20:00');
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual({ path: '/calendar', query: { date: '2030-06-18', mode: 'team', event: 'event-9' } });

    vi.mocked(fetchDashboard).mockResolvedValue(answers([]));
    const quiet = await mountDashboard();
    expect(quiet.find('.dashboard-quiet-next').exists()).toBe(false);
  });

  it('says what went wrong, and reads again on asking, loading meanwhile rather than saying there is nothing to do', async () => {
    vi.mocked(fetchDashboard).mockRejectedValueOnce(new ApiError([], ERROR.dashboardFetchFailed));
    const wrapper = await mountDashboard();
    expect(wrapper.text()).toContain(ERROR.dashboardFetchFailed);

    let answer!: (dashboard: Dashboard) => void;
    vi.mocked(fetchDashboard).mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
    await button(wrapper, 'Réessayer').trigger('click');
    expect(wrapper.text()).toContain('Chargement…');
    expect(wrapper.text()).not.toContain('Rien à faire');

    answer(answers([JOIN]));
    await flushPromises();
    expect(wrapper.findAll('.dashboard-card')).toHaveLength(1);
    expect(wrapper.text()).not.toContain(ERROR.dashboardFetchFailed);
  });

  it('checks the league registration once done: registered, its card goes', async () => {
    const wrapper = await mountDashboard();
    vi.mocked(checkLeagueRegistration).mockResolvedValue(['league-july']);
    vi.mocked(fetchDashboard).mockResolvedValue(answers([MATCH, JOIN]));

    await button(wrapper, 'C\'est fait, vérifier').trigger('click');
    await flushPromises();

    expect(checkLeagueRegistration).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('.dashboard-title').map(title => title.text())).not.toContain('Inscription à la ligue');
  });

  it('says under its card when the team is not registered yet, or when the check was refused', async () => {
    const wrapper = await mountDashboard();

    await button(wrapper, 'C\'est fait, vérifier').trigger('click');
    await flushPromises();
    const league = () => wrapper.findAll('.dashboard-card')[1]!;
    expect(league().get('[role="status"]').text()).toContain('Pas encore inscrite sur competitive.eva.gg');
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1);

    vi.mocked(checkLeagueRegistration).mockRejectedValue(new ApiError([ERROR.leagueCheckTooSoon], ERROR.leagueCheckFailed));
    await button(wrapper, 'C\'est fait, vérifier').trigger('click');
    await flushPromises();
    expect(league().get('[role="status"]').text()).toBe(ERROR.leagueCheckTooSoon);
  });
});
