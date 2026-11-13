// Tests for DayCell in matchmaking mode: the day is coloured by the team's lineup
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayCell from '@/components/calendar/DayCell.vue';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import type { AvailabilityStatus, CalendarEvent, PlayerAvailability } from '@shared/types';

function roster(...statuses: Array<AvailabilityStatus | null>): PlayerAvailability[] {
  return statuses.map((status, index) => ({ playerId: `p${index}`, playerName: `Joueur ${index}`, status, hours: null }));
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
  it('colours the day by the team lineup, and the corner by the current player status', () => {
    const wrapper = mountCell();
    expect(wrapper.classes()).toContain('team-availability--ready');
    expect(wrapper.classes()).not.toContain('availability--unavailable');
    expect(wrapper.find('.corner').classes()).toContain('availability--unavailable');
    expect(wrapper.find('.corner').findComponent({ name: 'SvgIcon' }).props('name')).toBe('cross');
  });

  it('turns shaky when the lineup leans on a player available at given hours, and says when it meets', () => {
    const players = roster(...Array<AvailabilityStatus>(TEAM_PLAYER_COUNT - 1).fill('AVAILABLE'));
    players.push({ playerId: 'p9', playerName: 'Joueur 9', status: 'PARTIAL', hours: { startTime: '21:00', endTime: '23:00' } });
    const wrapper = mountCell({ playerAvailabilities: players });
    expect(wrapper.classes()).toContain('team-availability--shaky');
    expect(wrapper.attributes('title')).toBe(`${TEAM_PLAYER_COUNT} joueurs ensemble de 21:00 à 23:00 seulement`);
    expect(wrapper.find('.window-mark').text()).toBe('21:00 – 23:00');
  });

  it('turns voice when only a voice table can meet', () => {
    const statuses: Array<AvailabilityStatus | null> = Array(TEAM_PLAYER_COUNT).fill('VOICE_ONLY');
    statuses.push('UNAVAILABLE');
    const wrapper = mountCell({ playerAvailabilities: roster(...statuses) });
    expect(wrapper.classes()).toContain('team-availability--voice');
    expect(wrapper.attributes('title')).toContain('vocal');
  });

  it('turns short when the team cannot line up', () => {
    const wrapper = mountCell({ playerAvailabilities: roster('AVAILABLE', 'VOICE_ONLY', null) });
    expect(wrapper.classes()).toContain('team-availability--short');
    expect(wrapper.attributes('title')).toContain(`Moins de ${TEAM_PLAYER_COUNT}`);
  });

  it('stays neutral while the lineup hangs on silent players, the corner asking the reader', () => {
    const wrapper = mountCell({ currentPlayerStatus: null, playerAvailabilities: roster('AVAILABLE', null, null, null, null) });
    expect(wrapper.classes()).toContain('availability--unset');
    expect(wrapper.classes().some(c => c.startsWith('team-availability--'))).toBe(false);
    expect(wrapper.find('.corner').classes()).toContain('availability--unset');
    expect(wrapper.find('.corner').findComponent({ name: 'SvgIcon' }).props('name')).toBe('question-mark');
  });

  it('reads the same in team mode: the lineup on the cell', () => {
    const wrapper = mountCell({ matchmaking: false });
    expect(wrapper.classes()).toContain('team-availability--ready');
    expect(wrapper.attributes('title')).toContain('dispos toute la journée');
  });

  it('switches to the reader\'s own status and the roster in edit mode', () => {
    const wrapper = mountCell({ matchmaking: false, editMode: true, currentPlayerId: 'p1' });
    expect(wrapper.classes()).toContain('team-availability--ready');
    expect(wrapper.find('.corner').classes()).toContain('availability--unavailable');
    // The reader is not listed: the cell colour already says where they stand
    const names = wrapper.findAll('.roster-player').map(player => player.text());
    expect(names).toHaveLength(TEAM_PLAYER_COUNT - 1);
    expect(names).not.toContain('Joueur 1');
  });

  it('shows neither verdict nor corner on a day outside the month: its availabilities are not loaded', () => {
    const wrapper = mountCell({ isCurrentMonth: false, currentPlayerStatus: null, playerAvailabilities: [] });
    expect(wrapper.classes()).toContain('other-month');
    expect(wrapper.classes().some(c => c.startsWith('team-availability--') || c.startsWith('availability--'))).toBe(false);
    expect(wrapper.attributes('title')).toBeUndefined();
    expect(wrapper.find('.corner').exists()).toBe(false);
  });

  it('keeps past days grey', () => {
    const wrapper = mountCell({ isPast: true });
    expect(wrapper.classes()).toContain('status-past');
  });

  it('does not open the event form on an empty day', async () => {
    const wrapper = mountCell();
    await wrapper.trigger('click');
    expect(wrapper.emitted('open-create-event')).toBeFalsy();
    expect(wrapper.emitted('open-availability')).toBeFalsy();
  });

  it('leaves the events of the day to the team\'s view: neither shown nor opened', async () => {
    const wrapper = mountCell({ events: [EVENT] });
    expect(wrapper.find('.event-badge').exists()).toBe(false);

    await wrapper.trigger('click');
    expect(wrapper.emitted('open-event-viewer')).toBeFalsy();
  });
});
