// Tests for DayCell component - past days behavior
import { describe, it, expect, vi, afterEach } from 'vitest';
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
    { playerId: 'player-1', playerName: 'Alice', status: 'AVAILABLE', hours: null },
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

  it('should NOT open the wheel of answers on a past day in edit mode', async () => {
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

    await wrapper.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerType: 'mouse' });
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 10 }));
    await wrapper.trigger('click');

    expect(wrapper.emitted('open-availability')).toBeFalsy();
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

  it('should open the wheel of answers where a tap lands on a future day in edit mode', async () => {
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

    await wrapper.trigger('pointerdown', { button: 0, clientX: 100, clientY: 120, pointerType: 'mouse' });
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 102, clientY: 121 }));
    await wrapper.trigger('click');

    expect(wrapper.emitted('open-availability')).toEqual([[{ date: '2026-12-15', x: 102, y: 121, dragging: false }]]);
    expect(wrapper.emitted('open-create-event')).toBeFalsy();
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

describe('DayCell Component - Pressing a day in edit mode', () => {
  const props = {
    date: '2026-12-15',
    dayNumber: 15,
    isCurrentMonth: true,
    isToday: false,
    isPast: false,
    currentPlayerStatus: null,
    playerAvailabilities: [],
    events: [],
    editMode: true,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the wheel under a press held still, the release left to pick the answer', async () => {
    vi.useFakeTimers();
    const wrapper = mount(DayCell, { props });

    await wrapper.trigger('pointerdown', { button: 0, clientX: 50, clientY: 60, pointerType: 'touch' });
    vi.advanceTimersByTime(299);
    expect(wrapper.emitted('open-availability')).toBeFalsy();
    vi.advanceTimersByTime(1);

    expect(wrapper.emitted('open-availability')).toEqual([[{ date: '2026-12-15', x: 50, y: 60, dragging: true }]]);
  });

  it('lets a finger that moves before the hold scroll the page: nothing opens', async () => {
    vi.useFakeTimers();
    const wrapper = mount(DayCell, { props });

    await wrapper.trigger('pointerdown', { button: 0, clientX: 50, clientY: 60, pointerType: 'touch' });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 90 }));
    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 90 }));

    expect(wrapper.emitted('open-availability')).toBeFalsy();
  });

  it('opens the wheel at once under a mouse that drags, where the press began', async () => {
    const wrapper = mount(DayCell, { props });

    await wrapper.trigger('pointerdown', { button: 0, clientX: 50, clientY: 60, pointerType: 'mouse' });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 90 }));

    expect(wrapper.emitted('open-availability')).toEqual([[{ date: '2026-12-15', x: 50, y: 60, dragging: true }]]);
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

  it('should show the clock of a partial answer in the yellow corner, with when it starts, and its hours in the tooltip', () => {
    const wrapper = mount(DayCell, {
      props: { ...baseProps, currentPlayerStatus: 'PARTIAL' as const, currentPlayerHours: { startTime: '21:30', endTime: '23:30' } },
    });

    const corner = wrapper.find('.corner');
    expect(corner.classes()).toContain('availability--partial');
    expect(corner.find('.svg-icon').exists()).toBe(true);
    expect(corner.findAll('.corner-hours span').map(line => line.text())).toEqual(['21h30', '–23h30']);
    expect(corner.find('.corner-hours').classes()).toContain('is-long');
    expect(corner.attributes('title')).toBe('Ma disponibilité : Dispo pour jouer de 21:30 à 23:30');
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
          { playerId: 'player-1', playerName: 'Nova', status: 'VOICE_ONLY' as const, hours: null },
          { playerId: 'player-2', playerName: 'Orion', status: null, hours: null },
          { playerId: 'player-3', playerName: 'Lune', status: 'UNAVAILABLE' as const, hours: null },
          { playerId: 'player-4', playerName: 'Moi', status: 'AVAILABLE' as const, hours: null },
          { playerId: 'player-5', playerName: 'Kyro', status: 'PARTIAL' as const, hours: { startTime: null, endTime: '22:00' } },
        ],
      },
    });

    // The reader is left out: the corner already says where they stand
    const players = wrapper.findAll('.roster-player');
    expect(players.map(player => player.text())).toEqual(['Kyrojusqu\'à 22:00', 'Nova', 'Lune', 'Orion']);
    expect(players[0]!.classes()).toContain('availability--partial');
    expect(players[0]!.attributes('title')).toBe('Kyro : Dispo pour jouer jusqu\'à 22:00');
    expect(players[1]!.classes()).toContain('availability--voice-only');
    expect(players[2]!.classes()).toContain('availability--unavailable');
    expect(players[3]!.classes()).toContain('availability--unset');
    expect(players[3]!.attributes('title')).toBe('Orion : Non renseigné');
    expect(wrapper.find('.items').exists()).toBe(false);
    expect(wrapper.classes()).toContain('edit-mode');
  });

  it('should draw a new symbol for another answer, or other hours, so it springs in over the old one', async () => {
    const wrapper = mount(DayCell, { props: { ...baseProps, currentPlayerStatus: 'AVAILABLE' as const } });
    const before = wrapper.find('.corner-symbol');
    expect(before.findComponent({ name: 'SvgIcon' }).props('name')).toBe('check');

    await wrapper.setProps({ currentPlayerStatus: 'PARTIAL' as const, currentPlayerHours: { startTime: '21:00', endTime: null } });
    const partial = wrapper.find('.corner-symbol');
    const hours = wrapper.find('.corner-hours');
    expect(hours.text()).toBe('21h–');
    expect(hours.classes()).not.toContain('is-long');
    expect(partial.element).not.toBe(before.element);

    await wrapper.setProps({ currentPlayerHours: { startTime: '22:00', endTime: null } });
    expect(wrapper.find('.corner-symbol').element).not.toBe(partial.element);
    expect(wrapper.find('.corner-hours').element).not.toBe(hours.element);
  });

  it('should show what is planned, not the roster, outside edit mode', () => {
    const wrapper = mount(DayCell, {
      props: {
        ...baseProps,
        editMode: false,
        currentPlayerStatus: null,
        playerAvailabilities: [{ playerId: 'player-1', playerName: 'Nova', status: 'AVAILABLE' as const, hours: null }],
      },
    });

    expect(wrapper.find('.roster').exists()).toBe(false);
    expect(wrapper.find('.items').exists()).toBe(true);
  });
});
