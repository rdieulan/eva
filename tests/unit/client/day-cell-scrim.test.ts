// Tests for DayCell with scrim searches: day picking and search badges
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayCell from '@/components/calendar/DayCell.vue';
import type { CalendarEvent, ScrimSearch } from '@shared/types';

const SEARCH_MINE: ScrimSearch = {
  id: 'search-mine', team: { id: 'us', name: 'Nous', logoUrl: null }, venueId: 'v', date: '2030-06-10',
  arenaNumber: 1, evaSlotIds: ['a', 'b'], startTime: '20:00', endTime: '21:20', convocationTime: '19:50',
  status: 'OPEN', isMine: true, createdAt: '',
};

const SEARCH_THEIRS: ScrimSearch = {
  ...SEARCH_MINE, id: 'search-theirs', team: { id: 'them', name: 'Les Autres', logoUrl: '/api/teams/them/logo?v=1' },
  startTime: '21:20', endTime: '22:00', isMine: false,
};

const EVENT: CalendarEvent = {
  id: 'event-1', date: '2030-06-10', startTime: '20:00', endTime: '21:20', type: 'MATCH', title: 'Scrim',
  evaSlotIds: [], createdById: 'p0', createdAt: '',
};

function mountCell(overrides: Record<string, unknown> = {}) {
  return mount(DayCell, {
    props: {
      date: '2030-06-10', dayNumber: 10, isCurrentMonth: true, isToday: false, isPast: false,
      currentPlayerStatus: null, playerAvailabilities: [], events: [],
      matchmaking: true, selectable: true,
      ...overrides,
    },
  });
}

describe('DayCell with scrim searches', () => {
  it('picks the day on click in matchmaking mode when the reader may search', async () => {
    const wrapper = mountCell();
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle-select')![0]).toEqual(['2030-06-10']);
    expect(wrapper.emitted('open-create-event')).toBeFalsy();
  });

  it('picks the day even when it holds events; the events stay reachable through their badge', async () => {
    const wrapper = mountCell({ events: [EVENT] });
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle-select')).toHaveLength(1);
    expect(wrapper.emitted('open-event-viewer')).toBeFalsy();

    await wrapper.find('.event-badge').trigger('click');
    expect(wrapper.emitted('open-event-viewer')![0]).toEqual([[EVENT], 0]);
  });

  it('does not pick a past day nor a day when the reader may not search', async () => {
    const past = mountCell({ isPast: true });
    await past.trigger('click');
    expect(past.emitted('toggle-select')).toBeFalsy();

    const readOnly = mountCell({ selectable: false });
    await readOnly.trigger('click');
    expect(readOnly.emitted('toggle-select')).toBeFalsy();
  });

  it('shows the picked state', () => {
    const wrapper = mountCell({ selected: true });
    expect(wrapper.classes()).toContain('is-selected');
    expect(wrapper.find('.selected-mark').exists()).toBe(true);
  });

  it('shows each search with its time and team, the team\'s own marked as such', () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_MINE, SEARCH_THEIRS] });
    const badges = wrapper.findAll('.search-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]!.text()).toContain('20:00');
    expect(badges[0]!.text()).toContain('Recherche');
    expect(badges[0]!.text()).not.toContain('Nous');
    expect(badges[0]!.classes()).toContain('search-badge--mine');
    expect(badges[1]!.text()).toContain('Les Autres');
    expect(badges[1]!.find('img.search-logo').attributes('src')).toBe('/api/teams/them/logo?v=1');
  });

  it('opens a search from its badge without picking the day', async () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_THEIRS] });
    await wrapper.find('.search-badge').trigger('click');
    expect(wrapper.emitted('open-search')![0]).toEqual([SEARCH_THEIRS]);
    expect(wrapper.emitted('toggle-select')).toBeFalsy();
  });

  it('shows the team\'s own searches in team mode too', () => {
    const wrapper = mountCell({ matchmaking: false, selectable: false, scrimSearches: [SEARCH_MINE] });
    expect(wrapper.find('.search-badge').exists()).toBe(true);
  });
});
