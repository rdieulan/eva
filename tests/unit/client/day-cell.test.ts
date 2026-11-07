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
    evaSlotIds: [],
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

  it('should show the icon of the kind of event on its row', () => {
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

    const badge = wrapper.find('.event-badge');
    expect(badge.classes()).toContain('event-type--match');
    expect(badge.find('.item-icon .svg-icon, .item-icon.svg-icon').exists()).toBe(true);
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
    evaSlotIds: [],
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
      },
    });

    const strip = wrapper.find('.renewal-strip');
    expect(strip.exists()).toBe(true);
    expect(strip.find('.renewal-icon').exists()).toBe(true);
    expect(strip.find('.renewal-names').text()).toBe('Nova, Orion');
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

  it('should show a microphone in the voice-coloured corner of the day', () => {
    const wrapper = mount(DayCell, { props: { ...baseProps, currentPlayerStatus: 'VOICE_ONLY' as const } });

    const corner = wrapper.find('.corner');
    expect(corner.classes()).toContain('availability--voice-only');
    expect(corner.find('.svg-icon').exists()).toBe(true);
  });

  it('should list the teammates with their status in edit mode, most available first, unset told apart from unavailable', () => {
    const wrapper = mount(DayCell, {
      props: {
        ...baseProps,
        currentPlayerStatus: null,
        currentPlayerId: 'player-4',
        playerAvailabilities: [
          { playerId: 'player-1', playerName: 'Nova', status: 'VOICE_ONLY' as const },
          { playerId: 'player-2', playerName: 'Orion', status: null },
          { playerId: 'player-3', playerName: 'Lune', status: 'UNAVAILABLE' as const },
          { playerId: 'player-4', playerName: 'Moi', status: 'AVAILABLE' as const },
        ],
      },
    });

    // The reader is left out: the cell colour already says where they stand
    const players = wrapper.findAll('.roster-player');
    expect(players.map(player => player.text())).toEqual(['Nova', 'Lune', 'Orion']);
    expect(players[0]!.classes()).toContain('availability--voice-only');
    expect(players[1]!.classes()).toContain('availability--unavailable');
    expect(players[2]!.classes()).toContain('availability--unset');
    expect(players[2]!.attributes('title')).toBe('Orion : Non renseigné');
    expect(wrapper.find('.items').exists()).toBe(false);
    expect(wrapper.classes()).toContain('edit-mode');
  });

  it('should draw a new symbol when a click sets another status, so it springs in over the old one', async () => {
    const wrapper = mount(DayCell, { props: { ...baseProps, currentPlayerStatus: 'AVAILABLE' as const } });
    const before = wrapper.find('.corner-symbol');
    expect(before.text()).toBe('✓');

    await wrapper.setProps({ currentPlayerStatus: 'CONDITIONAL' as const });

    const after = wrapper.find('.corner-symbol');
    expect(after.text()).toBe('~');
    expect(after.element).not.toBe(before.element);
  });

  it('should show what is planned, not the roster, outside edit mode', () => {
    const wrapper = mount(DayCell, {
      props: {
        ...baseProps,
        editMode: false,
        currentPlayerStatus: null,
        playerAvailabilities: [{ playerId: 'player-1', playerName: 'Nova', status: 'AVAILABLE' as const }],
      },
    });

    expect(wrapper.find('.roster').exists()).toBe(false);
    expect(wrapper.find('.items').exists()).toBe(true);
  });
});
