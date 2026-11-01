<script setup lang="ts">
import type { Venue } from '@shared/types';
import { formatVenueLabel } from '@/utils/venues';

// The venue whose slots the matchmaking calendar shows. The team's own venues
// are one click away; the rest of the network sits in a list.
defineProps<{
  quickVenues: Venue[]; // Affiliated venue and favorites, in that order
  otherVenues: Venue[];
}>();

const venueId = defineModel<string | null>({ required: true });
</script>

<template>
  <div class="venue-picker" role="group" aria-label="Salle">
    <button
      v-for="venue in quickVenues"
      :key="venue.id"
      type="button"
      class="venue-chip"
      :class="{ active: venue.id === venueId }"
      @click="venueId = venue.id"
    >
      {{ formatVenueLabel(venue) }}
    </button>

    <select
      v-if="otherVenues.length"
      class="venue-select"
      :class="{ active: otherVenues.some(venue => venue.id === venueId) }"
      :value="otherVenues.some(venue => venue.id === venueId) ? venueId : ''"
      aria-label="Autre salle"
      @change="venueId = ($event.target as HTMLSelectElement).value || null"
    >
      <option value="" disabled>{{ quickVenues.length ? 'Autre salle…' : 'Choisir une salle…' }}</option>
      <option v-for="venue in otherVenues" :key="venue.id" :value="venue.id">
        {{ formatVenueLabel(venue) }}
      </option>
    </select>

    <span v-if="!quickVenues.length && !otherVenues.length" class="venue-empty">
      Aucune salle reliée à eva.gg
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.venue-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  max-width: 1200px;
}

.venue-chip,
.venue-select {
  padding: 0.45rem 1rem;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: 999px;
  color: $color-text-secondary;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: $color-white;
    border-color: $color-accent;
  }

  &.active {
    background: $color-accent;
    border-color: $color-accent;
    color: $color-white;
  }

  @include mobile-lg {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
  }
}

.venue-select {
  max-width: 220px;

  &:focus {
    outline: none;
    border-color: $color-accent;
  }

  option {
    background: $color-bg-secondary;
    color: $color-white;
  }
}

.venue-empty {
  color: $color-text-secondary;
  font-size: 0.85rem;
  font-style: italic;
}
</style>
