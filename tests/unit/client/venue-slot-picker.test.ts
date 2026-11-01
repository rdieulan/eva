// Tests for the VenueSlotPicker component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import { fetchVenueSlots } from '@/api/teams.api';

vi.mock('@/api/teams.api', () => ({
  fetchVenueSlots: vi.fn(),
}));

function slot(startTime: string, endTime: string, overrides: Record<string, unknown> = {}) {
  return {
    slotId: `slot-${startTime}`,
    startTime,
    endTime,
    convocationTime: '19:50',
    arenaNumber: 1,
    takenSeats: 0,
    totalSeats: 10,
    ...overrides,
  };
}

const S19H20 = slot('19:20', '20:00', { convocationTime: '19:10' });
const S20H = slot('20:00', '20:40', { takenSeats: 7 });
const S20H40 = slot('20:40', '21:20', { convocationTime: '20:30' });
const S21H20 = slot('21:20', '22:00', { convocationTime: '21:10' });
const DAY = [S19H20, S20H, S20H40, S21H20];

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(VenueSlotPicker, {
    props: {
      venueId: 'venue-1',
      date: '2026-11-03',
      modelValue: [],
      currentStartTime: '20:00',
      currentEndTime: '20:40',
      ...props,
    },
  });
}

function rows(wrapper: ReturnType<typeof mountPicker>) {
  return wrapper.findAll('button.slot-row');
}

function row(wrapper: ReturnType<typeof mountPicker>, time: string) {
  return rows(wrapper).find(r => r.text().startsWith(time))!;
}

function lastSelection(wrapper: ReturnType<typeof mountPicker>): string[] {
  const emitted = wrapper.emitted('select')!;
  return (emitted[emitted.length - 1]![0] as { slotId: string }[]).map(s => s.slotId);
}

beforeEach(() => {
  vi.mocked(fetchVenueSlots).mockReset();
});

describe('VenueSlotPicker', () => {
  it('lists the slots of the day with the players already in, against a full match of 8', async () => {
    // eva.gg announces 10 seats on these slots; a match is 8, and that is what we count against
    vi.mocked(fetchVenueSlots).mockResolvedValue([S20H, { ...S20H40, totalSeats: 10 }]);
    const wrapper = mountPicker();
    await flushPromises();

    expect(rows(wrapper).map(r => `${r.find('.slot-time').text()} ${r.find('.slot-players').text()}`)).toEqual([
      '20:00 – 20:40 7/8 joueurs',
      '20:40 – 21:20 0/8 joueurs',
    ]);
    expect(wrapper.text()).toContain('deux créneaux qui se suivent');
  });

  it('marks a slot that holds a full match, and one with extra players in', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([
      { ...S20H, takenSeats: 8 },
      { ...S20H40, takenSeats: 9 },
    ]);
    const wrapper = mountPicker();
    await flushPromises();

    expect(row(wrapper, '20:00').classes()).toContain('headcount-full');
    expect(row(wrapper, '20:40').classes()).toContain('headcount-over');
    expect(row(wrapper, '20:40').find('.slot-players').text()).toBe('9/8 joueurs');
  });

  it('groups the slots by arena only when the day runs on several', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([S20H, { ...S20H, slotId: 'slot-20:00-2', arenaNumber: 2 }]);
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.findAll('.slot-arena-label').map(l => l.text())).toEqual(['Arène 1', 'Arène 2']);
  });

  it('starts a run on the clicked slot', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
    const wrapper = mountPicker();
    await flushPromises();

    await row(wrapper, '20:00').trigger('click');

    expect(lastSelection(wrapper)).toEqual(['slot-20:00']);
  });

  it('extends the run with the next or the previous slot, in time order', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
    const wrapper = mountPicker({ modelValue: ['slot-20:00'] });
    await flushPromises();

    await row(wrapper, '20:40').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['slot-20:00', 'slot-20:40']);

    await wrapper.setProps({ modelValue: ['slot-20:00', 'slot-20:40'] });
    await row(wrapper, '19:20').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['slot-19:20', 'slot-20:00', 'slot-20:40']);
  });

  it('starts over when the clicked slot does not follow the run', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
    const wrapper = mountPicker({ modelValue: ['slot-19:20'] });
    await flushPromises();

    await row(wrapper, '21:20').trigger('click');

    expect(lastSelection(wrapper)).toEqual(['slot-21:20']);
  });

  it('shortens the run from either end, down to nothing', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
    const wrapper = mountPicker({ modelValue: ['slot-20:00', 'slot-20:40'] });
    await flushPromises();

    await row(wrapper, '20:40').trigger('click');
    expect(lastSelection(wrapper)).toEqual(['slot-20:00']);

    await wrapper.setProps({ modelValue: ['slot-20:00'] });
    await row(wrapper, '20:00').trigger('click');
    expect(lastSelection(wrapper)).toEqual([]);
  });

  it('keeps a run on one arena', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([S20H, S20H40, { ...S21H20, arenaNumber: 2 }]);
    const wrapper = mountPicker({ modelValue: ['slot-20:00', 'slot-20:40'] });
    await flushPromises();

    await row(wrapper, '21:20').trigger('click');

    expect(lastSelection(wrapper)).toEqual(['slot-21:20']);
  });

  it('sums up the run with its convocation time', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
    const wrapper = mountPicker({ modelValue: ['slot-20:00', 'slot-20:40'] });
    await flushPromises();

    expect(wrapper.text()).toContain('2 créneaux, 20:00 – 21:20, convocation à 19:50');
    expect(rows(wrapper).filter(r => r.classes('selected')).map(r => r.text().slice(0, 5))).toEqual(['20:00', '20:40']);
  });

  it('keeps saved slots that eva.gg no longer lists, and says so', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([S21H20]);
    const wrapper = mountPicker({ modelValue: ['slot-gone'], currentStartTime: '20:00', currentEndTime: '21:20' });
    await flushPromises();

    expect(wrapper.find('.slot-row--stored').text()).toContain('20:00 – 21:20');
    expect(wrapper.text()).toContain('plus proposés');
  });

  it('shows a spinner while the slots load', async () => {
    vi.mocked(fetchVenueSlots).mockImplementation(() => new Promise(() => {}));
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.find('.spinner').exists()).toBe(true);
    expect(wrapper.text()).toContain('Chargement des créneaux');
  });

  it('tells the form whether slots can be listed', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue(DAY);
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.emitted('status')!.map(([status]) => status)).toEqual(['loading', 'ready']);
  });

  it('steps aside when the slots cannot be read, so the times get typed by hand', async () => {
    vi.mocked(fetchVenueSlots).mockRejectedValue(new Error('502'));
    const wrapper = mountPicker();
    await flushPromises();

    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain('ne peuvent pas être lus');
    expect(wrapper.emitted('status')!.at(-1)).toEqual(['unavailable']);
  });

  it('says when the venue runs nothing that day', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([]);
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.text()).toContain('Aucun créneau');
  });
});
