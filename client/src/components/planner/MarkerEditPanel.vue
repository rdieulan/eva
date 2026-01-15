<script setup lang="ts">
import type { Marker, MarkerIcon } from '@shared/types';
import { MARKER_ICONS, MARKER_SIZES } from '@shared/types';
import { getMarkerIconPath } from '@/utils/markers';

const props = defineProps<{
  marker: Marker;
  position: { x: number; y: number };
}>();

const emit = defineEmits<{
  'update:icon': [icon: MarkerIcon];
  'update:size': [size: number];
  'delete': [];
  'close': [];
}>();

function getMarkerSize(): number {
  return props.marker.size ?? 1;
}
</script>

<template>
  <div class="marker-edit-panel" :style="{ left: position.x + 'px', top: position.y + 'px' }">
    <div class="marker-panel-header">
      <span>Édition du marqueur</span>
      <button class="panel-close" @click="emit('close')">✕</button>
    </div>

    <div class="marker-panel-body">
      <!-- Icon selection -->
      <div class="marker-section">
        <label class="section-label">Icône</label>
        <div class="marker-icons-grid">
          <button
            v-for="icon in MARKER_ICONS"
            :key="icon"
            class="marker-icon-btn"
            :class="{ active: marker.icon === icon }"
            @click="emit('update:icon', icon)"
            :title="icon"
          >
            <svg viewBox="0 0 24 24" class="marker-icon-svg">
              <path :d="getMarkerIconPath(icon)" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Size selection -->
      <div class="marker-section">
        <label class="section-label">Taille</label>
        <div class="marker-sizes-row">
          <button
            v-for="sizeOption in MARKER_SIZES"
            :key="sizeOption.value"
            class="marker-size-btn"
            :class="{ active: getMarkerSize() === sizeOption.value }"
            @click="emit('update:size', sizeOption.value)"
          >
            {{ sizeOption.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete button -->
    <button class="marker-delete-btn" @click="emit('delete')">
      🗑️ Supprimer
    </button>
  </div>

  <!-- Backdrop -->
  <div class="panel-backdrop marker-backdrop" @click="emit('close')"></div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.marker-edit-panel {
  position: fixed;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-sm;
  z-index: 1001;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, 10px);

  .marker-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-sm;
    font-weight: 600;
    color: $color-text-primary;

    .panel-close {
      background: none;
      border: none;
      color: $color-text-secondary;
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;

      &:hover {
        color: $color-text-primary;
      }
    }
  }

  .marker-panel-body {
    .marker-section {
      margin-bottom: $spacing-sm;

      .section-label {
        display: block;
        font-size: 11px;
        color: $color-text-secondary;
        margin-bottom: $spacing-xs;
        text-transform: uppercase;
      }
    }

    .marker-icons-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;

      .marker-icon-btn {
        background: $color-bg-primary;
        border: 1px solid $color-border;
        border-radius: $radius-sm;
        padding: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background: $color-bg-tertiary;
        }

        &.active {
          border-color: $color-accent;
          background: rgba($color-accent, 0.2);
        }

        .marker-icon-svg {
          width: 18px;
          height: 18px;
          fill: $color-text-primary;
        }
      }
    }

    .marker-sizes-row {
      display: flex;
      gap: 4px;

      .marker-size-btn {
        flex: 1;
        background: $color-bg-primary;
        border: 1px solid $color-border;
        border-radius: $radius-sm;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        color: $color-text-primary;

        &:hover {
          background: $color-bg-tertiary;
        }

        &.active {
          border-color: $color-accent;
          background: rgba($color-accent, 0.2);
        }
      }
    }
  }

  .marker-delete-btn {
    width: 100%;
    background: $color-danger;
    color: white;
    border: none;
    border-radius: $radius-sm;
    padding: 8px;
    cursor: pointer;
    font-size: 12px;
    margin-top: $spacing-sm;

    &:hover {
      opacity: 0.9;
    }
  }
}

.panel-backdrop.marker-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}
</style>

