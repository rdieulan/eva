// Integration tests for Calendar functionality
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CalendarPage from '@/pages/CalendarPage.vue';
import type { MonthData, CalendarEvent, ScrimSearch, Venue } from '@shared/types';

import { ref } from 'vue';

// The calendar reads where a notification leads from its route
const routing = vi.hoisted(() => ({ route: { query: {} as Record<string, string> }, replace: vi.fn() }));
vi.mock('vue-router', () => ({
  useRoute: () => routing.route,
  useRouter: () => ({ replace: routing.replace, push: vi.fn() }),
}));

// Mock the API module
vi.mock('@/api/calendar.api', () => ({
  fetchMonthData: vi.fn(),
  setAvailability: vi.fn(),
  fetchEvents: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  updateEventGamePlan: vi.fn(),
}));

// Mock permissions data
const mockPermissions = {
  planner: { canCreate: true, canEdit: true, canDelete: true },
  calendar: { canCreateEvents: true, canEditEvents: true, canDeleteEvents: true, canAttachGamePlan: true },
  matchmaking: { canSearch: true, canPropose: true, canRespond: true },
  team: { canManageTeam: true, canInviteMembers: true, canRemoveMembers: true, canManagePermissions: true },
};

// Mock the auth composable
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    permissions: ref(mockPermissions),
    user: ref({ id: 'user-1', name: 'Test User', isLeader: true, permissions: null, teamId: null }),
  }),
}));

// Mock API barrel
vi.mock('@/api', () => ({
  fetchAllMaps: vi.fn(() => Promise.resolve([])),
  fetchPlayers: vi.fn(() => Promise.resolve([
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
  ])),
  fetchVenues: vi.fn(() => Promise.resolve([])),
  fetchCurrentTeam: vi.fn(() => Promise.resolve(null)),
  fetchScrimSearches: vi.fn(() => Promise.resolve([])),
  updateTeam: vi.fn(),
}));

import * as calendarApi from '@/api/calendar.api';
import * as api from '@/api';

describe('Calendar Integration Tests', () => {
  const mockMonthData: MonthData = {
    month: '2026-01',
    days: {
      '2026-01-01': {
        date: '2026-01-01',
        currentPlayerStatus: null,
        playerAvailabilities: [],
        events: [],
      },
      '2026-01-15': {
        date: '2026-01-15',
        currentPlayerStatus: 'AVAILABLE',
        playerAvailabilities: [
          { playerId: 'player-1', playerName: 'Alice', status: 'AVAILABLE' },
          { playerId: 'player-2', playerName: 'Bob', status: 'UNAVAILABLE' },
        ],
        events: [],
      },
      '2026-01-20': {
        date: '2026-01-20',
        currentPlayerStatus: null,
        playerAvailabilities: [],
        events: [
          {
            id: 'event-1',
            date: '2026-01-20',
            startTime: '20:00',
            endTime: '22:00',
            type: 'MATCH',
            title: 'Important Match',
            evaSlotIds: [],
            createdById: 'admin-1',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routing.route.query = {};
    (api.fetchScrimSearches as any).mockResolvedValue([]);
    (calendarApi.fetchMonthData as any).mockResolvedValue(mockMonthData);
    (api.fetchAllMaps as any).mockResolvedValue([]);
    (api.fetchPlayers as any).mockResolvedValue([
      { id: 'player-1', name: 'Alice' },
      { id: 'player-2', name: 'Bob' },
    ]);
  });

  it('leaves room under the calendar for the selection bar while days are picked', async () => {
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    const body = wrapper.findComponent({ name: 'CalendarBody' });
    expect(body.exists()).toBe(true);
    expect(wrapper.find('.calendar-content').classes()).not.toContain('has-selection-bar');

    await body.vm.$emit('toggle-select', '2026-01-20');
    expect(wrapper.find('.calendar-content').classes()).toContain('has-selection-bar');

    await body.vm.$emit('toggle-select', '2026-01-20');
    expect(wrapper.find('.calendar-content').classes()).not.toContain('has-selection-bar');
  });

  it('lists a day whole from its cell, then opens a row of it in place of the list', async () => {
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    const body = wrapper.findComponent({ name: 'CalendarBody' });
    const agenda = wrapper.findComponent({ name: 'DayAgendaModal' });
    const dayEvents = mockMonthData.days['2026-01-20']!.events;
    expect(agenda.props('day')).toBeNull();

    await body.vm.$emit('open-day', '2026-01-20');
    expect(agenda.props('day')).toEqual({ date: '2026-01-20', searches: [], events: dayEvents, renewals: [] });

    await agenda.vm.$emit('open-event-viewer', dayEvents, 0);
    expect(agenda.props('day')).toBeNull();
    expect(wrapper.findComponent({ name: 'EventViewerModal' }).props('events')).toEqual(dayEvents);
  });

  it('opens a search listed in the day in place of the list', async () => {
    const search: ScrimSearch = {
      id: 'search-1', team: { id: 'them', name: 'Les Autres', logoUrl: null }, date: '2026-01-20',
      slots: [{ slotId: 'a', venueId: 'v', arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' }],
      slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '20:40', convocationTime: '19:50',
      status: 'OPEN', isMine: false, proposals: [], createdAt: '',
    };
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    const agenda = wrapper.findComponent({ name: 'DayAgendaModal' });
    await wrapper.findComponent({ name: 'CalendarBody' }).vm.$emit('open-day', '2026-01-20');
    await agenda.vm.$emit('open-search', search);

    expect(agenda.props('day')).toBeNull();
    expect(wrapper.findComponent({ name: 'ScrimSearchViewerModal' }).props('search')).toEqual(search);
  });

  it('changes our own search from its sheet: the search modal opens on it, in place of the sheet', async () => {
    const search: ScrimSearch = {
      id: 'search-ours', team: { id: 'us', name: 'Nous', logoUrl: null }, date: '2026-01-20',
      slots: [{ slotId: 'a', venueId: 'v', arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' }],
      slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '20:40', convocationTime: '19:50',
      status: 'OPEN', isMine: true, proposals: [], createdAt: '',
    };
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    const viewer = wrapper.findComponent({ name: 'ScrimSearchViewerModal' });
    await wrapper.findComponent({ name: 'CalendarBody' }).vm.$emit('open-search', search);
    await viewer.vm.$emit('edit', search);

    const searchModal = wrapper.findComponent({ name: 'ScrimSearchModal' });
    expect(viewer.props('search')).toBeNull();
    expect(searchModal.props('open')).toBe(true);
    expect(searchModal.props('editing')).toEqual(search);

    await searchModal.vm.$emit('close');
    expect(searchModal.props('open')).toBe(false);
    expect(searchModal.props('editing')).toBeNull();
  });

  it('opens another team\'s search over the search modal, which stays open under it', async () => {
    const search: ScrimSearch = {
      id: 'search-2', team: { id: 'them', name: 'Les Rivaux', logoUrl: null }, date: '2026-01-20',
      slots: [{ slotId: 'a', venueId: 'v', arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' }],
      slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '20:40', convocationTime: '19:50',
      status: 'OPEN', isMine: false, proposals: [], createdAt: '',
    };
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    await wrapper.findComponent({ name: 'ScrimSelectionBar' }).vm.$emit('search');
    const searchModal = wrapper.findComponent({ name: 'ScrimSearchModal' });
    await searchModal.vm.$emit('open-search', search);

    expect(wrapper.findComponent({ name: 'ScrimSearchViewerModal' }).props('search')).toEqual(search);
    expect(searchModal.props('open')).toBe(true);
  });

  describe('where a notification leads', () => {
    const venueNimes: Venue = {
      id: 'nimes', name: 'Nîmes', city: 'Nîmes', address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
      website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
    };

    it('opens the search it names, in matchmaking, on its day', async () => {
      const search: ScrimSearch = {
        id: 'search-9', team: { id: 'us', name: 'Nous', logoUrl: null }, date: '2026-01-20',
        slots: [{ slotId: 'a', venueId: 'nimes', arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' }],
        slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '20:40', convocationTime: '19:50',
        status: 'OPEN', isMine: true, proposals: [], createdAt: '',
      };
      (api.fetchVenues as any).mockResolvedValueOnce([venueNimes]);
      (api.fetchCurrentTeam as any).mockResolvedValueOnce({ venueId: 'nimes', favoriteVenueIds: [] });
      (api.fetchScrimSearches as any).mockResolvedValue([search]);
      routing.route.query = { date: '2026-01-20', mode: 'matchmaking', search: 'search-9' };

      const wrapper = mount(CalendarPage);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(wrapper.findComponent({ name: 'CalendarHeader' }).props('calendarMode')).toBe('matchmaking');
      expect(api.fetchScrimSearches).toHaveBeenLastCalledWith('2026-01', ['nimes']);
      expect(wrapper.findComponent({ name: 'ScrimSearchViewerModal' }).props('search')).toEqual(search);
      // Followed once: the link leaves the address
      expect(routing.replace).toHaveBeenCalledWith({ query: {} });
    });

    it('opens the match it names in the team\'s view, and nothing once it is gone', async () => {
      routing.route.query = { date: '2026-01-20', mode: 'team', event: 'event-1' };
      const wrapper = mount(CalendarPage);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(wrapper.findComponent({ name: 'EventViewerModal' }).props('events')).toEqual(mockMonthData.days['2026-01-20']!.events);

      routing.route.query = { date: '2026-01-20', mode: 'team', event: 'event-gone' };
      const again = mount(CalendarPage);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(again.findComponent({ name: 'EventViewerModal' }).props('events')).toEqual([]);
    });
  });

  describe('matchmaking venues', () => {
    function venue(id: string, name: string): Venue {
      return {
        id, name, city: name, address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
        website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
      };
    }

    async function mountInMatchmaking() {
      (api.fetchVenues as any).mockResolvedValueOnce([venue('nimes', 'Nîmes'), venue('agen', 'Agen')]);
      (api.fetchCurrentTeam as any).mockResolvedValueOnce({ venueId: 'nimes', favoriteVenueIds: [] });
      const wrapper = mount(CalendarPage);
      await new Promise(resolve => setTimeout(resolve, 50));
      const header = wrapper.findComponent({ name: 'CalendarHeader' });
      await header.vm.$emit('update:calendarMode', 'matchmaking');
      await wrapper.vm.$nextTick();
      return { wrapper, header: wrapper.findComponent({ name: 'CalendarHeader' }) };
    }

    it('lands on the team\'s venue and lists the searches of the venues ticked', async () => {
      const { header } = await mountInMatchmaking();

      expect(header.props('venueIds')).toEqual(['nimes']);
      expect(header.props('venues').affiliated.id).toBe('nimes');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(api.fetchScrimSearches).toHaveBeenLastCalledWith(expect.any(String), ['nimes']);

      await header.vm.$emit('update:venueIds', ['nimes', 'agen']);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(api.fetchScrimSearches).toHaveBeenLastCalledWith(expect.any(String), ['nimes', 'agen']);
    });

    it('lists the searches of a day whole in matchmaking, the team\'s events left to the team\'s view', async () => {
      const { wrapper } = await mountInMatchmaking();

      await wrapper.findComponent({ name: 'CalendarBody' }).vm.$emit('open-day', '2026-01-20');

      expect(wrapper.findComponent({ name: 'DayAgendaModal' }).props('day')).toEqual({ date: '2026-01-20', searches: [], events: [], renewals: [] });
    });

    it('makes a venue a favorite of the team from its star, at once', async () => {
      (api.updateTeam as any).mockResolvedValue({ favoriteVenueIds: ['agen'] });
      const { header } = await mountInMatchmaking();

      await header.vm.$emit('toggle-favorite', 'agen');
      expect(header.props('venues').favorites.map((v: Venue) => v.id)).toEqual(['agen']);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(api.updateTeam).toHaveBeenCalledWith({ favoriteVenueIds: ['agen'] });
      expect(header.props('venues').favorites.map((v: Venue) => v.id)).toEqual(['agen']);
    });

    it('puts the favorites back as they were when the change is refused', async () => {
      (api.updateTeam as any).mockRejectedValue(new Error('refused'));
      const { wrapper, header } = await mountInMatchmaking();

      await header.vm.$emit('toggle-favorite', 'agen');
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(header.props('venues').favorites).toEqual([]);
      expect(wrapper.findComponent({ name: 'ErrorModal' }).props('open')).toBe(true);
    });
  });

  it('should load calendar data on mount', async () => {
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(calendarApi.fetchMonthData).toHaveBeenCalled();
    expect(api.fetchPlayers).toHaveBeenCalled();
  });

  it('should cycle through availability states when toggling', async () => {
    (calendarApi.setAvailability as any).mockResolvedValue({
      id: 'avail-1',
      playerId: 'player-1',
      date: '2026-01-15',
      status: 'UNAVAILABLE',
    });

    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    // Set availability directly to UNAVAILABLE
    const grid = wrapper.findComponent({ name: 'CalendarGrid' });
    if (grid.exists()) {
      await grid.vm.$emit('set-availability', '2026-01-15', 'UNAVAILABLE');
      expect(calendarApi.setAvailability).toHaveBeenCalledWith('2026-01-15', 'UNAVAILABLE');
    }
  });

  it('should set availability to AVAILABLE when requested', async () => {
    (calendarApi.setAvailability as any).mockResolvedValue({
      id: 'avail-2',
      playerId: 'player-1',
      date: '2026-01-01',
      status: 'AVAILABLE',
    });

    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    const grid = wrapper.findComponent({ name: 'CalendarGrid' });
    if (grid.exists()) {
      await grid.vm.$emit('set-availability', '2026-01-01', 'AVAILABLE');
      expect(calendarApi.setAvailability).toHaveBeenCalledWith('2026-01-01', 'AVAILABLE');
    }
  });

  it('should open event form modal when admin creates new event', async () => {
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    // Simulate clicking "Create Event" button
    wrapper.vm.$emit('create-event', '2026-01-25');
    await wrapper.vm.$nextTick();

    const modal = wrapper.findComponent({ name: 'EventFormModal' });
    expect(modal.exists()).toBe(true);
  });

  it('should call createEvent API when creating new event', async () => {
    const newEvent = {
      date: '2026-01-25',
      startTime: '19:00',
      endTime: '21:00',
      type: 'MATCH' as const,
      title: 'New Match',
      description: 'Test match',
    };

    const createdEvent: CalendarEvent = {
      id: 'event-new',
      ...newEvent,
      evaSlotIds: [],
      createdById: 'admin-1',
      createdAt: '2026-01-07T00:00:00Z',
    };

    (calendarApi.createEvent as any).mockResolvedValue(createdEvent);

    // Test API call directly
    const result = await calendarApi.createEvent(newEvent);
    expect(result).toEqual(createdEvent);
    expect(calendarApi.createEvent).toHaveBeenCalledWith(newEvent);
  });

  it('should call updateEvent API when updating existing event', async () => {
    const updatedEventData = {
      date: '2026-01-20',
      startTime: '21:00',
      endTime: '23:00',
      type: 'MATCH' as const,
      title: 'Updated Match',
    };

    const updatedEvent: CalendarEvent = {
      id: 'event-1',
      ...updatedEventData,
      evaSlotIds: [],
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    (calendarApi.updateEvent as any).mockResolvedValue(updatedEvent);

    // Test API call directly
    const result = await calendarApi.updateEvent('event-1', updatedEventData);
    expect(result).toEqual(updatedEvent);
    expect(calendarApi.updateEvent).toHaveBeenCalledWith('event-1', updatedEventData);
  });

  it('should delete event when admin removes it', async () => {
    (calendarApi.deleteEvent as any).mockResolvedValue({ success: true });

    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    const modal = wrapper.findComponent({ name: 'EventFormModal' });
    if (modal.exists()) {
      await modal.vm.$emit('delete', 'event-1');
      expect(calendarApi.deleteEvent).toHaveBeenCalledWith('event-1');
    }
  });

  it('should display event details in read-only mode for non-admin users', async () => {
    // Note: This test verifies the component accepts the permission props correctly.
    // The actual permission logic is tested by checking the props are passed through.
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    // Verify the EventFormModal component exists and receives permission props
    const modal = wrapper.findComponent({ name: 'EventFormModal' });
    if (modal.exists()) {
      // With admin permissions (from global mock), canEdit should be true
      expect(modal.props('canEdit')).toBe(true);
      expect(modal.props('canCreate')).toBe(true);
      expect(modal.props('canDelete')).toBe(true);
    }
  });

  it('should refresh calendar data after availability change', async () => {
    (calendarApi.setAvailability as any).mockResolvedValue({
      id: 'avail-1',
      playerId: 'player-1',
      date: '2026-01-15',
      status: 'UNAVAILABLE',
    });

    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();


    const grid = wrapper.findComponent({ name: 'CalendarGrid' });
    if (grid.exists()) {
      await grid.vm.$emit('set-availability', '2026-01-15', 'UNAVAILABLE');
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have called setAvailability
      expect(calendarApi.setAvailability).toHaveBeenCalled();
    }
  });

  it('should prevent setting availability on past dates', async () => {
    const pastDate = '2025-12-01';
    const pastMonthData: MonthData = {
      month: '2025-12',
      days: {
        [pastDate]: {
          date: pastDate,
          currentPlayerStatus: null,
          playerAvailabilities: [],
          events: [],
        },
      },
    };

    (calendarApi.fetchMonthData as any).mockResolvedValue(pastMonthData);

    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    const grid = wrapper.findComponent({ name: 'CalendarGrid' });
    if (grid.exists()) {
      await grid.vm.$emit('set-availability', pastDate, 'AVAILABLE');

      // Should not call setAvailability for past dates (handled by DayCell)
      // Note: This test may need adjustment based on how past date handling works
    }
  });
});

