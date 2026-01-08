<script setup lang="ts">
import type { MapConfig } from '@/types';
import { checkMapBalance } from '@/config/config';

defineProps<{
  maps: MapConfig[];
  selectedMapId: string | null;
}>();

const emit = defineEmits<{
  select: [mapId: string];
}>();

function isMapBalanced(map: MapConfig): boolean {
  return checkMapBalance(map).isBalanced;
}
</script>

<template>
  <aside class="map-list">
    <h2>Maps</h2>
    <ul>
      <li
        v-for="map in maps"
        :key="map.id"
        :class="{
          active: selectedMapId === map.id,
          balanced: isMapBalanced(map),
          unbalanced: !isMapBalanced(map)
        }"
        @click="emit('select', map.id)"
      >
        {{ map.name }}
      </li>
    </ul>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.map-list {
  background: $color-bg-secondary;
  padding: $spacing-md;
  min-width: 180px;
  border-right: 1px solid $color-border;

  @include tablet {
    min-width: 150px;
    padding: 0.75rem;
  }

  @include mobile-lg {
    min-width: 100%;
    max-width: 100%;
    padding: $spacing-sm;
    border-right: none;
    border-bottom: 1px solid $color-border;
    overflow-x: auto;
  }

  @include mobile {
    padding: 0.35rem;
  }

  h2 {
    margin: 0 0 $spacing-md 0;
    font-size: 1.2rem;
    color: $color-text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.1em;

    @include tablet {
      font-size: 1rem;
      margin-bottom: 0.75rem;
    }

    @include mobile-lg {
      display: none;
    }
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;

    @include mobile-lg {
      display: flex;
      flex-direction: row;
      gap: 0.35rem;
      overflow-x: auto;
      padding-bottom: $spacing-xs;
    }
  }

  li {
    padding: 0.75rem $spacing-md;
    cursor: pointer;
    border-radius: 6px;
    margin-bottom: $spacing-sm;
    transition: all 0.2s;
    color: $color-text-secondary;

    &.balanced {
      color: $color-success;

      &:hover {
        color: #6ee7a0;
      }
    }

    &.unbalanced {
      color: $color-danger;

      &:hover {
        color: #ff8a8a;
      }
    }

    &:hover {
      background: $color-bg-tertiary;
    }

    &.active {
      background: #4a4a8a;
      font-weight: 600;

      &.balanced {
        color: $color-success;
      }

      &.unbalanced {
        color: $color-danger;
      }
    }

    @include tablet {
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
    }

    @include mobile-lg {
      padding: $spacing-sm 0.75rem;
      margin-bottom: 0;
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 0.8rem;
    }

    @include mobile {
      padding: 0.4rem 0.6rem;
      font-size: 0.75rem;
      border-radius: $radius-sm;
    }
  }
}
</style>

