// Tests for making a team from a league team of the directory: its name and
// logo taken, the venue of its league proposed once the site has told it,
// never over a venue the player picked
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { LeagueTeamSummary, LeagueVenueProposal, Venue } from '@shared/types';
import { ERROR } from '@shared/constants';
import { createTeam, fetchLeagueTeam, fetchLeagueVenueProposal, fetchVenues } from '@/api';
import CreateTeamPage from '@/pages/CreateTeamPage.vue';

const route = vi.hoisted(() => ({ query: {} as Record<string, string> }));
const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push, replace: vi.fn() }) }));

const auth = vi.hoisted(() => ({ hasTeam: { value: false }, refreshAccount: vi.fn() }));
vi.mock('@/composables/useAuth', () => ({ useAuth: () => auth }));

vi.mock('@/api', () => ({
  createTeam: vi.fn(),
  fetchLeagueTeam: vi.fn(),
  fetchLeagueVenueProposal: vi.fn(),
  fetchVenues: vi.fn(),
}));

const RONIN: LeagueTeamSummary = { id: '2444500737328074751', name: 'RONIN', memberCount: 5, logoUrl: '/api/league-teams/1/logo?v=7', team: null };
const NIMES = { id: 'venue-nimes', name: 'Nîmes' } as Venue;
const AVIGNON = { id: 'venue-avignon', name: 'Avignon' } as Venue;
const PROPOSAL: LeagueVenueProposal = { venueId: NIMES.id, venueName: 'Nîmes', leagueName: 'NEMAUSUS LEAGUE - NOVEMBRE' };

async function mountPage() {
  const wrapper = mount(CreateTeamPage);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  route.query = { ligue: RONIN.id };
  push.mockReset();
  auth.refreshAccount.mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchVenues).mockReset().mockResolvedValue([AVIGNON, NIMES]);
  vi.mocked(fetchLeagueTeam).mockReset().mockResolvedValue(RONIN);
  vi.mocked(fetchLeagueVenueProposal).mockReset().mockResolvedValue(PROPOSAL);
  vi.mocked(createTeam).mockReset().mockResolvedValue({ logoCopied: true } as never);
});

describe('CreateTeamPage', () => {
  it('takes the name and the logo of the league team, and proposes the venue of its league', async () => {
    const wrapper = await mountPage();

    expect((wrapper.get('#team-name').element as HTMLInputElement).value).toBe('RONIN');
    expect(wrapper.get('.league-team img').attributes('src')).toBe(RONIN.logoUrl);
    expect((wrapper.get('#team-venue').element as HTMLSelectElement).value).toBe(NIMES.id);
    expect(wrapper.get('.venue-hint').text()).toContain('NEMAUSUS LEAGUE - NOVEMBRE');
  });

  it('never replaces a venue the player picked before the proposal came', async () => {
    let tell!: (proposal: LeagueVenueProposal) => void;
    vi.mocked(fetchLeagueVenueProposal).mockReturnValueOnce(new Promise(resolve => { tell = resolve; }));
    const wrapper = await mountPage();

    await wrapper.get('#team-venue').setValue(AVIGNON.id);
    tell(PROPOSAL);
    await flushPromises();

    expect((wrapper.get('#team-venue').element as HTMLSelectElement).value).toBe(AVIGNON.id);
    expect(wrapper.find('.venue-hint').exists()).toBe(false);
  });

  it('makes the team linked to its league team, at the venue chosen, and says when its logo did not come', async () => {
    vi.mocked(createTeam).mockResolvedValueOnce({ logoCopied: false } as never);
    const wrapper = await mountPage();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createTeam).toHaveBeenCalledWith({ name: 'RONIN', venueId: NIMES.id, leagueTeamId: RONIN.id });
    expect(push).toHaveBeenCalledWith({ path: '/team', query: { logo: 'manquant' } });
  });

  it('proposes nothing for a league team another team of ours already is, and makes nothing', async () => {
    vi.mocked(fetchLeagueTeam).mockResolvedValueOnce({ ...RONIN, team: { id: 'team-zero', name: 'zero' } });
    const wrapper = await mountPage();

    expect(fetchLeagueVenueProposal).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(ERROR.leagueTeamTaken);
    expect(wrapper.get('.btn-create').attributes('disabled')).toBeDefined();
  });

  it('makes a team out of the leagues as before', async () => {
    route.query = {};
    const wrapper = await mountPage();

    expect(wrapper.find('.league-team').exists()).toBe(false);
    expect(fetchLeagueVenueProposal).not.toHaveBeenCalled();
    await wrapper.get('#team-name').setValue('Les Faucons');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createTeam).toHaveBeenCalledWith({ name: 'Les Faucons', venueId: null, leagueTeamId: null });
    expect(push).toHaveBeenCalledWith('/team');
  });
});
