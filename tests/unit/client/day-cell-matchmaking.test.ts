// Tests for DayCell in matchmaking mode: the day is coloured by the team's lineup
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayCell from '@/components/calendar/DayCell.vue';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import type { AvailabilityStatus, CalendarEvent, PlayerAvailability } from '@shared/types';

function roster(...statuses: Array<AvailabilityStatus | null>): PlayerAvailability[] {
  return statuses.map((status, index) => ({ playerId: `p${index}`, playerName: `Joueur ${index}`, status }));
}

const EVENT: CalendarEvent = {
  id: 'event-1',
  date: '2030-06-10',
  startTime: '20:00',
  endTime: '21:20',
  type: 'MATCH',
  title: 'Scrim',
  evaSlotIds: [],
  createdById: 'p0',
  createdAt: '2030-01-01T00:00:00Z',
};

function mountCell(overrides: Record<string, unknown> = {}) {
  return mount(DayCell, {
    props: {
      date: '2030-06-10',
      dayNumber: 10,
      isCurrentMonth: true,
      isToday: false,
      isPast: false,
      currentPlayerStatus: 'UNAVAILABLE',
      playerAvailabilities: roster(...Array<AvailabilityStatus>(TEAM_PLAYER_COUNT).fill('AVAILABLE')),
      events: [],
      matchmaking: true,
      ...overrides,
    },
  });
}

describe('DayCell in matchmaking mode', () => {
  it('colours the day by the team lineup, not by the current player', () => {
    const wrapper = mountCell();
    expect(wrapper.classes()).toContain('team-availability--ready');
    expect(wrapper.classes()).not.toContain('availability--unavailable');
  });

  it('turns shaky when the lineup leans on a conditional player', () => {
    const statuses: Array<AvailabilityStatus | null> = Array(TEAM_PLAYER_COUNT - 1).fill('AVAILABLE');
    statuses.push('CONDITIONAL');
    const wrapper = mountCell({ playerAvailabilities: roster(...statuses) });
    expect(wrapper.classes()).toContain('team-availability--shaky');
  });

  it('turns short when the team cannot line up', () => {
    const wrapper = mountCell({ playerAvailabilities: roster('AVAILABLE', 'VOICE_ONLY', null) });
    expect(wrapper.classes()).toContain('team-availability--short');
    expect(wrapper.attributes('title')).toContain(`Moins de ${TEAM_PLAYER_COUNT}`);
  });

  it('stays neutral while nobody has answered', () => {
    const wrapper = mountCell({ playerAvailabilities: roster(null, null, null, null, null) });
    expect(wrapper.classes()).toContain('availability--unset');
    expect(wrapper.classes().some(c => c.startsWith('team-availability--'))).toBe(false);
  });

  it('keeps the player colouring in team mode', () => {
    const wrapper = mountCell({ matchmaking: false });
    expect(wrapper.classes()).toContain('availability--unavailable');
    expect(wrapper.classes()).not.toContain('team-availability--ready');
  });

  it('keeps past days grey', () => {
    const wrapper = mountCell({ isPast: true });
    expect(wrapper.classes()).toContain('status-past');
  });

  it('does not open the event form on an empty day', async () => {
    const wrapper = mountCell();
    await wrapper.trigger('click');
    expect(wrapper.emitted('open-create-event')).toBeFalsy();
    expect(wrapper.emitted('set-availability')).toBeFalsy();
  });

  it('still opens the events of the day', async () => {
    const wrapper = mountCell({ events: [EVENT] });
    await wrapper.trigger('click');
    expect(wrapper.emitted('open-event-viewer')![0]).toEqual([[EVENT], 0]);
  });
});
