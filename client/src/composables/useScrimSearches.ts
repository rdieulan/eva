// The open scrim searches of a month, reloaded whenever the month or the venues change

import { ref, computed, watch, type Ref } from 'vue';
import type { ScrimSearch } from '@shared/types';
import { fetchScrimSearches } from '@/api';

// 'unavailable': the searches could not be read; the calendar shows none
export type ScrimSearchesStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export function useScrimSearches(options: {
  month: Ref<string>;            // YYYY-MM
  venueIds: Ref<string[] | null>; // Every team's searches offering slots in these venues, the team's own wherever they are; the team's own alone when null
  enabled: Ref<boolean>;
}) {
  const searches = ref<ScrimSearch[]>([]);
  const status = ref<ScrimSearchesStatus>('idle');

  // Answers that arrive after the month or the venues moved on are dropped
  let requestId = 0;

  async function load() {
    if (!options.enabled.value || !options.month.value) {
      searches.value = [];
      status.value = 'idle';
      return;
    }

    const id = ++requestId;
    status.value = 'loading';
    try {
      const loaded = await fetchScrimSearches(options.month.value, options.venueIds.value);
      if (id !== requestId) return;
      searches.value = loaded;
      status.value = 'ready';
    } catch {
      if (id !== requestId) return;
      searches.value = [];
      status.value = 'unavailable';
    }
  }

  watch([options.month, options.venueIds, options.enabled], load, { immediate: true });

  // The searches of each day, for the calendar cells
  const byDate = computed<Record<string, ScrimSearch[]>>(() => {
    const grouped: Record<string, ScrimSearch[]> = {};
    for (const search of searches.value) {
      (grouped[search.date] ??= []).push(search);
    }
    return grouped;
  });

  return { searches, status, byDate, load };
}
