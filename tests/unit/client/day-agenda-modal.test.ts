// Tests for DayAgendaModal: a day of the calendar listed whole
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayAgendaModal, { type DayAgenda } from '@/components/calendar/DayAgendaModal.vue';
import type { CalendarEvent, ScrimSearch } from '@shared/types';

const SEARCH_MINE: ScrimSearch = {
  id: 'search-mine', team: { id: 'us', name: 'Nous', logoUrl: null }, date: '2030-06-10',
  slots: [
    { slotId: 'a', venueId: 'v', arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' },
    { slotId: 'b', venueId: 'v', arenaNumber: 1, startTime: '20:40', endTime: '21:20', convocationTime: '20:40' },
  ],
  slotCount: 2, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '21:20', convocationTime: '19:50',
  status: 'OPEN', isMine: true, proposals: [], createdAt: '',
};

const SEARCH_THEIRS: ScrimSearch = {
  ...SEARCH_MINE, id: 'search-theirs', team: { id: 'them', name: 'Les Autres', logoUrl: null }, isMine: false,
};

function event(index: number, startTime: string): CalendarEvent {
  return {
    id: `event-${index}`, date: '2030-06-10', startTime, endTime: '23:30', type: 'EVENT', title: `Événement ${index}`,
    evaSlotIds: [], createdById: 'p0', createdAt: '',
  };
}

// More than a day of the calendar has room for, the events out of order
const DAY: DayAgenda = {
  date: '2030-06-10',
  searches: [SEARCH_MINE, SEARCH_THEIRS],
  events: [event(0, '21:00'), event(1, '09:00'), event(2, '18:30'), event(3, '14:00'), event(4, '22:15'), event(5, '11:00')],
  renewals: [{ playerId: 'p1', playerName: 'Lune', tier: null }],
};

function mountAgenda(day: DayAgenda | null) {
  return mount(DayAgendaModal, { props: { day }, global: { stubs: { Teleport: true } } });
}

describe('DayAgendaModal', () => {
  it('stays closed without a day', () => {
    const wrapper = mountAgenda(null);
    expect(wrapper.find('.agenda').exists()).toBe(false);
  });

  it('titles the list with the day', () => {
    const wrapper = mountAgenda(DAY);
    expect(wrapper.find('.modal-title').text()).toBe('Lundi 10 juin 2030');
  });

  it('heads the list with our own search, a row like the others, then every row of the day, none left out', () => {
    const wrapper = mountAgenda(DAY);

    const rows = wrapper.findAll('.agenda .item');
    expect(rows).toHaveLength(2 + DAY.events.length + 1);
    expect(rows[0]!.classes()).toContain('own-row');
    expect(rows[0]!.text()).toBe('20:00Notre recherche');
    expect(rows[0]!.find('.item-icon').exists()).toBe(true);
    expect(rows[1]!.text()).toBe('20:00Les Autres');
    expect(wrapper.findAll('.event-badge').map(row => row.find('.event-time').text()))
      .toEqual(['09:00', '11:00', '14:00', '18:30', '21:00', '22:15']);
    expect(rows.at(-1)!.classes()).toContain('renewal-strip');
    expect(wrapper.find('.overflow-row').exists()).toBe(false);
  });

  it('lists every team looking that day by name, never counted', () => {
    const others = Array.from({ length: 11 }, (_, index) => ({ ...SEARCH_THEIRS, id: `search-${index}`, team: { ...SEARCH_THEIRS.team, name: `Équipe ${index}` } }));
    const wrapper = mountAgenda({ ...DAY, searches: [SEARCH_MINE, ...others], events: [], renewals: [] });

    expect(wrapper.findAll('.search-row')).toHaveLength(11);
    expect(wrapper.find('.overflow-row').exists()).toBe(false);
  });

  it('opens a search from its row, ours too', async () => {
    const wrapper = mountAgenda(DAY);
    await wrapper.find('.search-row').trigger('click');
    await wrapper.find('.own-row').trigger('click');
    expect(wrapper.emitted('open-search')).toEqual([[SEARCH_THEIRS], [SEARCH_MINE]]);
  });

  it('counts the teams waiting for our answer at the end of our row', () => {
    const proposal = {
      id: 'p1', searchId: 'search-mine', team: { id: 't1', name: 'Équipe 1', logoUrl: null }, message: null, status: 'PENDING' as const,
      declineReason: null, venueId: 'v', evaSlotIds: ['a', 'b'], arenaNumber: 1, startTime: '20:00', endTime: '21:20', convocationTime: '19:50', isMine: false, createdAt: '',
    };
    const wrapper = mountAgenda({ ...DAY, searches: [{ ...SEARCH_MINE, proposals: [proposal] }] });

    expect(wrapper.find('.own-row .pending-count').text()).toBe('1');
    expect(wrapper.find('.own-row').attributes('title')).toBe('Notre recherche · 20:00 – 21:20 · Une équipe a proposé un match');
  });

  it('opens the viewer on every event of the day, at the row clicked', async () => {
    const wrapper = mountAgenda(DAY);
    await wrapper.findAll('.event-badge')[2]!.trigger('click');

    const [opened] = wrapper.emitted('open-event-viewer')!;
    const [events, index] = opened as [CalendarEvent[], number];
    expect(events.map(listed => listed.startTime)).toEqual(['09:00', '11:00', '14:00', '18:30', '21:00', '22:15']);
    expect(index).toBe(2);
  });

  it('shows the day it is opened on, each time', async () => {
    const wrapper = mountAgenda(DAY);
    await wrapper.setProps({ day: null });
    await wrapper.setProps({ day: { date: '2030-06-11', searches: [], events: [event(9, '20:00')], renewals: [] } });

    expect(wrapper.find('.modal-title').text()).toBe('Mardi 11 juin 2030');
    expect(wrapper.findAll('.agenda .item')).toHaveLength(1);
  });

  it('closes from its header', async () => {
    const wrapper = mountAgenda(DAY);
    await wrapper.find('.btn-close').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
