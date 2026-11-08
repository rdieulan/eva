// Tests for the ways to a venue's public board: the team page, and the admin's venue list
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import type { Venue } from '@shared/types';

vi.mock('@/api', () => ({
  fetchAdminVenues: vi.fn(),
  createAdminVenue: vi.fn(),
  updateAdminVenue: vi.fn(),
  deleteAdminVenue: vi.fn(),
}));

import { fetchAdminVenues } from '@/api';
import TeamInfo from '@/components/team/TeamInfo.vue';
import AdminVenuesPage from '@/pages/AdminVenuesPage.vue';

function venue(id: string, name: string, slug: string, discord: string | null = null): Venue {
  return {
    id, slug, name, city: name, address: '1 rue', phone: null, arenaCount: 1, hasEvaSlots: true,
    website: null, discord, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
  };
}

const NIMES = venue('venue-nimes', 'Nîmes', 'nimes', 'https://discord.gg/nimes');
const LYON = venue('venue-lyon', 'Lyon Nord', 'lyon-nord');

describe('TeamInfo', () => {
  it('leads from the venue of the team to its board, next to its Discord', () => {
    const wrapper = mount(TeamInfo, {
      props: {
        team: { id: 'team-1', name: 'zero', logoUrl: null, venueId: NIMES.id, favoriteVenueIds: [], leader: null },
        venues: [NIMES, LYON],
        canManageTeam: false,
        isLeader: false,
      },
      global: { stubs: { RouterLink: RouterLinkStub, VenueChecklist: true } },
    });

    const board = wrapper.findComponent(RouterLinkStub);
    expect(board.text()).toBe('Scrims');
    expect(board.props('to')).toEqual({ name: 'venue-board', params: { slug: 'nimes' } });
    expect(wrapper.find('a.venue-link[href="https://discord.gg/nimes"]').exists()).toBe(true);
  });

  it('has no board to lead to without a venue', () => {
    const wrapper = mount(TeamInfo, {
      props: {
        team: { id: 'team-1', name: 'zero', logoUrl: null, favoriteVenueIds: [], leader: null },
        venues: [NIMES],
        canManageTeam: false,
        isLeader: false,
      },
      global: { stubs: { RouterLink: RouterLinkStub, VenueChecklist: true } },
    });

    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false);
  });
});

describe('AdminVenuesPage', () => {
  it('shows the address of each venue\'s board, to send it, opening in a new tab', async () => {
    vi.mocked(fetchAdminVenues).mockResolvedValue([NIMES, LYON]);
    const wrapper = mount(AdminVenuesPage, { global: { stubs: { RouterLink: RouterLinkStub, Teleport: true } } });
    await flushPromises();

    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.map(link => link.text())).toEqual(['/salles/nimes', '/salles/lyon-nord']);
    expect(links[1]!.props('to')).toEqual({ name: 'venue-board', params: { slug: 'lyon-nord' } });
    expect(links[0]!.attributes('target')).toBe('_blank');
  });
});
