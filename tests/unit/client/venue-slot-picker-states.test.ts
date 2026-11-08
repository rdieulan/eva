// Tests for the VenueSlotPicker in the matchmaking: every slot shown, states, free selection
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import { fetchVenueSlots } from '@/api/teams.api';
import type { VenueSlot } from '@shared/types';

vi.mock('@/api/teams.api', () => ({
  fetchVenueSlots: vi.fn(),
}));

function slot(id: string, startTime: string, endTime: string, overrides: Partial<VenueSlot> = {}): VenueSlot {
  return {
    slotId: id, startTime, endTime, convocationTime: startTime, arenaNumber: 1, gameId: 1,
    takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true, tokenType: null, passQuotaLeft: null, ...overrides,
  };
}

const OTHER_GAME = slot('s-1720', '17:20', '18:00', { gameId: 7 });
const CLOSED = slot('s-1800', '18:00', '18:40', { isCompetitiveAvailable: false });
const FREE_A = slot('s-1840', '18:40', '19:20');
const FREE_B = slot('s-1920', '19:20', '20:00');
const TAKEN = slot('s-2000', '20:00', '20:40', { takenSeats: 7 });
const FREE_C = slot('s-2040', '20:40', '21:20');
const ARENA2 = slot('a2-2040', '20:40', '21:20', { arenaNumber: 2 });
const DAY = [OTHER_GAME, CLOSED, FREE_A, FREE_B, TAKEN, FREE_C, ARENA2];

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(VenueSlotPicker, {
    props: { venueId: 'venue-1', date: '2030-06-10', modelValue: [], ...props },
  });
}

function row(wrapper: ReturnType<typeof mountPicker>, time: string) {
  return wrapper.findAll('button.slot-row').find(r => r.text().startsWith(time))!;
}

function lastSelection(wrapper: ReturnType<typeof mountPicker>): string[] {
  const emitted = wrapper.emitted('select')!;
  return (emitted[emitted.length - 1]![0] as VenueSlot[]).map(s => s.slotId);
}

beforeEach(() => {
  vi.mocked(fetchVenueSlots).mockReset();
  vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
});

describe('VenueSlotPicker states', () => {
  it('shows every slot of the day, and says why one is not for us', async () => {
    const wrapper = mountPicker({ playableOnly: true });
    await flushPromises();

    expect(wrapper.findAll('button.slot-row')).toHaveLength(DAY.length);
    expect(row(wrapper, '17:20').classes()).toContain('slot-row--otherGame');
    expect(row(wrapper, '17:20').text()).toContain('Autre jeu');
    expect(row(wrapper, '18:00').classes()).toContain('slot-row--notCompetitive');
    expect(row(wrapper, '18:40').classes()).toContain('slot-row--playable');
  });

  it('says a slot with players in is taken when a match needs it free, without counting them', async () => {
    const wrapper = mountPicker({ playableOnly: true });
    await flushPromises();

    expect(row(wrapper, '20:00').classes()).toContain('slot-row--taken');
    expect(row(wrapper, '20:00').text()).toContain('Occupé');
    expect(row(wrapper, '20:00').text()).not.toContain('/8');
    expect(row(wrapper, '20:00').classes().some(name => name.startsWith('headcount-'))).toBe(false);
    // A free slot says nothing: free is what it is for
    expect(row(wrapper, '18:40').find('.slot-players').text()).toBe('');
  });

  it('only lets the playable slots be clicked when a match needs them free', async () => {
    const wrapper = mountPicker({ playableOnly: true });
    await flushPromises();

    for (const time of ['17:20', '18:00', '20:00']) {
      expect(row(wrapper, time).attributes('disabled')).toBeDefined();
    }
    expect(row(wrapper, '18:40').attributes('disabled')).toBeUndefined();
  });

  it('keeps a taken slot clickable for the match form, never one of another game', async () => {
    const wrapper = mountPicker();
    await flushPromises();

    expect(row(wrapper, '20:00').attributes('disabled')).toBeUndefined();
    expect(row(wrapper, '17:20').attributes('disabled')).toBeDefined();
  });

  it('greys out slots the team already offers, and those a search does not offer', async () => {
    const excluded = mountPicker({ playableOnly: true, excludedSlotIds: ['s-1840'] });
    await flushPromises();
    expect(excluded.find('.slot-row--excluded').text()).toContain('Déjà proposé');
    expect(row(excluded, '18:40').attributes('disabled')).toBeDefined();

    const allowed = mountPicker({ playableOnly: true, allowedSlotIds: ['s-1920', 's-2040'] });
    await flushPromises();
    expect(row(allowed, '18:40').classes()).toContain('slot-row--notAllowed');
    expect(row(allowed, '18:40').text()).toContain('Non proposé');
    expect(row(allowed, '19:20').attributes('disabled')).toBeUndefined();
  });

  it('takes any set of slots in free selection, kept in evening order', async () => {
    const wrapper = mountPicker({ selection: 'free', playableOnly: true });
    await flushPromises();
    expect(wrapper.text()).toContain('choisira ceux du match');

    await row(wrapper, '20:40').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['s-2040']);

    await wrapper.setProps({ modelValue: ['s-2040'] });
    await row(wrapper, '18:40').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['s-1840', 's-2040']);

    await wrapper.setProps({ modelValue: ['s-1840', 's-2040'] });
    await row(wrapper, '20:40').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['s-1840']);
  });

  it('takes or drops every clickable slot of an arena at once', async () => {
    const wrapper = mountPicker({ selection: 'free', playableOnly: true, selectAll: true });
    await flushPromises();

    const toggles = wrapper.findAll('.slot-arena-toggle');
    expect(toggles).toHaveLength(2);
    expect(toggles[0]!.text()).toBe('Tout sélectionner');

    await toggles[0]!.trigger('click');
    expect(lastSelection(wrapper)).toEqual(['s-1840', 's-1920', 's-2040']);

    await wrapper.setProps({ modelValue: ['s-1840', 's-1920', 's-2040'] });
    expect(wrapper.findAll('.slot-arena-toggle')[0]!.text()).toBe('Tout désélectionner');
    await wrapper.findAll('.slot-arena-toggle')[0]!.trigger('click');
    expect(lastSelection(wrapper)).toEqual([]);
  });

  it('lets a slot picked before it closed be dropped, never picked again', async () => {
    const wrapper = mountPicker({ playableOnly: true, selection: 'free', runLength: 1, modelValue: ['s-2000', 's-2040'] });
    await flushPromises();

    expect(row(wrapper, '20:00').attributes('disabled')).toBeUndefined();
    await row(wrapper, '20:00').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['s-2040']);

    await wrapper.setProps({ modelValue: ['s-2040'] });
    expect(row(wrapper, '20:00').attributes('disabled')).toBeDefined();
  });

  it('shows an offer without taking clicks: the slots picked raised and ringed, the others flat', async () => {
    const wrapper = mountPicker({ playableOnly: true, selection: 'free', readonly: true, modelValue: ['s-1840', 's-1920'] });
    await flushPromises();

    expect(row(wrapper, '18:40').classes()).toEqual(expect.arrayContaining(['slot-row--open', 'selected']));
    expect(row(wrapper, '20:40').classes()).toContain('slot-row--closed');
    await row(wrapper, '20:40').trigger('click');
    await row(wrapper, '18:40').trigger('click');
    expect(wrapper.emitted('select')).toBeFalsy();
    expect(wrapper.find('.form-hint').text()).toBe('2 créneaux proposés, entre 18:40 et 20:00.');
  });

  it('keeps each arena of an hour to itself: picking one never picks the other', async () => {
    const arenaOne = slot('h-2000-1', '20:00', '20:40');
    const arenaTwo = slot('h-2000-2', '20:00', '20:40', { arenaNumber: 2, takenSeats: 3 });
    vi.mocked(fetchVenueSlots).mockResolvedValue([arenaOne, arenaTwo]);
    const wrapper = mountPicker({ playableOnly: true, selection: 'free', runLength: 1 });
    await flushPromises();

    const rows = wrapper.findAll('button.slot-row');
    await rows[0]!.trigger('click');
    expect(lastSelection(wrapper)).toEqual(['h-2000-1']);

    await wrapper.setProps({ modelValue: ['h-2000-1'] });
    expect(wrapper.findAll('button.slot-row').map(row => row.classes().includes('selected'))).toEqual([true, false]);
  });

  it('sums up a free selection by its span', async () => {
    const wrapper = mountPicker({ selection: 'free', modelValue: ['s-1840', 's-2040'] });
    await flushPromises();

    expect(wrapper.text()).toContain('2 créneaux proposés, entre 18:40 et 21:20');

    await wrapper.setProps({ modelValue: ['s-1840'] });
    expect(wrapper.text()).toContain('1 créneau proposé, entre 18:40 et 19:20');
  });

  it('still builds a run in run selection, skipping nothing over a taken slot', async () => {
    const wrapper = mountPicker({ selection: 'run', playableOnly: true, modelValue: ['s-1920'] });
    await flushPromises();

    // 20:00 is taken, so 20:40 does not follow the run and starts a new one
    await row(wrapper, '20:40').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['s-2040']);
  });

  it('counts the players of our game only: another game stays grey whatever its headcount', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([
      slot('s-1720', '17:20', '18:00', { gameId: 7, takenSeats: 9 }),
      slot('s-1800', '18:00', '18:40', { gameId: 7, takenSeats: 8 }),
      slot('s-1840', '18:40', '19:20', { takenSeats: 9 }),
      slot('s-1920', '19:20', '20:00', { takenSeats: 8 }),
    ]);
    const wrapper = mountPicker();
    await flushPromises();

    for (const time of ['17:20', '18:00']) {
      expect(row(wrapper, time).text()).toContain('Autre jeu');
      expect(row(wrapper, time).classes()).toContain('slot-row--closed');
      expect(row(wrapper, time).classes().some(name => name.startsWith('headcount-'))).toBe(false);
    }
    expect(row(wrapper, '18:40').classes()).toContain('headcount-over');
    expect(row(wrapper, '19:20').classes()).toContain('headcount-full');
  });

  it('names the reason of the slots it is told to keep out', async () => {
    const wrapper = mountPicker({ playableOnly: true, excludedSlotIds: ['s-1840'], excludedNote: 'Déjà pris' });
    await flushPromises();

    expect(row(wrapper, '18:40').text()).toContain('Déjà pris');
    expect(row(wrapper, '18:40').attributes('disabled')).toBeDefined();
  });

  it('with a match length, greys out the slots of a row too short to hold a match', async () => {
    const wrapper = mountPicker({ selection: 'free', playableOnly: true, runLength: 2 });
    await flushPromises();

    // 18:40 and 19:20 follow each other; 20:40 sits alone after a taken slot, the arena 2 slot alone on its arena
    expect(row(wrapper, '18:40').attributes('disabled')).toBeUndefined();
    expect(row(wrapper, '19:20').attributes('disabled')).toBeUndefined();
    for (const slotRow of wrapper.findAll('button.slot-row').filter(candidate => candidate.text().startsWith('20:40'))) {
      expect(slotRow.classes()).toContain('slot-row--tooShort');
      expect(slotRow.text()).toContain('Plage trop courte');
      expect(slotRow.attributes('disabled')).toBeDefined();
    }
  });

  describe('an offer made of matches', () => {
    const EVENING = [
      slot('s-1840', '18:40', '19:20'),
      slot('s-1920', '19:20', '20:00'),
      slot('s-2000', '20:00', '20:40'),
      slot('s-2040', '20:40', '21:20'),
      slot('s-2200', '22:00', '22:40'),
    ];

    beforeEach(() => {
      vi.mocked(fetchVenueSlots).mockResolvedValue(EVENING);
    });

    it('adds the run of a match around the clicked slot, shifted back when the row runs out', async () => {
      const wrapper = mountPicker({ selection: 'free', playableOnly: true, runLength: 2 });
      await flushPromises();
      expect(wrapper.text()).toContain('les 2 créneaux d\'un match se cochent ensemble');

      await row(wrapper, '18:40').trigger('click');
      expect(lastSelection(wrapper)).toEqual(['s-1840', 's-1920']);

      await wrapper.setProps({ modelValue: ['s-1840', 's-1920'] });
      await row(wrapper, '20:40').trigger('click');
      expect(lastSelection(wrapper)).toEqual(['s-1840', 's-1920', 's-2000', 's-2040']);
    });

    it('drops a clicked slot, and with it whatever no longer makes a whole match', async () => {
      const wrapper = mountPicker({ selection: 'free', playableOnly: true, runLength: 2, modelValue: ['s-1840', 's-1920', 's-2000', 's-2040'] });
      await flushPromises();

      await row(wrapper, '19:20').trigger('click');
      // 18:40 is left alone: it goes too
      expect(lastSelection(wrapper)).toEqual(['s-2000', 's-2040']);
    });

    it('takes every slot of an arena that fits in a match, and only those', async () => {
      const wrapper = mountPicker({ selection: 'free', playableOnly: true, runLength: 2, selectAll: true });
      await flushPromises();

      await wrapper.find('.slot-arena-toggle').trigger('click');
      expect(lastSelection(wrapper)).toEqual(['s-1840', 's-1920', 's-2000', 's-2040']);
    });
  });
});

describe('VenueSlotPicker tokens of EVA Pass holders', () => {
  // A Saturday: off-peak in the morning, peak from noon on, counted against the venue's pass quota
  const saturday = (quotaLeft: number) => [
    slot('s-1120', '11:20', '12:00', { tokenType: 'offPeak' }),
    slot('s-1320', '13:20', '14:00', { tokenType: 'peak', passQuotaLeft: quotaLeft }),
    slot('s-1400', '14:00', '14:40', { tokenType: 'peak', passQuotaLeft: quotaLeft }),
    slot('s-1440', '14:40', '15:20', { tokenType: 'peak', passQuotaLeft: quotaLeft, takenSeats: 4 }),
    slot('s-2200', '22:00', '22:40'),
  ];

  it('marks each slot HP or HC, and says nothing of a slot eva.gg rates neither way', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(saturday(14));
    const wrapper = mountPicker({ playableOnly: true });
    await flushPromises();

    expect(row(wrapper, '11:20').find('.slot-token').text()).toBe('HC');
    expect(row(wrapper, '11:20').find('.slot-token').attributes('title')).toBe('Heures creuses : un jeton HC');
    expect(row(wrapper, '13:20').find('.slot-token').text()).toBe('HP');
    expect(row(wrapper, '13:20').find('.slot-token').classes()).toContain('slot-token--peak');
    expect(row(wrapper, '22:00').find('.slot-token').exists()).toBe(false);
  });

  it('leaves the peak slots to a match while the venue still opens some to pass holders', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(saturday(14));
    const wrapper = mountPicker({ playableOnly: true });
    await flushPromises();

    expect(row(wrapper, '13:20').attributes('disabled')).toBeUndefined();
    expect(row(wrapper, '13:20').text()).not.toContain('Quota');
  });

  it('keeps the remaining peak slots out of a match once the quota is spent, and says why', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(saturday(0));
    const wrapper = mountPicker({ playableOnly: true });
    await flushPromises();

    for (const time of ['13:20', '14:00']) {
      expect(row(wrapper, time).classes()).toContain('slot-row--quotaReached');
      expect(row(wrapper, time).text()).toContain('Quota HP atteint');
      expect(row(wrapper, time).attributes('disabled')).toBeDefined();
    }
    // A slot with players in is taken before anything else; off-peak hours are untouched
    expect(row(wrapper, '14:40').text()).toContain('Occupé');
    expect(row(wrapper, '11:20').attributes('disabled')).toBeUndefined();
  });

  it('lets the match form pick a peak slot past the quota, saying the quota is spent', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(saturday(0));
    const wrapper = mountPicker();
    await flushPromises();

    expect(row(wrapper, '13:20').text()).toContain('Quota HP atteint');
    expect(row(wrapper, '13:20').attributes('disabled')).toBeUndefined();
  });

  it('tints the slots no full lineup of the team covers, before they are picked', async () => {
    const wrapper = mountPicker({ playableOnly: true, teamHours: { startTime: '19:20', endTime: null } });
    await flushPromises();

    // Before 19:20 the lineup is not there yet
    expect(row(wrapper, '18:40').classes()).toContain('outside-lineup');
    expect(row(wrapper, '18:40').attributes('title')).toBe("18:40 – 19:20, hors des dispos de l'équipe");
    expect(row(wrapper, '19:20').classes()).not.toContain('outside-lineup');
    // A slot nobody can book stays flat, whatever the lineup
    expect(row(wrapper, '17:20').classes()).not.toContain('outside-lineup');

    const never = mountPicker({ playableOnly: true, teamHours: null });
    await flushPromises();
    const open = never.findAll('button.slot-row--open');
    expect(open.length).toBeGreaterThan(0);
    expect(open.every(tile => tile.classes().includes('outside-lineup'))).toBe(true);

    const unsaid = mountPicker({ playableOnly: true });
    await flushPromises();
    expect(unsaid.findAll('.outside-lineup')).toHaveLength(0);
  });
});
