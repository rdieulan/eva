// Tests for the useScrimSearches composable
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useScrimSearches } from '@/composables/useScrimSearches';
import { fetchScrimSearches } from '@/api';
import type { ScrimSearch } from '@shared/types';

vi.mock('@/api', () => ({
  fetchScrimSearches: vi.fn(),
}));

const api = vi.mocked(fetchScrimSearches);

function search(id: string, date: string, isMine: boolean): ScrimSearch {
  return {
    id, team: { id: isMine ? 'us' : 'them', name: 'T', logoUrl: null }, date,
    slots: [{ slotId: id, venueId: 'v', arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' }],
    slotCount: 2, matchCount: 1, matchedCount: 0, takenSlotIds: [], startTime: '20:00', endTime: '20:40', convocationTime: '19:50', status: 'OPEN', isMine, proposals: [], createdAt: '',
  };
}

async function settle() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  api.mockReset();
});

describe('useScrimSearches', () => {
  it('loads the searches of the month in the venues, grouped by day', async () => {
    api.mockResolvedValue([search('a', '2030-06-10', true), search('b', '2030-06-10', false), search('c', '2030-06-12', false)]);
    const { status, byDate } = useScrimSearches({ months: ref(['2030-06']), venueIds: ref(['v', 'w']), enabled: ref(true) });

    await settle();
    expect(api).toHaveBeenCalledWith('2030-06', ['v', 'w']);
    expect(status.value).toBe('ready');
    expect(Object.keys(byDate.value)).toEqual(['2030-06-10', '2030-06-12']);
    expect(byDate.value['2030-06-10']!.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('asks for the team\'s own searches when no venue is given, and reloads when the month moves', async () => {
    api.mockResolvedValue([]);
    const months = ref(['2030-06']);
    useScrimSearches({ months, venueIds: ref(null), enabled: ref(true) });

    await settle();
    expect(api).toHaveBeenLastCalledWith('2030-06', null);

    months.value = ['2030-07'];
    await settle();
    expect(api).toHaveBeenLastCalledWith('2030-07', null);
  });

  it('loads the searches of both months a week spans, together', async () => {
    api.mockImplementation(async month => (month === '2030-06' ? [search('a', '2030-06-30', false)] : [search('b', '2030-07-01', false)]));
    const { byDate } = useScrimSearches({ months: ref(['2030-06', '2030-07']), venueIds: ref(['v']), enabled: ref(true) });

    await settle();
    expect(api.mock.calls.map(([month]) => month)).toEqual(['2030-06', '2030-07']);
    expect(Object.keys(byDate.value)).toEqual(['2030-06-30', '2030-07-01']);
  });

  it('reloads when the venues change', async () => {
    api.mockResolvedValue([]);
    const venueIds = ref<string[] | null>(['v']);
    useScrimSearches({ months: ref(['2030-06']), venueIds, enabled: ref(true) });
    await settle();

    venueIds.value = ['v', 'w'];
    await settle();
    expect(api).toHaveBeenLastCalledWith('2030-06', ['v', 'w']);
  });

  it('stays idle and empty while disabled', async () => {
    const { status, searches } = useScrimSearches({ months: ref(['2030-06']), venueIds: ref(['v']), enabled: ref(false) });
    await settle();
    expect(api).not.toHaveBeenCalled();
    expect(status.value).toBe('idle');
    expect(searches.value).toEqual([]);
  });

  it('shows nothing rather than stale data when the searches cannot be read', async () => {
    api.mockRejectedValue(new Error('down'));
    const { status, searches } = useScrimSearches({ months: ref(['2030-06']), venueIds: ref(['v']), enabled: ref(true) });
    await settle();
    expect(status.value).toBe('unavailable');
    expect(searches.value).toEqual([]);
  });
});
