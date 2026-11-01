// Slots a venue runs on a day, reloaded whenever the venue or the day changes

import { ref, watch, type Ref } from 'vue';
import type { VenueSlot } from '@shared/types';
import { fetchVenueSlots } from '@/api';

// 'unavailable': eva.gg could not be read; the form falls back to free time entry
export type VenueSlotsStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export function useVenueSlots(options: {
  venueId: Ref<string | null>;
  date: Ref<string>;
  enabled: Ref<boolean>;
}) {
  const slots = ref<VenueSlot[]>([]);
  const status = ref<VenueSlotsStatus>('idle');

  // Answers that arrive after the venue or day moved on are dropped
  let requestId = 0;

  async function load() {
    const venueId = options.venueId.value;
    const date = options.date.value;
    if (!options.enabled.value || !venueId || !date) {
      slots.value = [];
      status.value = 'idle';
      return;
    }

    const id = ++requestId;
    status.value = 'loading';
    try {
      const loaded = await fetchVenueSlots(venueId, date);
      if (id !== requestId) return;
      slots.value = loaded;
      status.value = 'ready';
    } catch {
      if (id !== requestId) return;
      slots.value = [];
      status.value = 'unavailable';
    }
  }

  watch([options.venueId, options.date, options.enabled], load, { immediate: true });

  return { slots, status, load };
}
