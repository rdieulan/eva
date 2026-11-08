// Tests for DayCell with scrim searches: day picking, the other teams' rows, our own search's mark
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DayCell from '@/components/calendar/DayCell.vue';
import type { CalendarEvent, ScrimProposal, ScrimSearch } from '@shared/types';

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
  ...SEARCH_MINE, id: 'search-theirs', team: { id: 'them', name: 'Les Autres', logoUrl: '/api/teams/them/logo?v=1' },
  startTime: '21:20', endTime: '22:00', isMine: false,
};

const EVENT: CalendarEvent = {
  id: 'event-1', date: '2030-06-10', startTime: '20:00', endTime: '21:20', type: 'MATCH', title: 'Scrim',
  evaSlotIds: [], createdById: 'p0', createdAt: '',
};

const RENEWAL = [{ playerId: 'p1', playerName: 'Lune', tier: null }];

function proposal(id: string, status: ScrimProposal['status'] = 'PENDING'): ScrimProposal {
  const outcome = status === 'DECLINED' ? { status, declineReason: 'BY_TEAM' as const } : { status, declineReason: null };
  return {
    ...outcome,
    id, searchId: 'search-mine', team: { id: `team-${id}`, name: `Équipe ${id}`, logoUrl: null }, message: null,
    venueId: 'v', evaSlotIds: ['a', 'b'], arenaNumber: 1, startTime: '20:00', endTime: '21:20', convocationTime: '19:50',
    isMine: false, createdAt: '',
  };
}

// Other teams looking that day, each with its own name and start
function otherTeams(count: number): ScrimSearch[] {
  return Array.from({ length: count }, (_, index) => ({
    ...SEARCH_THEIRS, id: `search-${index}`, team: { ...SEARCH_THEIRS.team, id: `team-${index}`, name: `Équipe ${index}` },
    startTime: `1${index}:00`,
  }));
}

function events(count: number): CalendarEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    ...EVENT, id: `event-${index}`, startTime: `1${index}:00`, title: `Événement ${index}`,
  }));
}

function mountCell(overrides: Record<string, unknown> = {}, options: { attachTo?: HTMLElement } = {}) {
  return mount(DayCell, {
    ...options,
    props: {
      date: '2030-06-10', dayNumber: 10, isCurrentMonth: true, isToday: false, isPast: false,
      currentPlayerStatus: null, playerAvailabilities: [], events: [],
      matchmaking: true, selectable: true,
      ...overrides,
    },
  });
}

const rowTexts = (wrapper: ReturnType<typeof mountCell>) => wrapper.findAll('.items .item').map(row => row.text());

describe('DayCell in matchmaking: the other teams in the rows', () => {
  it('picks the day on click when the reader may search', async () => {
    const wrapper = mountCell();
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle-select')![0]).toEqual(['2030-06-10']);
    expect(wrapper.emitted('open-create-event')).toBeFalsy();
  });

  it('does not pick a past day nor a day when the reader may not search', async () => {
    const past = mountCell({ isPast: true });
    await past.trigger('click');
    expect(past.emitted('toggle-select')).toBeFalsy();

    const readOnly = mountCell({ selectable: false });
    await readOnly.trigger('click');
    expect(readOnly.emitted('toggle-select')).toBeFalsy();
  });

  it('shows the picked state', () => {
    const wrapper = mountCell({ selected: true });
    expect(wrapper.classes()).toContain('is-selected');
    expect(wrapper.find('.selected-mark').exists()).toBe(true);
  });

  it('shows the other teams by the time they start and their name, nothing else', () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_THEIRS, ...otherTeams(1)] });

    expect(rowTexts(wrapper)).toEqual(['10:00Équipe 0', '21:20Les Autres']);
    expect(wrapper.find('.search-row .item-icon').exists()).toBe(false);
  });

  it('leaves the team\'s events and renewals to the team\'s view', async () => {
    const wrapper = mountCell({ events: [EVENT], renewals: RENEWAL, scrimSearches: [SEARCH_THEIRS] });

    expect(wrapper.find('.event-badge').exists()).toBe(false);
    expect(wrapper.find('.renewal-strip').exists()).toBe(false);
    expect(rowTexts(wrapper)).toEqual(['21:20Les Autres']);

    // A reader who may not search: the day opens nothing it does not show
    const readOnly = mountCell({ selectable: false, events: [EVENT] });
    await readOnly.trigger('click');
    expect(readOnly.emitted('open-event-viewer')).toBeFalsy();
  });

  it('opens a search from its row without picking the day', async () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_THEIRS] });
    await wrapper.find('.search-row').trigger('click');
    expect(wrapper.emitted('open-search')![0]).toEqual([SEARCH_THEIRS]);
    expect(wrapper.emitted('toggle-select')).toBeFalsy();
  });

  it('opens a search from the keyboard: the row holds a native button whose click reaches the row', async () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_THEIRS] }, { attachTo: document.body });
    const button = wrapper.find('.search-row button.row-button');
    expect(button.exists()).toBe(true);
    expect(button.attributes('type')).toBe('button');

    await button.trigger('click');
    expect(wrapper.emitted('open-search')![0]).toEqual([SEARCH_THEIRS]);
    expect(wrapper.emitted('toggle-select')).toBeFalsy();
    wrapper.unmount();
  });
});

describe('DayCell: our own search, the mark of the day', () => {
  it('shows our own search as the mark of the day: the loupe of the search button and the hours it offers, no count while nobody answered, never a row', () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_MINE, SEARCH_THEIRS] });

    const mark = wrapper.find('.own-search-mark');
    expect(mark.find('img.own-search-icon').attributes('alt')).toBe('');
    expect(mark.classes()).not.toContain('has-pending');
    expect(mark.find('.own-search-count').exists()).toBe(false);
    expect(mark.find('.own-search-hours').text()).toBe('20:00 – 21:20');
    expect(mark.attributes('title')).toBe('Notre recherche · 20:00 – 21:20');
    expect(mark.attributes('type')).toBe('button');
    expect(rowTexts(wrapper)).toEqual(['21:20Les Autres']);
    expect(wrapper.find('.selected-mark').exists()).toBe(false);
  });

  it('counts the teams waiting for our answer in the glass of the loupe', () => {
    const search = { ...SEARCH_MINE, proposals: [proposal('p1'), proposal('p2'), proposal('p3', 'DECLINED')] };
    const wrapper = mountCell({ scrimSearches: [search] });

    const mark = wrapper.find('.own-search-mark');
    expect(mark.classes()).toContain('has-pending');
    expect(mark.find('.own-search-count').text()).toBe('2');
    expect(wrapper.find('.own-search-mark').attributes('title')).toBe('Notre recherche · 20:00 – 21:20 · 2 équipes ont proposé un match');
  });

  it('opens our search from its mark and from the day: a day we already search is not picked again', async () => {
    const wrapper = mountCell({ scrimSearches: [SEARCH_MINE] });
    expect(wrapper.classes()).not.toContain('is-selectable');

    await wrapper.find('.own-search-mark').trigger('click');
    await wrapper.trigger('click');

    expect(wrapper.emitted('open-search')).toEqual([[SEARCH_MINE], [SEARCH_MINE]]);
    expect(wrapper.emitted('toggle-select')).toBeFalsy();
  });

  it('shows the same mark in the team\'s view, beside what is planned', async () => {
    const wrapper = mountCell({ matchmaking: false, selectable: false, scrimSearches: [SEARCH_MINE], events: [EVENT] });

    expect(wrapper.find('.own-search-mark .own-search-icon').exists()).toBe(true);
    expect(rowTexts(wrapper)).toEqual(['20:00Scrim']);

    await wrapper.find('.own-search-mark').trigger('click');
    expect(wrapper.emitted('open-search')).toEqual([[SEARCH_MINE]]);
    expect(wrapper.emitted('open-event-viewer')).toBeFalsy();
  });

  it('gives the roster the whole day in edit mode', () => {
    const wrapper = mountCell({ editMode: true, scrimSearches: [SEARCH_MINE] });
    expect(wrapper.find('.own-search-mark').exists()).toBe(false);
  });
});

describe('DayCell rows: five at most, the height every day has', () => {
  it('shows five rows whole when the day holds five', () => {
    const wrapper = mountCell({ matchmaking: false, selectable: false, events: events(4), renewals: RENEWAL });

    expect(wrapper.findAll('.items .item')).toHaveLength(5);
    expect(wrapper.find('.overflow-row').exists()).toBe(false);
    expect(wrapper.find('.renewal-strip').exists()).toBe(true);
  });

  it('gives the last row of a day with our search to its mark, the rest counted', () => {
    const wrapper = mountCell({ matchmaking: false, selectable: false, scrimSearches: [SEARCH_MINE], events: events(5), renewals: RENEWAL });

    const rows = rowTexts(wrapper);
    expect(rows).toHaveLength(4);
    expect(rows[2]).toContain('Événement 2');
    expect(wrapper.find('.renewal-strip').exists()).toBe(false);
    expect(wrapper.find('.overflow-row').text()).toBe('+3 autres');
  });

  it('gives the last row of a day that can be picked to its selection mark, the teams left out counted as teams', () => {
    const fits = mountCell({ scrimSearches: otherTeams(4) });
    expect(rowTexts(fits)).toHaveLength(4);
    expect(fits.find('.overflow-row').exists()).toBe(false);

    const runsOver = mountCell({ scrimSearches: otherTeams(5) });
    expect(rowTexts(runsOver)).toEqual(['10:00Équipe 0', '11:00Équipe 1', '12:00Équipe 2', '+2 équipes']);
  });

  it('lists the whole day from the row counting the rest, a button, without picking the day', async () => {
    // Twelve teams looking that day, us included: three by name, the others counted
    const wrapper = mountCell({ scrimSearches: [SEARCH_MINE, ...otherTeams(11)] });

    const overflow = wrapper.find('.overflow-row');
    expect(overflow.text()).toBe('+8 équipes');
    expect(wrapper.find('.own-search-mark').exists()).toBe(true);
    const button = overflow.find('button.row-button');
    expect(button.attributes('type')).toBe('button');

    await button.trigger('click');
    expect(wrapper.emitted('open-day')).toEqual([['2030-06-10']]);
    expect(wrapper.emitted('toggle-select')).toBeFalsy();
    expect(wrapper.emitted('open-search')).toBeFalsy();
  });

  it('lists the whole day from that row in the team\'s view too, rather than opening the first event', async () => {
    const wrapper = mountCell({ matchmaking: false, selectable: false, events: events(7) });

    expect(wrapper.find('.overflow-row').text()).toBe('+3 autres');
    await wrapper.find('.overflow-row').trigger('click');

    expect(wrapper.emitted('open-day')).toEqual([['2030-06-10']]);
    expect(wrapper.emitted('open-event-viewer')).toBeFalsy();
  });
});
