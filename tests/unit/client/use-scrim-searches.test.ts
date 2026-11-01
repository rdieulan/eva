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
    id, team: { id: isMine ? 'us' : 'them', name: 'T', logoUrl: null }, venueId: 'v', date, arenaNumber: 1,
    evaSlotIds: [id], startTime: '20:00', endTime: '20:40', convocationTime: '19:50', status: 'OPEN', isMine, createdAt: '',
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
  it('loads the searches of the month at the venue, grouped by day, and knows which are ours', async () => {
    api.mockResolvedValue([search('a', '2030-06-10', true), search('b', '2030-06-10', false), search('c', '2030-06-12', false)]);
    const { status, byDate, mine } = useScrimSearches({ month: ref('2030-06'), venueId: ref('v'), enabled: ref(true) });

    await settle();
    expect(api).toHaveBeenCalledWith('2030-06', 'v');
    expect(status.value).toBe('ready');
    expect(Object.keys(byDate.value)).toEqual(['2030-06-10', '2030-06-12']);
    expect(byDate.value['2030-06-10']).toHaveLength(2);
    expect(mine.value.map(s => s.id)).toEqual(['a']);
  });

  it('asks for the team\'s own searches when no venue is given, and reloads when the month moves', async () => {
    api.mockResolvedValue([]);
    const month = ref('2030-06');
    useScrimSearches({ month, venueId: ref(null), enabled: ref(true) });

    await settle();
    expect(api).toHaveBeenLastCalledWith('2030-06', null);

    month.value = '2030-07';
    await settle();
    expect(api).toHaveBeenLastCalledWith('2030-07', null);
  });

  it('stays idle and empty while disabled', async () => {
    const { status, searches } = useScrimSearches({ month: ref('2030-06'), venueId: ref('v'), enabled: ref(false) });
    await settle();
    expect(api).not.toHaveBeenCalled();
    expect(status.value).toBe('idle');
    expect(searches.value).toEqual([]);
  });

  it('shows nothing rather than stale data when the searches cannot be read', async () => {
    api.mockRejectedValue(new Error('down'));
    const { status, searches } = useScrimSearches({ month: ref('2030-06'), venueId: ref('v'), enabled: ref(true) });
    await settle();
    expect(status.value).toBe('unavailable');
    expect(searches.value).toEqual([]);
  });
});
