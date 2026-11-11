<script setup lang="ts">
import { formatLongDate } from '@/utils/calendar';

// The sheet of an event as the calendar shows it: its title, its day and its
// hours, then its description. Whoever shows it adds the rest: a tag beside
// the hours (`hours`), rows of their own among the details (`details`, each a
// `.detail-row` of a `.detail-label` and a `.detail-value`, dressed here), and
// what comes between the details and the description (the default slot).
defineProps<{
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  description?: string | null;
}>();
</script>

<template>
  <div class="event-sheet">
    <h2 class="event-title">{{ title }}</h2>

    <div class="event-details">
      <div class="detail-row">
        <span class="detail-label">📅 Date</span>
        <span class="detail-value">{{ formatLongDate(date) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">🕐 Horaire</span>
        <span class="detail-value">
          {{ startTime }} - {{ endTime }}
          <slot name="hours" />
        </span>
      </div>
      <slot name="details" />
    </div>

    <slot />

    <div v-if="description" class="event-description">
      <span class="detail-label">📝 Description</span>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.event-sheet {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.event-title {
  margin: 0;
  font-size: 1.5rem;
  color: $color-white;
  text-align: center;

  @include mobile-lg {
    font-size: 1.25rem;
  }
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: $spacing-md;
  background: with-alpha($color-bg-tertiary, 0.5);
  border-radius: $radius-md;
}

// The rows of the sheet, and the ones its reader adds
.detail-row,
:slotted(.detail-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;

  @include mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
  }
}

.detail-label,
:slotted(.detail-label) {
  color: $color-text-secondary;
  font-size: 0.9rem;
}

.detail-value,
:slotted(.detail-value) {
  color: $color-white;
  font-weight: 500;
}

.event-description {
  padding: $spacing-md;
  background: with-alpha($color-bg-tertiary, 0.5);
  border-radius: $radius-md;

  .detail-label {
    display: block;
    margin-bottom: $spacing-sm;
  }

  p {
    margin: 0;
    color: $color-text-muted;
    white-space: pre-wrap;
  }
}
</style>
