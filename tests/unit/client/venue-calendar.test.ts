// Tests for VenueCalendar: the calendar of a venue, its competitions, its
// events and the matches played there, laid out as the team's calendar is
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VenueCalendar from '@/components/calendar/VenueCalendar.vue';
import { fetchVenueCalendar } from '@/api';
import { ApiError } from '@/api/error';
import type { VenueCalendarItem } from '@shared/types';

vi.mock('@/api', () => ({
  fetchVenueCalendar: vi.fn(),
}));

const NIGHT: VenueCalendarItem = {
  type: 'EVENT', id: 'event-1', venueName: 'Nîmes', title: 'Nocturne', date: '2026-11-13', startTime: '21:00', endTime: '23:59',
  description: null, teamsAdding: 2,
};

const MATCH: VenueCalendarItem = {
  type: 'MATCH', id: 'match-1', date: '2026-11-13', startTime: '20:00', endTime: '21:20', title: 'Calme Plat vs Les Rivaux',
  arenaNumber: 1, slotCount: 2, fromMatchmaking: true,
  teams: [{ id: 't1', name: 'Calme Plat', logoUrl: null }, { id: 't2', name: 'Les Rivaux', logoUrl: null }],
};

// A busy day: more than a day shows
function busyDay(count: number): VenueCalendarItem[] {
  return Array.from({ length: count }, (_, index) => ({ ...NIGHT, id: `busy-${index}`, date: '2026-11-24', startTime: `1${index}:00`, title: `Soirée ${index}` }));
}

function mountCalendar() {
  return mount(VenueCalendar, { props: { venueId: 'nimes' }, global: { stubs: { Teleport: true } } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 11, 12));
  vi.mocked(fetchVenueCalendar).mockReset();
  vi.mocked(fetchVenueCalendar).mockResolvedValue([MATCH, NIGHT, ...busyDay(6)]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VenueCalendar', () => {
  it('loads the month in sight, then the one it moves to', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    expect(fetchVenueCalendar).toHaveBeenCalledWith('nimes', '2026-11');
    expect(wrapper.find('.nav-title').text()).toBe('Novembre 2026');

    await wrapper.find('button[title="Mois suivant"]').trigger('click');
    await flushPromises();
    expect(fetchVenueCalendar).toHaveBeenLastCalledWith('nimes', '2026-12');
  });

  it('shows what each day holds in its rows, by the hour, read by no team', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    const rows = wrapper.findAll('.event-badge').map(row => row.text());
    expect(rows.slice(0, 2)).toEqual(['20:00Calme Plat vs Les Rivaux', '21:00Nocturne']);
    expect(wrapper.findAll('.day-cell.venue-day')).toHaveLength(42);
    expect(wrapper.find('.corner').exists()).toBe(false);
  });

  it('opens what a row shows, and a busy day whole from the row counting the rest', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    await wrapper.findAll('.event-badge')[1]!.trigger('click');
    expect(wrapper.findComponent({ name: 'VenueCalendarItemModal' }).props('item')).toEqual(NIGHT);
    await wrapper.find('.btn-close-sheet').trigger('click');

    const overflow = wrapper.find('.overflow-row');
    expect(overflow.text()).toBe('+2 autres');
    await overflow.trigger('click');
    const agenda = wrapper.findComponent({ name: 'DayAgendaModal' });
    expect(agenda.props('day')).toMatchObject({ date: '2026-11-24', events: busyDay(6) });

    await wrapper.findAll('.agenda .event-badge')[5]!.trigger('click');
    expect(agenda.props('day')).toBeNull();
    expect(wrapper.findComponent({ name: 'VenueCalendarItemModal' }).props('item')).toEqual(busyDay(6)[5]);
  });

  it('opens nothing from a day with nothing planned', async () => {
    vi.mocked(fetchVenueCalendar).mockResolvedValue([]);
    const wrapper = mountCalendar();
    await flushPromises();

    await wrapper.findAll('.day-cell')[20]!.trigger('click');

    expect(wrapper.findComponent({ name: 'VenueCalendarItemModal' }).props('item')).toBeNull();
    expect(wrapper.findComponent({ name: 'DayAgendaModal' }).props('day')).toBeNull();
  });

  it('lays a week out from the switch', async () => {
    const wrapper = mountCalendar();
    await flushPromises();

    await wrapper.findAll('[role="radio"]').find(radio => radio.text() === 'Semaine')!.trigger('click');

    expect(wrapper.find('.nav-title').text()).toBe('9 - 15 Novembre 2026');
    expect(wrapper.findAll('.week-day-column')).toHaveLength(7);
    expect(wrapper.findAll('.event-badge').map(row => row.text())).toEqual(['20:00Calme Plat vs Les Rivaux', '21:00Nocturne']);
  });

  it('says why when the month cannot be read', async () => {
    vi.mocked(fetchVenueCalendar).mockRejectedValue(new ApiError(['Impossible de charger le calendrier de la salle'], 'fallback'));
    const wrapper = mountCalendar();
    await flushPromises();

    expect(wrapper.text()).toContain('Impossible de charger le calendrier de la salle');
  });
});
