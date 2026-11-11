// Tests for DayCell with the events of the team's venue the team has not added:
// a quiet row of their own, among the five a day shows, out of matchmaking
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayCell from '@/components/calendar/DayCell.vue';
import type { CalendarEvent, VenueEventView } from '@shared/types';

const NIGHT: VenueEventView = {
  id: 'venue-event-1', venueName: 'Nîmes', title: 'Nocturne', date: '2030-06-10', startTime: '21:00', endTime: '23:59',
  description: 'Ouverte à tous',
};

function events(count: number): CalendarEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index}`, date: '2030-06-10', startTime: `1${index}:00`, endTime: '19:00', type: 'EVENT' as const,
    title: `Événement ${index}`, evaSlotIds: [], createdById: 'p0', createdAt: '',
  }));
}

function mountCell(overrides: Record<string, unknown> = {}) {
  return mount(DayCell, {
    props: {
      date: '2030-06-10', dayNumber: 10, isCurrentMonth: true, isToday: false, isPast: false,
      currentPlayerStatus: null, playerAvailabilities: [], events: [], venueEvents: [NIGHT],
      ...overrides,
    },
  });
}

const rowTexts = (wrapper: ReturnType<typeof mountCell>) => wrapper.findAll('.items .item').map(row => row.text());

describe('DayCell - the events of the venue not added yet', () => {
  it('shows each after the team\'s events and before the renewals, as not taken yet', () => {
    const wrapper = mountCell({ events: events(1), renewals: [{ playerId: 'p1', playerName: 'Lune', tier: null }] });

    expect(rowTexts(wrapper)).toEqual(['10:00Événement 0', '21:00Nocturne', 'Lune']);
    const row = wrapper.find('.venue-event-row');
    expect(row.attributes('title')).toBe('Événement de la salle, pas encore dans notre calendrier · 21:00 – 23:59 · Nocturne');
    expect(row.find('.item-icon').exists()).toBe(true);
  });

  it('opens the event from its row, and nothing else', async () => {
    const wrapper = mountCell();

    await wrapper.find('.venue-event-row button.row-button').trigger('click');

    expect(wrapper.emitted('open-venue-event')).toEqual([[NIGHT]]);
    expect(wrapper.emitted('open-create-event')).toBeFalsy();
    expect(wrapper.emitted('open-event-viewer')).toBeFalsy();
  });

  it('counts among the five rows of a day, the last ones left out first', () => {
    const wrapper = mountCell({ events: events(4), venueEvents: [NIGHT, { ...NIGHT, id: 'venue-event-2', startTime: '22:00', title: 'Soirée' }] });

    expect(rowTexts(wrapper)).toEqual(['10:00Événement 0', '11:00Événement 1', '12:00Événement 2', '13:00Événement 3', '+2 autres']);
  });

  it('stays out of matchmaking, where the day shows the other teams', () => {
    const wrapper = mountCell({ matchmaking: true, events: events(1) });
    expect(wrapper.find('.venue-event-row').exists()).toBe(false);
  });
});
