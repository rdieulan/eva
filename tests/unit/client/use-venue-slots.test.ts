// Tests for the useVenueSlots composable (slot picker of the event form)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useVenueSlots } from '@/composables/useVenueSlots';
import { fetchVenueSlots } from '@/api/teams.api';

vi.mock('@/api/teams.api', () => ({
  fetchVenueSlots: vi.fn(),
}));

const SLOT = {
  slotId: 'slot-20:00',
  startTime: '20:00',
  endTime: '20:40',
  convocationTime: '19:50',
  arenaNumber: 1,
  availableSeats: 3,
  totalSeats: 10,
    gameId: 1,
};

async function settle() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.mocked(fetchVenueSlots).mockReset();
});

describe('useVenueSlots', () => {
  it('loads the slots of the venue for the day, and reloads when the day moves', async () => {
    vi.mocked(fetchVenueSlots).mockResolvedValue([SLOT]);
    const date = ref('2026-11-03');
    const { slots, status } = useVenueSlots({ venueId: ref('venue-1'), date, enabled: ref(true) });

    await settle();
    expect(status.value).toBe('ready');
    expect(slots.value).toEqual([SLOT]);
    expect(fetchVenueSlots).toHaveBeenCalledWith('venue-1', '2026-11-03');

    date.value = '2026-11-04';
    await settle();
    expect(fetchVenueSlots).toHaveBeenLastCalledWith('venue-1', '2026-11-04');
  });

  it('asks nothing without a venue, a day, or when disabled', async () => {
    useVenueSlots({ venueId: ref(null), date: ref('2026-11-03'), enabled: ref(true) });
    useVenueSlots({ venueId: ref('venue-1'), date: ref(''), enabled: ref(true) });
    const { status } = useVenueSlots({ venueId: ref('venue-1'), date: ref('2026-11-03'), enabled: ref(false) });

    await settle();
    expect(fetchVenueSlots).not.toHaveBeenCalled();
    expect(status.value).toBe('idle');
  });

  it('reports eva.gg as unavailable instead of failing the form', async () => {
    vi.mocked(fetchVenueSlots).mockRejectedValue(new Error('502'));
    const { slots, status } = useVenueSlots({ venueId: ref('venue-1'), date: ref('2026-11-03'), enabled: ref(true) });

    await settle();
    expect(status.value).toBe('unavailable');
    expect(slots.value).toEqual([]);
  });

  it('ignores an answer that arrives after the day moved on', async () => {
    let resolveFirst: (slots: typeof SLOT[]) => void = () => {};
    vi.mocked(fetchVenueSlots)
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([]);
    const date = ref('2026-11-03');
    const { slots, status } = useVenueSlots({ venueId: ref('venue-1'), date, enabled: ref(true) });
    await settle();

    date.value = '2026-11-04';
    await settle();
    resolveFirst([SLOT]);
    await settle();

    expect(status.value).toBe('ready');
    expect(slots.value).toEqual([]);
  });
});
