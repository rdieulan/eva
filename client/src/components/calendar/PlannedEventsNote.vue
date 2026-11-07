<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarEvent } from '@shared/types';
import { sortEventsByTime } from '@/utils/calendar';

// What the team already planned on a day, where the hours of a match are
// chosen: the matchmaking calendar leaves the team's events to the team's
// reading, and here is where they still matter. Nothing when the day is free.
const props = defineProps<{
  events: CalendarEvent[];
}>();

const sorted = computed(() => sortEventsByTime(props.events));
</script>

<template>
  <p v-if="sorted.length" class="planned">
    <span class="planned-label">Déjà prévu</span>
    <span v-for="event in sorted" :key="event.id" class="planned-event">
      <span class="planned-time">{{ event.startTime }} – {{ event.endTime }}</span> {{ event.title }}
    </span>
  </p>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// One line that wraps, an event after the other
.planned {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem $spacing-md;
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.8rem;
}

.planned-label {
  color: $color-text-muted;
  font-weight: 600;
}

.planned-time {
  color: $color-text-primary;
  font-weight: 600;
}
</style>
