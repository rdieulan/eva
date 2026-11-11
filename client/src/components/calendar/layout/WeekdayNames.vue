<script setup lang="ts">
import { WEEKDAY_NAMES_SHORT } from '@/constants/calendar';

// The names of the days over the columns of a month, Monday first, in the
// columns of the grid below (see MonthLayout)
</script>

<template>
  <div class="weekdays-header">
    <div v-for="dayName in WEEKDAY_NAMES_SHORT" :key="dayName" class="weekday-name">
      {{ dayName }}
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.weekdays-header {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr)); // Same columns as the grid below
  gap: $spacing-sm;
  width: 100%;
  max-width: 1200px;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
  }

  @include mobile {
    gap: 0.15rem;
  }
}

.weekday-name {
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: $color-accent;
  padding: $spacing-xs;

  @include mobile-lg {
    font-size: 0.7rem;
    padding: 0.15rem;
  }

  @include mobile {
    font-size: 0.65rem;
    padding: 0.1rem;
  }
}
</style>
