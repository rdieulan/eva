<script lang="ts">
import type { CalendarEvent, ScrimSearch, SubscriptionRenewal, VenueEventView } from '@shared/types';

// What a day holds, all of it, as the calendar reads it: in matchmaking, the
// searches alone, ours and the other teams'
export interface DayAgenda {
  date: string; // YYYY-MM-DD
  searches: ScrimSearch[];
  events: CalendarEvent[];
  renewals: SubscriptionRenewal[];
  venueEvents: VenueEventView[]; // The venue's the team has not added
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import DayItems from '@/components/calendar/DayItems.vue';
import { formatLongDate } from '@/utils/calendar';

// A day of the calendar listed whole: the day shows the rows it has room for,
// and its last row opens this list on everything. Our own search, the mark of
// the day, takes the first row; a row opens what it shows, as it does in the
// day.
const props = defineProps<{
  day: DayAgenda | null; // Open while set
}>();

const emit = defineEmits<{
  close: [];
  'open-search': [search: ScrimSearch];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-venue-event': [event: VenueEventView];
}>();

// The day stays on screen while the window fades out
const shown = ref<DayAgenda | null>(props.day);
watch(() => props.day, day => {
  if (day) shown.value = day;
});

const ownSearch = computed(() => shown.value?.searches.find(search => search.isMine) ?? null);
const otherSearches = computed(() => shown.value?.searches.filter(search => !search.isMine) ?? []);

const title = computed(() => {
  if (!shown.value) return '';
  const date = formatLongDate(shown.value.date);
  return date.charAt(0).toUpperCase() + date.slice(1);
});
</script>

<template>
  <Modal :open="day !== null" :title="title" size="sm" @close="emit('close')">
    <div v-if="shown" class="agenda">
      <DayItems
        :own-search="ownSearch"
        :searches="otherSearches"
        :events="shown.events"
        :renewals="shown.renewals"
        :venue-events="shown.venueEvents"
        @open-search="search => emit('open-search', search)"
        @open-venue-event="venueEvent => emit('open-venue-event', venueEvent)"
        @open-event-viewer="(events, index) => emit('open-event-viewer', events, index)"
      />
    </div>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// The rows of the day at reading size (see DayItems)
.agenda {
  --row-font: 0.95rem;
  --row-pad-y: 0.45rem;
  --row-pad-x: 0.6rem;
  --row-gap: 0.15rem;

  @include mobile-lg {
    --row-font: 0.9rem;
  }
}
</style>
