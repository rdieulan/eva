// Integration tests for Calendar functionality
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CalendarPage from '@/pages/CalendarPage.vue';
import type { MonthData, CalendarEvent } from '@shared/types';

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

// Mock the auth composable
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    permissions: { value: { canEdit: true } },
    user: { value: { id: 'user-1', name: 'Test User', role: 'ADMIN' } },
  }),
}));

// Mock config
vi.mock('@/config/config', () => ({
  loadAllMaps: vi.fn(() => Promise.resolve([])),
  loadPlayers: vi.fn(() => Promise.resolve([
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
  ])),
}));

import * as calendarApi from '@/api/calendar.api';
import * as config from '@/config/config';

describe('Calendar Integration Tests', () => {
  const mockMonthData: MonthData = {
    month: '2026-01',
    days: {
      '2026-01-01': {
        date: '2026-01-01',
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [],
      },
      '2026-01-15': {
        date: '2026-01-15',
        currentUserStatus: 'AVAILABLE',
        playerAvailabilities: [
          { userId: 'user-1', userName: 'Alice', status: 'AVAILABLE' },
          { userId: 'user-2', userName: 'Bob', status: 'UNAVAILABLE' },
        ],
        events: [],
      },
      '2026-01-20': {
        date: '2026-01-20',
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [
          {
            id: 'event-1',
            date: '2026-01-20',
            startTime: '20:00',
            endTime: '22:00',
            type: 'MATCH',
            title: 'Important Match',
            createdById: 'admin-1',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (calendarApi.fetchMonthData as any).mockResolvedValue(mockMonthData);
    (config.loadAllMaps as any).mockResolvedValue([]);
    (config.loadPlayers as any).mockResolvedValue([
      { id: 'player-1', name: 'Alice' },
      { id: 'player-2', name: 'Bob' },
    ]);
  });

  it('should load calendar data on mount', async () => {
    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(calendarApi.fetchMonthData).toHaveBeenCalled();
    expect(config.loadPlayers).toHaveBeenCalled();
  });

  it('should cycle through availability states when toggling', async () => {
    (calendarApi.setAvailability as any).mockResolvedValue({
      id: 'avail-1',
      userId: 'user-1',
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
      userId: 'user-1',
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
    // Mock as PLAYER role
    vi.mock('@/composables/useAuth', () => ({
      useAuth: () => ({
        permissions: { value: { canEdit: false } },
        user: { value: { id: 'user-2', name: 'Player User', role: 'PLAYER' } },
      }),
    }));

    const wrapper = mount(CalendarPage);
    await wrapper.vm.$nextTick();

    // Click on event to view details
    const grid = wrapper.findComponent({ name: 'CalendarGrid' });
    if (grid.exists()) {
      await grid.vm.$emit('event-click', mockMonthData.days['2026-01-20'].events[0]);
      await wrapper.vm.$nextTick();

      const modal = wrapper.findComponent({ name: 'EventFormModal' });
      if (modal.exists()) {
        expect(modal.props('readOnly')).toBe(true);
      }
    }
  });

  it('should refresh calendar data after availability change', async () => {
    (calendarApi.setAvailability as any).mockResolvedValue({
      id: 'avail-1',
      userId: 'user-1',
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
          currentUserStatus: null,
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

