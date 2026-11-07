// Tests for the search detail: answering another team's search with a run, reading the answers on ours
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ScrimSearchViewerModal from '@/components/calendar/ScrimSearchViewerModal.vue';
import {
  fetchVenueSlots,
  deleteScrimSearch,
  createScrimProposal,
  acceptScrimProposal,
  declineScrimProposal,
  withdrawScrimProposal,
} from '@/api';
import type { ScrimOfferedSlot, ScrimProposal, ScrimSearch, Venue, VenueSlot } from '@shared/types';

vi.mock('@/api', () => ({
  fetchVenueSlots: vi.fn(),
  deleteScrimSearch: vi.fn(),
  createScrimProposal: vi.fn(),
  acceptScrimProposal: vi.fn(),
  declineScrimProposal: vi.fn(),
  withdrawScrimProposal: vi.fn(),
}));

function slot(slotId: string, startTime: string, endTime: string): VenueSlot {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber: 1, gameId: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true };
}

function venue(id: string, name: string): Venue {
  return {
    id, name, city: name, address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
    website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
  };
}

const NIMES = venue('v', 'Nîmes');
const MONTPELLIER = venue('m', 'Montpellier');

// Nîmes runs four slots; the search offers the last three
const DAY_SLOTS = [slot('s-1920', '19:20', '20:00'), slot('s-2000', '20:00', '20:40'), slot('s-2040', '20:40', '21:20'), slot('s-2120', '21:20', '22:00')];
const MONTPELLIER_SLOTS = [slot('m-2200', '22:00', '22:40'), slot('m-2240', '22:40', '23:20')];

function offered(slotId: string, startTime: string, endTime: string, venueId = NIMES.id, arenaNumber = 1): ScrimOfferedSlot {
  return { slotId, venueId, arenaNumber, startTime, endTime, convocationTime: startTime };
}

const OFFERED = [offered('s-2000', '20:00', '20:40'), offered('s-2040', '20:40', '21:20'), offered('s-2120', '21:20', '22:00')];

function proposal(id: string, overrides: Partial<ScrimProposal> = {}): ScrimProposal {
  return {
    id, searchId: 'search-1', team: { id: `team-${id}`, name: `Équipe ${id}`, logoUrl: null },
    message: null, status: 'PENDING', venueId: NIMES.id, evaSlotIds: ['s-2000', 's-2040'], arenaNumber: 1,
    startTime: '20:00', endTime: '21:20', convocationTime: '19:50', isMine: false, createdAt: '', ...overrides,
  };
}

function search(overrides: Partial<ScrimSearch> = {}): ScrimSearch {
  return {
    id: 'search-1', team: { id: 'them', name: 'Les Autres', logoUrl: null }, date: '2030-06-10',
    slots: OFFERED, slotCount: 2, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '22:00', convocationTime: '19:50',
    status: 'OPEN', isMine: false, proposals: [], createdAt: '', ...overrides,
  };
}

// An offer in Nîmes and, later in the evening, in Montpellier
const ACROSS = { slots: [...OFFERED, offered('m-2200', '22:00', '22:40', MONTPELLIER.id), offered('m-2240', '22:40', '23:20', MONTPELLIER.id)], endTime: '23:20' };

function mountViewer(props: Record<string, unknown> = {}) {
  return mount(ScrimSearchViewerModal, {
    props: { search: search(), venues: [NIMES, MONTPELLIER], canAct: true, ...props },
    global: { stubs: { Teleport: true } },
  });
}

function button(wrapper: ReturnType<typeof mountViewer>, text: string) {
  return wrapper.findAll('button').find(b => b.text().includes(text));
}

function slotRow(wrapper: ReturnType<typeof mountViewer>, time: string) {
  return wrapper.findAll('button.slot-row').find(r => r.text().startsWith(time))!;
}

function selectedTimes(wrapper: ReturnType<typeof mountViewer>) {
  return wrapper.findAll('.slot-row.selected').map(row => row.text().slice(0, 5));
}

beforeEach(() => {
  vi.mocked(fetchVenueSlots).mockReset();
  vi.mocked(fetchVenueSlots).mockImplementation(async venueId => (venueId === MONTPELLIER.id ? MONTPELLIER_SLOTS : DAY_SLOTS));
  vi.mocked(deleteScrimSearch).mockReset();
  vi.mocked(createScrimProposal).mockReset();
  vi.mocked(acceptScrimProposal).mockReset();
  vi.mocked(declineScrimProposal).mockReset();
  vi.mocked(withdrawScrimProposal).mockReset();
});

describe('ScrimSearchViewerModal on another team\'s search', () => {
  it('sums up the offer and shows the slots of the day, only the offered ones clickable', async () => {
    const wrapper = mountViewer();
    await flushPromises();

    expect(wrapper.find('.modal-title').text()).toBe('🔎 Recherche d\'adversaire · lundi 10 juin 2030');
    expect(wrapper.find('.team-name').text()).toBe('Les Autres');
    expect(wrapper.text()).toContain('3 créneaux proposés entre 20:00 et 22:00, arène 1');
    expect(wrapper.findAll('.fact').map(fact => fact.text())).toEqual(['Matchs1 match de 1h20', 'Créneaux3 créneaux proposés entre 20:00 et 22:00, arène 1', 'SalleNîmes']);
    expect(wrapper.findAll('.venue-run .form-label--heading').map(label => label.text())).toEqual(['Nîmes']);
    expect(fetchVenueSlots).toHaveBeenCalledWith('v', '2030-06-10');
    expect(fetchVenueSlots).toHaveBeenCalledTimes(1);
    expect(slotRow(wrapper, '19:20').attributes('disabled')).toBeDefined();
    expect(slotRow(wrapper, '19:20').text()).toContain('Non proposé');
    expect(slotRow(wrapper, '20:00').attributes('disabled')).toBeUndefined();
  });

  it('says how many matches the search wants and how long they are, one included', async () => {
    const wrapper = mountViewer({ search: search({ slotCount: 1 }) });
    await flushPromises();

    expect(wrapper.findAll('.fact')[0]!.text()).toBe('Matchs1 match de 40 min');
  });

  it('says how many matches the search wants and how many are set, and keeps the slots they take out of reach', async () => {
    const wrapper = mountViewer({ search: search({ matchCount: 2, matchedCount: 1, takenSlotIds: ['s-2000', 's-2040'] }) });
    await flushPromises();

    expect(wrapper.text()).toContain('2 matchs de 1h20, 1 déjà calé');
    for (const time of ['20:00', '20:40']) {
      expect(slotRow(wrapper, time).text()).toContain('Heure déjà prise');
      expect(slotRow(wrapper, time).attributes('disabled')).toBeDefined();
    }
    // 21:20 is left alone among the offered slots: no match of two fits there
    expect(slotRow(wrapper, '21:20').text()).toContain('Plage trop courte');
    expect(slotRow(wrapper, '21:20').attributes('disabled')).toBeDefined();
  });

  it('needs a run before proposing; one click picks the run of the asked length, then sends it with the message typed', async () => {
    vi.mocked(createScrimProposal).mockResolvedValue(proposal('p1', { isMine: true }));
    const wrapper = mountViewer();
    await flushPromises();

    const propose = button(wrapper, 'Proposer un match')!;
    expect(propose.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('les 2 créneaux se sélectionnent ensemble');

    await slotRow(wrapper, '20:00').trigger('click');
    await wrapper.find('textarea').setValue('  On est quatre  ');
    expect(propose.attributes('disabled')).toBeUndefined();

    await propose.trigger('click');
    await flushPromises();

    expect(createScrimProposal).toHaveBeenCalledWith('search-1', { evaSlotIds: ['s-2000', 's-2040'], message: 'On est quatre' });
    expect(wrapper.text()).toContain('Proposition envoyée');
    expect(button(wrapper, 'Proposer un match')).toBeUndefined();
    expect(wrapper.emitted('changed')![0]).toEqual([{ matched: false }]);
    expect(wrapper.emitted('close')).toBeFalsy();
  });

  it('sends no message key when the field is empty', async () => {
    vi.mocked(createScrimProposal).mockResolvedValue(proposal('p1', { isMine: true }));
    const wrapper = mountViewer();
    await flushPromises();

    await slotRow(wrapper, '21:20').trigger('click');
    await button(wrapper, 'Proposer un match')!.trigger('click');
    await flushPromises();

    // The evening runs out after 21:20, so the run ends there
    expect(createScrimProposal).toHaveBeenCalledWith('search-1', { evaSlotIds: ['s-2040', 's-2120'] });
  });

  it('shows the pending proposal of the team with its run, and lets it be taken back', async () => {
    vi.mocked(withdrawScrimProposal).mockResolvedValue();
    const wrapper = mountViewer({ search: search({ proposals: [proposal('p1', { isMine: true })] }) });
    await flushPromises();

    expect(wrapper.text()).toContain('Proposition envoyée');
    expect(wrapper.text()).toContain('20:00 – 21:20 (2 créneaux), arène 1');
    expect(button(wrapper, 'Proposer un match')).toBeUndefined();
    expect(wrapper.find('button.slot-row').exists()).toBe(false);

    await button(wrapper, 'Retirer la proposition')!.trigger('click');
    await flushPromises();

    expect(withdrawScrimProposal).toHaveBeenCalledWith('p1');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('lets the team propose again after a declined proposal, and says it was declined', async () => {
    const wrapper = mountViewer({ search: search({ proposals: [proposal('p1', { isMine: true, status: 'DECLINED' })] }) });
    await flushPromises();

    expect(wrapper.text()).toContain('refusée');
    expect(button(wrapper, 'Proposer un match')).toBeDefined();
  });

  it('shows each venue of the search under its name, one run at a time across them', async () => {
    vi.mocked(createScrimProposal).mockResolvedValue(proposal('p1', { isMine: true }));
    const wrapper = mountViewer({ search: search(ACROSS) });
    await flushPromises();

    expect(wrapper.findAll('.fact').map(fact => fact.text())).toContain('SallesNîmes, Montpellier');
    expect(wrapper.findAll('.venue-run .form-label--heading').map(label => label.text())).toEqual(['Nîmes', 'Montpellier']);
    expect(fetchVenueSlots).toHaveBeenCalledWith(MONTPELLIER.id, '2030-06-10');

    await slotRow(wrapper, '22:00').trigger('click');
    expect(selectedTimes(wrapper)).toEqual(['22:00', '22:40']);

    // A run picked in Nîmes drops the one in Montpellier: a proposal is one match
    await slotRow(wrapper, '20:00').trigger('click');
    expect(selectedTimes(wrapper)).toEqual(['20:00', '20:40']);

    await slotRow(wrapper, '22:40').trigger('click');
    await button(wrapper, 'Proposer un match')!.trigger('click');
    await flushPromises();
    expect(createScrimProposal).toHaveBeenCalledWith('search-1', { evaSlotIds: ['m-2200', 'm-2240'] });
  });

  it('offers nothing to a reader who cannot act for the team', async () => {
    const wrapper = mountViewer({ canAct: false });
    await flushPromises();

    expect(button(wrapper, 'Proposer un match')).toBeUndefined();
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(fetchVenueSlots).not.toHaveBeenCalled();
    expect(button(wrapper, 'Retirer la recherche')).toBeUndefined();
  });
});

describe('ScrimSearchViewerModal: what the team planned that day', () => {
  const PLANNED = [
    { id: 'e1', date: '2030-06-10', startTime: '20:30', endTime: '21:50', type: 'MATCH' as const, title: 'Match de ligue J3', evaSlotIds: [], createdById: 'p0', createdAt: '' },
  ];

  it('reminds it beside the slots of an answer', async () => {
    const wrapper = mountViewer({ search: search(), plannedEvents: PLANNED });
    await flushPromises();

    expect(wrapper.findAll('.propose .planned-event').map(event => event.text())).toEqual(['20:30 – 21:50 Match de ligue J3']);
  });

  it('keeps it out of our own search, whose hours are chosen', async () => {
    const wrapper = mountViewer({ search: search({ isMine: true }), plannedEvents: PLANNED });
    await flushPromises();

    expect(wrapper.find('.planned').exists()).toBe(false);
  });
});

describe('ScrimSearchViewerModal on the team\'s own search', () => {
  const mine = () => search({
    team: { id: 'us', name: 'Nous', logoUrl: null },
    isMine: true,
    slots: [...OFFERED, offered('a2-2000', '20:00', '20:40', NIMES.id, 2)],
    proposals: [proposal('p1', { message: 'Go ?' }), proposal('p2'), proposal('p3', { status: 'DECLINED' })],
  });

  it('heads the sheet with its day, and leaves our name out: we know who we are', () => {
    const wrapper = mountViewer({ search: mine() });

    expect(wrapper.find('.modal-title').text()).toBe('🔎 Notre recherche · lundi 10 juin 2030');
    expect(wrapper.find('.team').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Nous');
    expect(wrapper.findAll('.fact').map(fact => fact.text())).toEqual(['Matchs1 match de 1h20']);
  });

  it('shows the offer venue by venue as the search window did, the slots offered ringed, nothing to click', async () => {
    const wrapper = mountViewer({ search: search({ ...ACROSS, isMine: true, proposals: [] }) });
    await flushPromises();

    expect(wrapper.findAll('.venue-offer .form-label--heading').map(label => label.text())).toEqual(['Nîmes', 'Montpellier']);
    expect(selectedTimes(wrapper)).toEqual(['20:00', '20:40', '21:20', '22:00', '22:40']);
    expect(wrapper.findAll('.venue-offer .slot-row--open').length).toBe(5);
    expect(slotRow(wrapper, '20:00').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('3 créneaux proposés, entre 20:00 et 22:00');
    expect(wrapper.text()).not.toContain('Clique sur');
  });

  it('marks the slots of the matches made', async () => {
    const wrapper = mountViewer({ search: search({ isMine: true, proposals: [], matchCount: 2, matchedCount: 1, takenSlotIds: ['s-2000', 's-2040'] }) });
    await flushPromises();

    expect(slotRow(wrapper, '20:00').text()).toContain('Match calé');
    expect(selectedTimes(wrapper)).toEqual(['21:20']);
    expect(wrapper.findAll('.fact')[0]!.text()).toBe('Matchs2 matchs de 1h20, 1 déjà calé');
  });

  it('lists the pending proposals with their run and message', () => {
    const wrapper = mountViewer({ search: mine() });

    expect(wrapper.text()).toContain('2 propositions');
    const items = wrapper.findAll('.proposal');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('Équipe p1');
    expect(items[0]!.text()).toContain('20:00 – 21:20 (2 créneaux), arène 1, convocation à 19:50');
    expect(items[0]!.text()).toContain('Go ?');
    expect(wrapper.find('textarea').exists()).toBe(false);
  });

  it('says in which venue each proposal is played when the search spans several', () => {
    const wrapper = mountViewer({ search: search({ ...ACROSS, isMine: true, proposals: [proposal('p1', { venueId: MONTPELLIER.id, evaSlotIds: ['m-2200', 'm-2240'], startTime: '22:00', endTime: '23:20', convocationTime: '21:50' })] }) });

    expect(wrapper.find('.proposal').text()).toContain('Montpellier · 22:00 – 23:20 (2 créneaux), arène 1, convocation à 21:50');
  });

  it('offers to change it in the search window, until its day', async () => {
    const wrapper = mountViewer({ search: mine() });

    await button(wrapper, 'Modifier la recherche')!.trigger('click');
    expect(wrapper.emitted('edit')).toEqual([[mine()]]);

    const past = mountViewer({ search: search({ isMine: true, date: '2020-01-01' }) });
    expect(button(past, 'Modifier la recherche')).toBeUndefined();
    const readOnly = mountViewer({ search: mine(), canAct: false });
    expect(button(readOnly, 'Modifier la recherche')).toBeUndefined();
    const theirs = mountViewer({ search: search() });
    expect(button(theirs, 'Modifier la recherche')).toBeUndefined();
  });

  it('says when nobody answered yet', () => {
    const wrapper = mountViewer({ search: search({ isMine: true, proposals: [] }) });
    expect(wrapper.text()).toContain('Aucune proposition pour le moment');
  });

  it('accepts a proposal, then closes and asks for a calendar reload with the new match', async () => {
    vi.mocked(acceptScrimProposal).mockResolvedValue({ proposal: proposal('p1', { status: 'ACCEPTED' }), events: [] });
    const wrapper = mountViewer({ search: mine() });

    await wrapper.findAll('.proposal')[0]!.findAll('button').find(b => b.text().includes('Accepter'))!.trigger('click');
    await flushPromises();

    expect(acceptScrimProposal).toHaveBeenCalledWith('p1');
    expect(wrapper.emitted('changed')![0]).toEqual([{ matched: true }]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('declines a proposal and stays open for the others', async () => {
    vi.mocked(declineScrimProposal).mockResolvedValue(proposal('p2', { status: 'DECLINED' }));
    const wrapper = mountViewer({ search: mine() });

    await wrapper.findAll('.proposal')[1]!.findAll('button').find(b => b.text().includes('Refuser'))!.trigger('click');
    await flushPromises();

    expect(declineScrimProposal).toHaveBeenCalledWith('p2');
    expect(wrapper.emitted('changed')![0]).toEqual([{ matched: false }]);
    expect(wrapper.emitted('close')).toBeFalsy();
  });

  it('withdraws the search after confirmation', async () => {
    vi.mocked(deleteScrimSearch).mockResolvedValue();
    const wrapper = mountViewer({ search: mine() });

    await button(wrapper, 'Retirer la recherche')!.trigger('click');
    await wrapper.findAll('button').find(b => b.text() === 'Retirer')!.trigger('click');
    await flushPromises();

    expect(deleteScrimSearch).toHaveBeenCalledWith('search-1');
    expect(wrapper.emitted('changed')![0]).toEqual([{ matched: false }]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
