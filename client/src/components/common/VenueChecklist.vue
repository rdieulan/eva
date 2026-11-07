<script setup lang="ts">
import type { Venue } from '@shared/types';
import { formatVenueLabel } from '@/utils/venues';

// A list of venues to tick; the model holds the ticked ids in the order they
// were ticked. Each row may carry more beside its box (the `trailing` slot),
// and a venue that moves in the list slides to its new place.
const props = withDefaults(defineProps<{
  venues: Venue[];
  legend: string;
  emptyText?: string;
  max?: number; // Once reached, the unticked venues cannot be ticked anymore
}>(), {
  emptyText: 'Aucune salle disponible.',
  max: undefined,
});

const selected = defineModel<string[]>({ required: true });

defineSlots<{
  trailing?: (props: { venue: Venue }) => unknown;
}>();

function isChecked(venueId: string): boolean {
  return selected.value.includes(venueId);
}

function isLocked(venueId: string): boolean {
  return props.max !== undefined && !isChecked(venueId) && selected.value.length >= props.max;
}

function toggle(venueId: string) {
  selected.value = isChecked(venueId)
    ? selected.value.filter(id => id !== venueId)
    : [...selected.value, venueId];
}
</script>

<template>
  <fieldset class="venue-checklist">
    <legend>{{ legend }}</legend>
    <p v-if="venues.length === 0" class="venue-checklist-empty">{{ emptyText }}</p>
    <TransitionGroup tag="div" name="venue-move" class="venue-rows">
      <div v-for="venue in venues" :key="venue.id" class="venue-option">
        <label class="venue-check" :class="{ 'venue-check--locked': isLocked(venue.id) }">
          <input
            type="checkbox"
            :checked="isChecked(venue.id)"
            :disabled="isLocked(venue.id)"
            @change="toggle(venue.id)"
          />
          <span class="venue-name">{{ formatVenueLabel(venue) }}</span>
        </label>
        <slot name="trailing" :venue="venue" />
      </div>
    </TransitionGroup>
  </fieldset>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.venue-checklist {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin: 0;
  // A fieldset grows to its longest line by default; the names are cut short instead
  min-width: 0;
  // Sixty venues would otherwise push the rest of the form off the screen;
  // a list in a menu may ask for more room
  max-height: var(--venue-checklist-max-height, 240px);
  overflow-y: auto;

  legend {
    color: $color-text-secondary;
    font-size: $font-size-sm;
    padding: 0 $spacing-xs;
  }
}

.venue-checklist-empty {
  margin: 0;
  color: $color-text-secondary;
  font-style: italic;
}

.venue-rows {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.venue-option {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.venue-check {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: $spacing-sm;
  color: $color-text-primary;
  cursor: pointer;

  input[type="checkbox"] {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    accent-color: $color-accent;
  }

  &--locked {
    color: $color-text-secondary;
    cursor: not-allowed;
  }
}

.venue-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// A venue that changes place slides there
.venue-move-move {
  transition: transform 0.25s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
</style>
