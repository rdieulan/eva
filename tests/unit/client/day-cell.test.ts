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
    { playerId: 'player-1', playerName: 'Alice', status: 'AVAILABLE' },
  ];

  it('should emit open-event-viewer when clicking on past day with events', async () => {
    const wrapper = mount(DayCell, {
      props: {
        date: '2025-01-15',
        dayNumber: 15,
        isCurrentMonth: true,
        isToday: false,
        isPast: true,
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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
        currentPlayerStatus: null,
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

describe('DayCell Component - Subscription renewals', () => {
  const baseProps = {
    date: '2026-11-04',
    dayNumber: 4,
    isCurrentMonth: true,
    isToday: false,
    isPast: false,
    currentPlayerStatus: null,
    playerAvailabilities: [],
    events: [],
  };

  it('should not show a renewal strip on days without renewals', () => {
    const wrapper = mount(DayCell, { props: baseProps });

    expect(wrapper.find('.renewal-strip').exists()).toBe(false);
  });

  it('should list the players renewing that day, with their tier in the tooltip', () => {
    const wrapper = mount(DayCell, {
      props: {
        ...baseProps,
        renewals: [
          { playerId: 'player-1', playerName: 'Nova', tier: 'GOLD' as const },
          { playerId: 'player-2', playerName: 'Orion', tier: null },
        ],
        playerLabels: { 'player-1': 'No', 'player-2': 'Or' },
      },
    });

    const strip = wrapper.find('.renewal-strip');
    expect(strip.exists()).toBe(true);
    expect(strip.find('.renewal-names').text()).toBe('Nova, Orion');
    expect(strip.find('.renewal-labels').text()).toBe('No Or');
    expect(strip.attributes('title')).toBe("Renouvellement d'abonnement : Nova (Or), Orion");
  });
});

describe('DayCell Component - Voice only availability', () => {
  const baseProps = {
    date: '2026-12-15',
    dayNumber: 15,
    isCurrentMonth: true,
    isToday: false,
    isPast: false,
    playerAvailabilities: [],
    events: [],
    editMode: true,
  };

  it('should move from possible to voice only, then to unavailable', async () => {
    const fromConditional = mount(DayCell, { props: { ...baseProps, currentPlayerStatus: 'CONDITIONAL' as const } });
    await fromConditional.trigger('click');
    expect(fromConditional.emitted('set-availability')![0]).toEqual(['VOICE_ONLY']);

    const fromVoiceOnly = mount(DayCell, { props: { ...baseProps, currentPlayerStatus: 'VOICE_ONLY' as const } });
    await fromVoiceOnly.trigger('click');
    expect(fromVoiceOnly.emitted('set-availability')![0]).toEqual(['UNAVAILABLE']);
  });

  it('should colour the day and show a microphone behind it in edit mode', () => {
    const wrapper = mount(DayCell, { props: { ...baseProps, currentPlayerStatus: 'VOICE_ONLY' as const } });

    expect(wrapper.classes()).toContain('availability--voice-only');
    expect(wrapper.find('.status-bg-icon .svg-icon').exists()).toBe(true);
  });

  it('should colour a voice-only player badge and explain it in its tooltip', () => {
    const wrapper = mount(DayCell, {
      props: {
        ...baseProps,
        editMode: false,
        currentPlayerStatus: null,
        playerAvailabilities: [{ playerId: 'player-1', playerName: 'Nova', status: 'VOICE_ONLY' as const }],
      },
    });

    const badge = wrapper.find('.player-avatar');
    expect(badge.classes()).toContain('availability--voice-only');
    expect(badge.attributes('title')).toBe('Nova : Dispo pour le vocal uniquement');
  });
});
