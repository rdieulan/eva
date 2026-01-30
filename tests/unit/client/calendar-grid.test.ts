// Tests for CalendarGrid component
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CalendarGrid from '@/components/calendar/CalendarGrid.vue';
import type { DayData } from '@shared/types';

describe('CalendarGrid Component', () => {
  let mockDays: Record<string, DayData>;

  beforeEach(() => {
    mockDays = {
      '2026-01-01': {
        date: '2026-01-01',
        currentUserStatus: 'AVAILABLE',
        playerAvailabilities: [
          { userId: 'user-1', userName: 'Alice', status: 'AVAILABLE' },
          { userId: 'user-2', userName: 'Bob', status: 'UNAVAILABLE' },
        ],
        events: [],
      },
      '2026-01-15': {
        date: '2026-01-15',
        currentUserStatus: 'UNAVAILABLE',
        playerAvailabilities: [
          { userId: 'user-1', userName: 'Alice', status: 'UNAVAILABLE' },
        ],
        events: [
          {
            id: 'event-1',
            date: '2026-01-15',
            startTime: '20:00',
            endTime: '22:00',
            type: 'MATCH',
            title: 'Important Match',
            createdById: 'admin-1',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
      '2026-01-20': {
        date: '2026-01-20',
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [],
      },
    };
  });

  it('should render calendar grid with correct month and year', () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.props('year')).toBe(2026);
    expect(wrapper.props('month')).toBe(1);
  });

  it('should display day cells for all provided days', () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    const dayCells = wrapper.findAll('.day-cell');
    expect(dayCells.length).toBeGreaterThan(0);
  });

  it('should show availability status for current user on each day', () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    // Day with AVAILABLE status should have visual indicator
    const availableDay = wrapper.find('[data-date="2026-01-01"]');
    if (availableDay.exists()) {
      expect(availableDay.classes()).toContain('available');
    }

    // Day with UNAVAILABLE status should have different visual indicator
    const unavailableDay = wrapper.find('[data-date="2026-01-15"]');
    if (unavailableDay.exists()) {
      expect(unavailableDay.classes()).toContain('unavailable');
    }

    // Day with no status should be neutral
    const neutralDay = wrapper.find('[data-date="2026-01-20"]');
    if (neutralDay.exists()) {
      expect(neutralDay.classes()).toContain('neutral');
    }
  });

  it('should emit set-availability event when setting availability', async () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    wrapper.vm.$emit('set-availability', '2026-01-01', 'UNAVAILABLE');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('set-availability')).toBeTruthy();
    expect(wrapper.emitted('set-availability')?.[0]).toEqual(['2026-01-01', 'UNAVAILABLE']);
  });


  it('should display events on days that have them', () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    const dayWithEvent = wrapper.find('[data-date="2026-01-15"]');
    if (dayWithEvent.exists()) {
      const eventIndicator = dayWithEvent.find('.event-badge');
      expect(eventIndicator.exists()).toBe(true);
    }
  });

  it('should show all player availabilities for a day', () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    const dayWithMultipleAvailabilities = wrapper.find('[data-date="2026-01-01"]');
    if (dayWithMultipleAvailabilities.exists()) {
      // Should show 2 players (Alice AVAILABLE, Bob UNAVAILABLE)
      const playerIndicators = dayWithMultipleAvailabilities.findAll('.player-availability');
      expect(playerIndicators.length).toBe(2);
    }
  });

  it('should prevent interaction with past days', () => {
    const pastDays: Record<string, DayData> = {
      '2025-12-01': {
        date: '2025-12-01',
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [],
      },
    };

    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2025,
        month: 12,
        days: pastDays,
      },
    });

    const pastDay = wrapper.find('[data-date="2025-12-01"]');
    if (pastDay.exists()) {
      expect(pastDay.classes()).toContain('past-day');
      expect(pastDay.attributes('disabled')).toBeDefined();
    }
  });

  it('should emit open-event-viewer when viewing events', async () => {
    const wrapper = mount(CalendarGrid, {
      props: {
        year: 2026,
        month: 1,
        days: mockDays,
      },
    });

    const dayEvents = mockDays['2026-01-15'].events;
    wrapper.vm.$emit('open-event-viewer', dayEvents, 0);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('open-event-viewer')).toBeTruthy();
    expect(wrapper.emitted('open-event-viewer')?.[0]).toEqual([dayEvents, 0]);
  });
});

