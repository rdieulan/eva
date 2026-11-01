// Tests for the modal that puts picked days up for an opponent
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ScrimSearchModal from '@/components/calendar/ScrimSearchModal.vue';
import { fetchVenueSlots, createScrimSearch } from '@/api';
import { ApiError } from '@/api/error';
import type { DayData, ScrimSearch, Venue, VenueSlot } from '@shared/types';
import { TEAM_PLAYER_COUNT } from '@shared/constants';

vi.mock('@/api', () => ({
  fetchVenueSlots: vi.fn(),
  createScrimSearch: vi.fn(),
}));

const slotsApi = vi.mocked(fetchVenueSlots);
const createApi = vi.mocked(createScrimSearch);

const VENUE: Venue = {
  id: 'venue-nimes', name: 'Nîmes', city: 'Nimes', address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
  website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
};

function slot(slotId: string, startTime: string, endTime: string, extra: Partial<VenueSlot> = {}): VenueSlot {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true, ...extra };
}

const DAY_SLOTS = [
  slot('s-1800', '18:00', '18:40', { isCompetitiveAvailable: false }),
  slot('s-2000', '20:00', '20:40'),
  slot('s-2040', '20:40', '21:20'),
  slot('s-2120', '21:20', '22:00', { takenSeats: 2 }),
];

function day(date: string, statuses: Array<DayData['playerAvailabilities'][number]['status']>): DayData {
  return {
    date,
    currentPlayerStatus: null,
    playerAvailabilities: statuses.map((status, index) => ({ playerId: `p${index}`, playerName: `J${index}`, status })),
    events: [],
    renewals: [],
  };
}

const READY = Array(TEAM_PLAYER_COUNT).fill('AVAILABLE') as Array<'AVAILABLE'>;

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(ScrimSearchModal, {
    props: {
      open: true,
      venue: VENUE,
      dates: ['2030-06-12', '2030-06-10'],
      days: { '2030-06-10': day('2030-06-10', READY), '2030-06-12': day('2030-06-12', ['AVAILABLE', 'UNAVAILABLE']) },
      ownSearches: [],
      ...overrides,
    },
    global: { stubs: { Teleport: true, Transition: false } },
  });
}

function slotButtons(wrapper: ReturnType<typeof mountModal>, dayIndex: number) {
  return wrapper.findAll('.day')[dayIndex]!.findAll('button.slot-row');
}

beforeEach(() => {
  slotsApi.mockReset();
  createApi.mockReset();
  slotsApi.mockResolvedValue(DAY_SLOTS);
});

describe('ScrimSearchModal', () => {
  it('lists the picked days in order, each with only the slots a match can take', async () => {
    const wrapper = mountModal();
    await flushPromises();

    const titles = wrapper.findAll('.day-title').map(title => title.text());
    expect(titles[0]).toContain('10 juin 2030');
    expect(titles[1]).toContain('12 juin 2030');

    // 18:00 is closed to the competitive mode, 21:20 has people in: both left out
    expect(slotButtons(wrapper, 0).map(button => button.text().slice(0, 5))).toEqual(['20:00', '20:40']);
  });

  it('warns on a day the team cannot line up, says nothing on a ready day', async () => {
    const wrapper = mountModal();
    await flushPromises();

    const days = wrapper.findAll('.day');
    expect(days[0]!.find('.lineup-note').exists()).toBe(false);
    expect(days[1]!.find('.lineup-note').text()).toContain(`Moins de ${TEAM_PLAYER_COUNT}`);
  });

  it('leaves out the slots the team already put up for an opponent', async () => {
    const mine: ScrimSearch = {
      id: 'search-1', team: { id: 't', name: 'Nous', logoUrl: null }, venueId: VENUE.id, date: '2030-06-10',
      arenaNumber: 1, evaSlotIds: ['s-2000'], startTime: '20:00', endTime: '20:40', convocationTime: '19:50',
      status: 'OPEN', isMine: true, createdAt: '',
    };
    const wrapper = mountModal({ ownSearches: [mine] });
    await flushPromises();

    expect(slotButtons(wrapper, 0).map(button => button.text().slice(0, 5))).toEqual(['20:40']);
  });

  it('opens one search per day with slots, and closes when all went through', async () => {
    createApi.mockResolvedValue({} as ScrimSearch);
    const wrapper = mountModal();
    await flushPromises();

    const submit = wrapper.findAll('button').find(button => button.text().startsWith('Ouvrir'))!;
    expect(submit.attributes('disabled')).toBeDefined();

    await slotButtons(wrapper, 0)[0]!.trigger('click');
    await slotButtons(wrapper, 0)[1]!.trigger('click');
    await slotButtons(wrapper, 1)[0]!.trigger('click');
    expect(submit.text()).toBe('Ouvrir 2 recherches');

    await submit.trigger('click');
    await flushPromises();

    expect(createApi).toHaveBeenCalledTimes(2);
    expect(createApi).toHaveBeenCalledWith({ venueId: VENUE.id, date: '2030-06-10', evaSlotIds: ['s-2000', 's-2040'] });
    expect(createApi).toHaveBeenCalledWith({ venueId: VENUE.id, date: '2030-06-12', evaSlotIds: ['s-2000'] });
    expect(wrapper.emitted('opened')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('keeps a day that was refused, with the reason, and drops the ones that opened', async () => {
    createApi
      .mockResolvedValueOnce({} as ScrimSearch)
      .mockRejectedValueOnce(new ApiError(['Un des créneaux a déjà des inscrits'], 'fallback'));
    const wrapper = mountModal();
    await flushPromises();

    await slotButtons(wrapper, 0)[0]!.trigger('click');
    await slotButtons(wrapper, 1)[0]!.trigger('click');
    await wrapper.findAll('button').find(button => button.text().startsWith('Ouvrir'))!.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.day')).toHaveLength(1);
    expect(wrapper.find('.day-title').text()).toContain('12 juin 2030');
    expect(wrapper.find('.day-error').text()).toBe('Un des créneaux a déjà des inscrits');
    expect(wrapper.emitted('opened')).toHaveLength(1);
    expect(wrapper.emitted('close')).toBeFalsy();
  });
});
