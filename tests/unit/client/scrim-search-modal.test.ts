// Tests for the modal that offers slots of picked days, in one venue or more, to the other teams
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ScrimSearchModal from '@/components/calendar/ScrimSearchModal.vue';
import { fetchVenueSlots, createScrimSearch, updateScrimSearch } from '@/api';
import { ApiError } from '@/api/error';
import type { DayData, ScrimOfferedSlot, ScrimProposal, ScrimSearch, Venue, VenueSlot } from '@shared/types';
import { TEAM_PLAYER_COUNT } from '@shared/constants';

vi.mock('@/api', () => ({
  fetchVenueSlots: vi.fn(),
  createScrimSearch: vi.fn(),
  updateScrimSearch: vi.fn(),
}));

const slotsApi = vi.mocked(fetchVenueSlots);
const createApi = vi.mocked(createScrimSearch);
const updateApi = vi.mocked(updateScrimSearch);

const VENUE: Venue = {
  id: 'venue-nimes', name: 'Nîmes', city: 'Nimes', address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
  website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
};

const MONTPELLIER: Venue = { ...VENUE, id: 'venue-montpellier', name: 'Montpellier', city: 'Montpellier' };

function slot(slotId: string, startTime: string, endTime: string, extra: Partial<VenueSlot> = {}): VenueSlot {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber: 1, gameId: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true, ...extra };
}

const DAY_SLOTS = [
  slot('s-1720', '17:20', '18:00', { gameId: 7 }),
  slot('s-1800', '18:00', '18:40', { isCompetitiveAvailable: false }),
  slot('s-2000', '20:00', '20:40'),
  slot('s-2040', '20:40', '21:20'),
  slot('s-2120', '21:20', '22:00', { takenSeats: 2 }),
];

// Montpellier runs the whole evening, free
const MONTPELLIER_SLOTS = [
  slot('m-2000', '20:00', '20:40'),
  slot('m-2040', '20:40', '21:20'),
  slot('m-2120', '21:20', '22:00'),
  slot('m-2200', '22:00', '22:40'),
];

function day(date: string, statuses: Array<DayData['playerAvailabilities'][number]['status']>): DayData {
  return {
    date,
    currentPlayerStatus: null,
    playerAvailabilities: statuses.map((status, index) => ({ playerId: `p${index}`, playerName: `J${index}`, status, hours: null })),
    events: [],
    renewals: [],
  };
}

const READY = Array(TEAM_PLAYER_COUNT).fill('AVAILABLE') as Array<'AVAILABLE'>;

function offered(slotId: string, startTime: string, endTime: string, venueId = VENUE.id): ScrimOfferedSlot {
  return { slotId, venueId, arenaNumber: 1, startTime, endTime, convocationTime: startTime };
}

// A search of another team on the first day picked: 40-minute matches in Nîmes, 19:20 to 21:20
function rivalSearch(overrides: Partial<ScrimSearch> = {}): ScrimSearch {
  return {
    id: 'search-rivals', team: { id: 'rivals', name: 'Les Rivaux', logoUrl: '/api/teams/rivals/logo?v=1' }, date: '2030-06-10',
    slots: [offered('r-1920', '19:20', '20:00'), offered('r-2000', '20:00', '20:40'), offered('r-2040', '20:40', '21:20')],
    slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '19:20', endTime: '21:20', convocationTime: '19:10',
    status: 'OPEN', isMine: false, proposals: [], createdAt: '', ...overrides,
  };
}

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(ScrimSearchModal, {
    props: {
      open: true,
      venues: [VENUE],
      dates: ['2030-06-12', '2030-06-10'],
      days: { '2030-06-10': day('2030-06-10', READY), '2030-06-12': day('2030-06-12', ['AVAILABLE', 'UNAVAILABLE']) },
      searches: {},
      ...overrides,
    },
    global: { stubs: { Teleport: true, Transition: false } },
  });
}

function slotButtons(wrapper: ReturnType<typeof mountModal>, dayIndex: number) {
  return wrapper.findAll('.day')[dayIndex]!.findAll('button.slot-row');
}

function clickable(wrapper: ReturnType<typeof mountModal>, dayIndex: number, venueIndex?: number) {
  const day = wrapper.findAll('.day')[dayIndex]!;
  const scope = venueIndex === undefined ? day : day.findAll('.day-venue')[venueIndex]!;
  return scope.findAll('button.slot-row').filter(button => button.attributes('disabled') === undefined);
}

// The clickable slot of a venue that starts at a time
function slotAt(wrapper: ReturnType<typeof mountModal>, dayIndex: number, venueIndex: number, time: string) {
  return clickable(wrapper, dayIndex, venueIndex).find(button => button.text().startsWith(time))!;
}

// The choices of one setting, found by the name screen readers give it
function segments(wrapper: ReturnType<typeof mountModal>, group: string) {
  return wrapper.findAll('[role="radiogroup"]').find(candidate => candidate.attributes('aria-label') === group)!.findAll('button');
}

function segment(wrapper: ReturnType<typeof mountModal>, group: string, label: string) {
  return segments(wrapper, group).find(button => button.text().startsWith(label))!;
}

function submitButton(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.findAll('button').find(button => button.text().startsWith('Ouvrir'))!;
}

beforeEach(() => {
  slotsApi.mockReset();
  createApi.mockReset();
  updateApi.mockReset();
  slotsApi.mockImplementation(async venueId => (venueId === MONTPELLIER.id ? MONTPELLIER_SLOTS : DAY_SLOTS));
});

describe('ScrimSearchModal', () => {
  it('lists the picked days in order, every slot shown, only the playable ones clickable', async () => {
    const wrapper = mountModal();
    await flushPromises();

    const titles = wrapper.findAll('.day-title').map(title => title.text());
    expect(titles[0]).toContain('10 juin 2030');
    expect(titles[1]).toContain('12 juin 2030');

    expect(slotButtons(wrapper, 0)).toHaveLength(DAY_SLOTS.length);
    // Another game, a closed competitive mode and people already in: shown, not clickable
    expect(clickable(wrapper, 0).map(button => button.text().slice(0, 5))).toEqual(['20:00', '20:40']);
    // No text above the settings; each day names its venue, even a single one
    expect(wrapper.find('.intro').exists()).toBe(false);
    expect(wrapper.findAll('.day')[0]!.findAll('.form-label--heading').map(label => label.text())).toEqual(['Nîmes']);
  });

  it('reminds what the team already planned on each day, where its hours are picked', async () => {
    const planned = day('2030-06-10', READY);
    planned.events = [
      { id: 'e2', date: '2030-06-10', startTime: '20:30', endTime: '21:50', type: 'MATCH', title: 'Match de ligue J3', evaSlotIds: [], createdById: 'p0', createdAt: '' },
      { id: 'e1', date: '2030-06-10', startTime: '18:00', endTime: '19:00', type: 'EVENT', title: 'Coaching aim', evaSlotIds: [], createdById: 'p0', createdAt: '' },
    ];
    const wrapper = mountModal({ days: { '2030-06-10': planned, '2030-06-12': day('2030-06-12', READY) } });
    await flushPromises();

    const days = wrapper.findAll('.day');
    expect(days[0]!.find('.planned-label').text()).toBe('Déjà prévu');
    expect(days[0]!.findAll('.planned-event').map(event => event.text())).toEqual(['18:00 – 19:00 Coaching aim', '20:30 – 21:50 Match de ligue J3']);
    expect(days[1]!.find('.planned').exists()).toBe(false);
  });

  it('says quietly what the team can do that day, and frames the day once a slot picked falls outside it', async () => {
    const wrapper = mountModal();
    await flushPromises();

    let days = wrapper.findAll('.day');
    expect(days[0]!.find('.lineup-note').exists()).toBe(false);
    expect(days[1]!.find('.lineup-note').text()).toBe(`Moins de ${TEAM_PLAYER_COUNT} joueurs mobilisables`);
    expect(days[1]!.classes()).not.toContain('day--conflict');

    await slotAt(wrapper, 1, 0, '20:00').trigger('click');

    days = wrapper.findAll('.day');
    expect(days[1]!.classes()).toContain('day--conflict');
    expect(days[1]!.find('.lineup-conflict').text())
      .toBe(`2 créneaux choisis tombent hors des dispos de l'équipe. Moins de ${TEAM_PLAYER_COUNT} joueurs mobilisables.`);
    expect(days[1]!.find('.lineup-note').exists()).toBe(false);
    // A ready day covers whatever is picked on it
    await slotAt(wrapper, 0, 0, '20:00').trigger('click');
    expect(wrapper.findAll('.day')[0]!.classes()).not.toContain('day--conflict');
  });

  it('lets the slots inside the hours a partial lineup meets go quietly, and frames the day for the others', async () => {
    const shaky = day('2030-06-10', Array(TEAM_PLAYER_COUNT - 1).fill('AVAILABLE'));
    shaky.playerAvailabilities.push({ playerId: 'p9', playerName: 'J9', status: 'PARTIAL', hours: { startTime: '20:40', endTime: '22:00' } });
    const wrapper = mountModal({ dates: ['2030-06-10'], days: { '2030-06-10': shaky } });
    await flushPromises();
    await segment(wrapper, 'Durée d\'un match', '40 min').trigger('click');

    await slotAt(wrapper, 0, 0, '20:40').trigger('click');
    const dayBlock = () => wrapper.findAll('.day')[0]!;
    expect(dayBlock().classes()).not.toContain('day--conflict');
    expect(dayBlock().find('.lineup-note').text()).toBe(`${TEAM_PLAYER_COUNT} joueurs ensemble de 20:40 à 22:00 seulement`);

    await slotAt(wrapper, 0, 0, '20:00').trigger('click');
    expect(dayBlock().classes()).toContain('day--conflict');
    expect(dayBlock().find('.lineup-conflict').text())
      .toBe(`1 créneau choisi tombe hors des dispos de l'équipe. ${TEAM_PLAYER_COUNT} joueurs ensemble de 20:40 à 22:00 seulement.`);
  });

  it('offers nothing more on a day the team already searches: one search per day', async () => {
    const mine: ScrimSearch = {
      id: 'search-1', team: { id: 't', name: 'Nous', logoUrl: null }, date: '2030-06-10',
      slots: [{ slotId: 's-2000', venueId: VENUE.id, arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' }],
      slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '20:40', convocationTime: '19:50',
      status: 'OPEN', isMine: true, proposals: [], createdAt: '',
    };
    const wrapper = mountModal({ searches: { '2030-06-10': [mine] } });
    await flushPromises();

    const day = wrapper.findAll('.day')[0]!;
    expect(day.find('.day-searched').text()).toContain('Ton équipe cherche déjà un adversaire ce jour-là');
    expect(day.findAll('button.slot-row')).toHaveLength(0);
    // The other day is free to search
    expect(clickable(wrapper, 1)).not.toHaveLength(0);
  });

  it('asks for one match of two slots by default, each length and count one click away, and sends them with each search', async () => {
    createApi.mockResolvedValue({} as ScrimSearch);
    const wrapper = mountModal();
    await flushPromises();

    const lengths = segments(wrapper, 'Durée d\'un match');
    expect(lengths.map(button => button.text())).toEqual(['40 min1 créneau', '1h202 créneaux', '2h3 créneaux', '2h404 créneaux']);
    expect(segment(wrapper, 'Durée d\'un match', '1h20').attributes('aria-checked')).toBe('true');
    expect(segment(wrapper, 'Nombre de matchs', '1 match').attributes('aria-checked')).toBe('true');

    await segment(wrapper, 'Durée d\'un match', '40 min').trigger('click');
    expect(segment(wrapper, 'Durée d\'un match', '40 min').attributes('aria-checked')).toBe('true');

    await clickable(wrapper, 0)[0]!.trigger('click');
    await submitButton(wrapper).trigger('click');
    await flushPromises();

    expect(createApi).toHaveBeenCalledWith(expect.objectContaining({ venues: [{ venueId: VENUE.id, evaSlotIds: ['s-2000'] }], slotCount: 1, matchCount: 1 }));
  });

  it('takes the slots of a whole match in one click, and drops them together', async () => {
    const wrapper = mountModal();
    await flushPromises();

    await clickable(wrapper, 0)[0]!.trigger('click');
    expect(wrapper.findAll('.day')[0]!.findAll('.slot-row.selected').map(row => row.text().slice(0, 5))).toEqual(['20:00', '20:40']);

    await clickable(wrapper, 0)[1]!.trigger('click');
    expect(wrapper.findAll('.day')[0]!.findAll('.slot-row.selected')).toHaveLength(0);
  });

  it('holds back a day whose slots do not hold every match asked for, and says what is missing', async () => {
    createApi.mockResolvedValue({} as ScrimSearch);
    const wrapper = mountModal();
    await flushPromises();

    await segment(wrapper, 'Nombre de matchs', '2 matchs').trigger('click');
    await clickable(wrapper, 0)[0]!.trigger('click');

    expect(wrapper.findAll('.day')[0]!.find('.day-shortfall').text()).toBe(
      'De quoi jouer 1 match sur les 2 demandés : ajoute une plage à une autre heure, deux matchs ne tombent jamais en même temps.',
    );
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined();

    // One slot per match: the two picked slots now hold both
    await segment(wrapper, 'Durée d\'un match', '40 min').trigger('click');
    expect(wrapper.findAll('.day')[0]!.find('.day-shortfall').exists()).toBe(false);
    await submitButton(wrapper).trigger('click');
    await flushPromises();
    expect(createApi).toHaveBeenCalledWith(expect.objectContaining({ venues: [{ venueId: VENUE.id, evaSlotIds: ['s-2000', 's-2040'] }], slotCount: 1, matchCount: 2 }));
  });

  it('keeps on each day only what still makes whole matches when the length grows', async () => {
    const wrapper = mountModal();
    await flushPromises();

    await clickable(wrapper, 0)[0]!.trigger('click');
    await segment(wrapper, 'Durée d\'un match', '2h').trigger('click');

    expect(wrapper.findAll('.day')[0]!.findAll('.slot-row.selected')).toHaveLength(0);
    // Two free slots in a row cannot hold a match of three
    expect(clickable(wrapper, 0)).toHaveLength(0);
  });

  it('offers a whole arena in one click', async () => {
    const wrapper = mountModal();
    await flushPromises();

    await wrapper.findAll('.day')[0]!.find('.slot-arena-toggle').trigger('click');

    expect(wrapper.findAll('.day')[0]!.text()).toContain('2 créneaux proposés, entre 20:00 et 21:20');
  });

  it('opens one search per day with slots, and closes when all went through', async () => {
    createApi.mockResolvedValue({} as ScrimSearch);
    const wrapper = mountModal();
    await flushPromises();

    const submit = submitButton(wrapper);
    expect(submit.attributes('disabled')).toBeDefined();

    await clickable(wrapper, 0)[0]!.trigger('click');
    await clickable(wrapper, 1)[1]!.trigger('click');
    expect(submit.text()).toBe('Ouvrir 2 recherches');

    await submit.trigger('click');
    await flushPromises();

    expect(createApi).toHaveBeenCalledTimes(2);
    expect(createApi).toHaveBeenCalledWith({ date: '2030-06-10', venues: [{ venueId: VENUE.id, evaSlotIds: ['s-2000', 's-2040'] }], slotCount: 2, matchCount: 1 });
    expect(createApi).toHaveBeenCalledWith({ date: '2030-06-12', venues: [{ venueId: VENUE.id, evaSlotIds: ['s-2000', 's-2040'] }], slotCount: 2, matchCount: 1 });
    expect(wrapper.emitted('opened')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('keeps a day that was refused, with the reason, and drops the ones that opened', async () => {
    createApi
      .mockResolvedValueOnce({} as ScrimSearch)
      .mockRejectedValueOnce(new ApiError(['Un des créneaux a déjà des inscrits'], 'fallback'));
    const wrapper = mountModal();
    await flushPromises();

    await clickable(wrapper, 0)[0]!.trigger('click');
    await clickable(wrapper, 1)[0]!.trigger('click');
    await wrapper.findAll('button').find(button => button.text().startsWith('Ouvrir'))!.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.day')).toHaveLength(1);
    expect(wrapper.find('.day-title').text()).toContain('12 juin 2030');
    expect(wrapper.find('.day-error').text()).toBe('Un des créneaux a déjà des inscrits');
    expect(wrapper.emitted('opened')).toHaveLength(1);
    expect(wrapper.emitted('close')).toBeFalsy();
  });

  it('shows each ticked venue of each day under its name, and sends only the venues with slots', async () => {
    createApi.mockResolvedValue({} as ScrimSearch);
    const wrapper = mountModal({ venues: [VENUE, MONTPELLIER], dates: ['2030-06-10'] });
    await flushPromises();

    expect(wrapper.findAll('.day')[0]!.findAll('.form-label--heading').map(label => label.text())).toEqual(['Nîmes', 'Montpellier']);
    expect(slotsApi).toHaveBeenCalledWith(MONTPELLIER.id, '2030-06-10');

    await slotAt(wrapper, 0, 1, '21:20').trigger('click');
    await submitButton(wrapper).trigger('click');
    await flushPromises();

    expect(createApi).toHaveBeenCalledWith({
      date: '2030-06-10',
      venues: [{ venueId: MONTPELLIER.id, evaSlotIds: ['m-2120', 'm-2200'] }],
      slotCount: 2,
      matchCount: 1,
    });
  });

  it('counts the matches of a day across its venues, never two at the same time', async () => {
    createApi.mockResolvedValue({} as ScrimSearch);
    const wrapper = mountModal({ venues: [VENUE, MONTPELLIER], dates: ['2030-06-10'] });
    await flushPromises();
    await segment(wrapper, 'Nombre de matchs', '2 matchs').trigger('click');

    // 20:00 to 21:20 in Nîmes, and the same time in Montpellier: still one match
    await slotAt(wrapper, 0, 0, '20:00').trigger('click');
    await slotAt(wrapper, 0, 1, '20:00').trigger('click');
    expect(wrapper.find('.day-shortfall').text()).toContain('De quoi jouer 1 match sur les 2 demandés');
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined();

    // 21:20 to 22:40 in Montpellier comes after the first: two
    await slotAt(wrapper, 0, 1, '21:20').trigger('click');
    expect(wrapper.find('.day-shortfall').exists()).toBe(false);
    await submitButton(wrapper).trigger('click');
    await flushPromises();

    expect(createApi).toHaveBeenCalledWith({
      date: '2030-06-10',
      venues: [
        { venueId: VENUE.id, evaSlotIds: ['s-2000', 's-2040'] },
        { venueId: MONTPELLIER.id, evaSlotIds: ['m-2000', 'm-2040', 'm-2120', 'm-2200'] },
      ],
      slotCount: 2,
      matchCount: 2,
    });
  });

  it('says which teams already search at the hours picked, and opens their search to answer it, the day still free to go', async () => {
    const rivals = rivalSearch();
    const wrapper = mountModal({ searches: { '2030-06-10': [rivals] } });
    await flushPromises();

    // Nothing picked yet: nothing to compare
    expect(wrapper.find('.day-rivals').exists()).toBe(false);

    await slotAt(wrapper, 0, 0, '20:00').trigger('click');

    const notice = wrapper.findAll('.day')[0]!.find('.day-rivals');
    expect(notice.find('.day-rivals-title').text()).toBe('Déjà en recherche aux mêmes heures');
    expect(notice.find('.rival-team').text()).toBe('Les Rivaux');
    expect(notice.find('.rival-offer').text()).toBe('Nîmes, 19:20 – 21:20 · 1 match de 40 min');
    expect(notice.find('.rival-logo').attributes('src')).toBe('/api/teams/rivals/logo?v=1');
    // The other day picked meets nobody
    expect(wrapper.findAll('.day')[1]!.find('.day-rivals').exists()).toBe(false);

    // A reader who may not propose sees their search, without the offer to answer it
    expect(notice.find('button.btn-rival').text()).toBe('Voir leur recherche');
    await wrapper.setProps({ canPropose: true });
    expect(notice.find('button.btn-rival').text()).toBe('Leur proposer un match');

    await notice.find('button.btn-rival').trigger('click');
    expect(wrapper.emitted('open-search')).toEqual([[rivals]]);
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined();
  });

  it('says nothing of a team searching at other hours, or in another venue, nor of what a match of theirs already took', async () => {
    const later = rivalSearch({ id: 'later', slots: [offered('l-2120', '21:20', '22:00')] });
    const elsewhere = rivalSearch({ id: 'elsewhere', slots: [offered('e-2000', '20:00', '20:40', MONTPELLIER.id)] });
    const taken = rivalSearch({ id: 'taken', matchedCount: 1, matchCount: 2, takenSlotIds: ['r-2000', 'r-2040'] });
    const wrapper = mountModal({ searches: { '2030-06-10': [later, elsewhere, taken] } });
    await flushPromises();

    await slotAt(wrapper, 0, 0, '20:00').trigger('click');

    expect(wrapper.find('.day-rivals').exists()).toBe(false);
  });

  it('counts what a team still wants, and points to the proposal already sent them', async () => {
    const sent: ScrimProposal = {
      id: 'p1', searchId: 'search-rivals', team: { id: 'us', name: 'Nous', logoUrl: null }, message: null, status: 'PENDING',
      venueId: VENUE.id, evaSlotIds: ['r-1920'], arenaNumber: 1, startTime: '19:20', endTime: '20:00', convocationTime: '19:10',
      isMine: true, createdAt: '',
    };
    const rivals = rivalSearch({ slotCount: 2, matchCount: 3, matchedCount: 1, proposals: [sent] });
    const wrapper = mountModal({ searches: { '2030-06-10': [rivals] } });
    await flushPromises();

    await slotAt(wrapper, 0, 0, '20:00').trigger('click');

    expect(wrapper.find('.rival-offer').text()).toBe('Nîmes, 19:20 – 21:20 · 2 matchs de 1h20');
    expect(wrapper.find('button.btn-rival').text()).toBe('Voir notre proposition');
  });
});

describe('ScrimSearchModal changing one of our searches', () => {
  // Ours on the first day: 40-minute matches in Nîmes, 20:00 to 21:20
  function ours(overrides: Partial<ScrimSearch> = {}): ScrimSearch {
    return {
      id: 'search-ours', team: { id: 'us', name: 'Nous', logoUrl: null }, date: '2030-06-10',
      slots: [offered('s-2000', '20:00', '20:40'), offered('s-2040', '20:40', '21:20')],
      slotCount: 1, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '21:20', convocationTime: '19:50',
      status: 'OPEN', isMine: true, proposals: [], createdAt: '', ...overrides,
    };
  }

  function mountEditing(search: ScrimSearch, overrides: Record<string, unknown> = {}) {
    return mountModal({ editing: search, searches: { [search.date]: [search] }, ...overrides });
  }

  it('opens on the day of the search alone, its slots, length and number of matches picked, and saves the change', async () => {
    updateApi.mockResolvedValue({} as ScrimSearch);
    const search = ours();
    const wrapper = mountEditing(search);
    await flushPromises();

    expect(wrapper.find('.modal-title').text()).toBe('🔎 Modifier la recherche');
    expect(wrapper.findAll('.day')).toHaveLength(1);
    expect(wrapper.find('.day-searched').exists()).toBe(false);
    expect(wrapper.findAll('.slot-row.selected').map(row => row.text().slice(0, 5))).toEqual(['20:00', '20:40']);
    expect(segment(wrapper, 'Durée d\'un match', '40 min').attributes('aria-checked')).toBe('true');

    // One slot dropped, two matches of 40 minutes asked: one short
    await slotAt(wrapper, 0, 0, '20:40').trigger('click');
    await segment(wrapper, 'Nombre de matchs', '2 matchs').trigger('click');
    expect(wrapper.find('.day-shortfall').text()).toContain('De quoi jouer 1 match sur les 2 demandés');

    await segment(wrapper, 'Nombre de matchs', '1 match').trigger('click');
    const save = wrapper.findAll('button').find(button => button.text() === 'Enregistrer')!;
    await save.trigger('click');
    await flushPromises();

    expect(updateApi).toHaveBeenCalledWith('search-ours', { venues: [{ venueId: VENUE.id, evaSlotIds: ['s-2000'] }], slotCount: 1, matchCount: 1 });
    expect(createApi).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('keeps the matches made: their hours out of the offer, one more match at least, the rest held elsewhere', async () => {
    updateApi.mockResolvedValue({} as ScrimSearch);
    const search = ours({
      slotCount: 2, matchCount: 2, matchedCount: 1, takenSlotIds: ['s-2000', 's-2040'],
      slots: [offered('s-2000', '20:00', '20:40'), offered('s-2040', '20:40', '21:20'), offered('m-2120', '21:20', '22:00', MONTPELLIER.id), offered('m-2200', '22:00', '22:40', MONTPELLIER.id)],
    });
    const wrapper = mountEditing(search, { venues: [VENUE, MONTPELLIER] });
    await flushPromises();

    expect(segments(wrapper, 'Nombre de matchs').map(button => button.text())).toEqual(['2 matchs', '3 matchs', '4 matchs']);
    expect(wrapper.find('.settings-note').text()).toContain('1 match déjà calé compte dans le nombre de matchs');
    expect(wrapper.findAll('.day-venue')[0]!.findAll('.slot-row.selected')).toHaveLength(0);

    // Montpellier at the time of the match made holds nothing more
    await slotAt(wrapper, 0, 1, '20:00').trigger('click');
    await segment(wrapper, 'Nombre de matchs', '3 matchs').trigger('click');
    expect(wrapper.find('.day-shortfall').text()).toContain('De quoi jouer 1 match sur les 2 qui restent à caler');

    await segment(wrapper, 'Nombre de matchs', '2 matchs').trigger('click');
    await wrapper.findAll('button').find(button => button.text() === 'Enregistrer')!.trigger('click');
    await flushPromises();

    expect(updateApi).toHaveBeenCalledWith('search-ours', {
      venues: [{ venueId: MONTPELLIER.id, evaSlotIds: ['m-2000', 'm-2040', 'm-2120', 'm-2200'] }],
      slotCount: 2,
      matchCount: 2,
    });
  });

  it('stays open on a refusal, with the reason', async () => {
    updateApi.mockRejectedValue(new ApiError(['Un des créneaux a déjà des inscrits'], 'fallback'));
    const wrapper = mountEditing(ours());
    await flushPromises();

    await wrapper.findAll('button').find(button => button.text() === 'Enregistrer')!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.day-error').text()).toBe('Un des créneaux a déjà des inscrits');
    expect(wrapper.emitted('saved')).toBeFalsy();
    expect(wrapper.emitted('close')).toBeFalsy();
  });
});

