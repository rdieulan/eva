<script setup lang="ts">
import { EVENT_TYPES } from '@shared/types';
import type { EventType } from '@shared/types';
import { getEventTypeClass, getEventTypeDisplay } from '@/utils/calendar';

// The type of an event, picked among the four: the one picked in its own colour
const type = defineModel<EventType>({ required: true });
</script>

<template>
  <div class="type-selector">
    <button
      v-for="eventType in EVENT_TYPES"
      :key="eventType"
      type="button"
      class="type-btn"
      :class="[getEventTypeClass(eventType), { active: type === eventType }]"
      @click="type = eventType"
    >
      <span class="type-btn-icon">{{ getEventTypeDisplay(eventType).emoji }}</span>
      <span class="type-btn-label">{{ getEventTypeDisplay(eventType).label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// Four types, two by two: each name whole, on the narrowest form
.type-selector {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-sm;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
  padding: 0.75rem;
  background: $color-bg-tertiary;
  border: $border-thick solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
  }

  @each $type, $color in $event-type-colors {
    &.active.event-type--#{$type} {
      background: with-alpha($color, 0.2);
      border-color: $color;
      color: $color;
    }
  }

  @include mobile-lg {
    padding: $spacing-sm;
    font-size: 0.85rem;
  }

  @include mobile {
    padding: 0.4rem;
    font-size: 0.8rem;
  }
}

.type-btn-icon {
  font-size: 1.1rem;
  line-height: 1;
}
</style>
