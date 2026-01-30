// Tests for DayCell component - past days behavior
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayCell from '@/components/calendar/DayCell.vue';
import type { CalendarEvent, PlayerAvailability } from '@shared/types';

describe('DayCell Component - Past Days Behavior', () => {
  const mockEvent: CalendarEvent = {
    id: 'event-1',
    date: '2025-01-15',
    startTime: '20:00',
    endTime: '22:00',
    type: 'MATCH',
    title: 'Past Match',
    createdById: 'admin-1',
    createdAt: '2025-01-01T00:00:00Z',
  };

  const mockPlayerAvailabilities: PlayerAvailability[] = [
    { userId: 'user-1', userName: 'Alice', status: 'AVAILABLE' },
  ];

  it('should emit open-event-viewer when clicking on past day with events', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2025-01-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: true,
        currentUserStatus: null,
        playerAvailabilities: mockPlayerAvailabilities,
        events: [mockEvent],
        editMode: false,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('open-event-viewer')).toBeTruthy();
    expect(wrapper.emitted('open-event-viewer')![0]).toEqual([[mockEvent], 0]);
  });

  it('should NOT emit set-availability when clicking on past day in edit mode', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2025-01-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: true,
        currentUserStatus: null,
        playerAvailabilities: mockPlayerAvailabilities,
        events: [],
        editMode: true,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('set-availability')).toBeFalsy();
  });

  it('should NOT emit open-create-event when clicking on past day without events', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2025-01-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: true,
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [],
        editMode: false,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('open-create-event')).toBeFalsy();
  });

  it('should emit open-event-viewer when clicking on event badge in past day', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2025-01-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: true,
        currentUserStatus: null,
        playerAvailabilities: mockPlayerAvailabilities,
        events: [mockEvent],
        editMode: false,
      },
    });

    const eventBadge = wrapper.find('.event-badge');
    await eventBadge.trigger('click');

    expect(wrapper.emitted('open-event-viewer')).toBeTruthy();
  });

  it('should NOT have pointer-events: none style blocking clicks', () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2025-01-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: true,
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [mockEvent],
        editMode: false,
      },
    });

    const cell = wrapper.find('.day-cell');
    expect(cell.classes()).toContain('is-past');
    // The cell should still be clickable (no pointer-events: none in computed style)
  });
});

describe('DayCell Component - Future Days Behavior', () => {
  const mockEvent: CalendarEvent = {
    id: 'event-1',
    date: '2026-12-15',
    startTime: '20:00',
    endTime: '22:00',
    type: 'MATCH',
    title: 'Future Match',
    createdById: 'admin-1',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('should emit set-availability when clicking on future day in edit mode', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2026-12-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: false,
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [],
        editMode: true,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('set-availability')).toBeTruthy();
    expect(wrapper.emitted('set-availability')![0]).toEqual(['AVAILABLE']);
  });

  it('should emit open-event-viewer when clicking on future day with events', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2026-12-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: false,
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [mockEvent],
        editMode: false,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('open-event-viewer')).toBeTruthy();
  });

  it('should emit open-create-event when clicking on future day without events', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2026-12-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: false,
        currentUserStatus: null,
        playerAvailabilities: [],
        events: [],
        editMode: false,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('open-create-event')).toBeTruthy();
    expect(wrapper.emitted('open-create-event')![0]).toEqual(['2026-12-15']);
  });
});
