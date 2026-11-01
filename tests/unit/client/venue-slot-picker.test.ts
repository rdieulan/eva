// Tests for the VenueSlotPicker component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import { fetchVenueSlots } from '@/api/teams.api';

vi.mock('@/api/teams.api', () => ({
  fetchVenueSlots: vi.fn(),
}));

const SLOT_20H = {
  slotId: 'slot-20:00',
  startTime: '20:00',
  endTime: '20:40',
  convocationTime: '19:50',
  arenaNumber: 1,
  availableSeats: 3,
  totalSeats: 10,
};
const SLOT_20H40 = { ...SLOT_20H, slotId: 'slot-20:40', startTime: '20:40', endTime: '21:20', convocationTime: '20:30', availableSeats: 10 };

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(VenueSlotPicker, {
    props: {
      venueId: 'venue-1',
      date: '2026-11-03',
      modelValue: null,
      currentStartTime: '20:00',
      ...props,
    },
  });
}

beforeEach(() => {
  vi.mocked(fetchVenueSlots).mockReset();
});

describe('VenueSlotPicker', () => {
  it('lists the slots of the day, with nothing picked yet', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H, SLOT_20H40]);
    const wrapper = mountPicker();
    await flushPromises();

    const options = wrapper.findAll('option');
    expect(options.map(o => o.text())).toEqual(['Choisir un créneau', '20:00 – 20:40 · 3/10 places', '20:40 – 21:20 · 10/10 places']);
    expect((options[0]!.element as HTMLOptionElement).disabled).toBe(true);
  });

  it('names the arena only when the day runs on several', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H, { ...SLOT_20H, slotId: 'slot-20:00-2', arenaNumber: 2 }]);
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.findAll('option')[1]!.text()).toBe('20:00 – 20:40 · arène 1 · 3/10 places');
  });

  it('hands the chosen slot to the form', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H]);
    const wrapper = mountPicker();
    await flushPromises();

    await wrapper.find('select').setValue('slot-20:00');

    expect(wrapper.emitted('select')).toEqual([[SLOT_20H]]);
  });

  it('tells the form whether slots can be listed', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H]);
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.emitted('status')!.map(([status]) => status)).toEqual(['loading', 'ready']);
  });

  it('reminds the convocation time of the chosen slot', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H]);
    const wrapper = mountPicker({ modelValue: 'slot-20:00' });
    await flushPromises();

    expect(wrapper.text()).toContain('Convocation à 19:50');
  });

  it('keeps a saved slot that eva.gg no longer lists, and says so', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT_20H40]);
    const wrapper = mountPicker({ modelValue: 'slot-gone', currentStartTime: '20:00' });
    await flushPromises();

    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('slot-gone');
    expect(wrapper.findAll('option').map(o => o.text())).toContain('Créneau enregistré (20:00)');
    expect(wrapper.text()).toContain("n'est plus proposé");
  });

  it('steps aside when the slots cannot be read, so the times get typed by hand', async () => {
    vi.mocked(fetchVenueSlots).mockRejectedValue(new Error('502'));
    const wrapper = mountPicker();
    await flushPromises();

    expect(wrapper.find('select').exists()).toBe(false);
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
