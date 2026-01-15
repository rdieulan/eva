<script setup lang="ts">
import type { MapConfig } from '@/types';
import { checkMapBalance } from '@/services';

const props = defineProps<{
  maps: MapConfig[];
  selectedMapId: string | null;
  editMode: boolean;
  canEdit: boolean;
  hasActiveAssignment: boolean;
}>();

const emit = defineEmits<{
  'select-map': [mapId: string];
  'toggle-edit': [];
  'add-marker': [];
  'add-zone': [];
  'save': [];
  'cancel': [];
}>();

function isMapBalanced(map: MapConfig): boolean {
  return checkMapBalance(map).isBalanced;
}
</script>

<template>
  <aside class="planner-sidebar">
    <!-- Header with switch -->
    <div class="sidebar-header">
      <button
        v-if="canEdit"
        class="mode-switch"
        :class="{ 'edit-active': editMode }"
        @click="$emit('toggle-edit')"
      >
        <span class="mode-option" :class="{ active: !editMode }">Maps</span>
        <span class="mode-option" :class="{ active: editMode }">Édition</span>
      </button>
      <h2 v-else>Maps</h2>
    </div>

    <!-- Maps list (when not in edit mode) -->
    <div v-if="!editMode" class="sidebar-content maps-mode">
      <ul class="map-list">
        <li
          v-for="map in maps"
          :key="map.id"
          :class="{
            active: selectedMapId === map.id,
            balanced: isMapBalanced(map),
            unbalanced: !isMapBalanced(map)
          }"
          @click="$emit('select-map', map.id)"
        >
          {{ map.name }}
        </li>
      </ul>
    </div>

    <!-- Edit menu (when in edit mode) -->
    <div v-else class="sidebar-content edit-mode">
      <div class="edit-section">
        <h3>Ajouter</h3>
        <button
          class="edit-btn"
          :disabled="!hasActiveAssignment"
          @click="$emit('add-marker')"
        >
          <span class="btn-icon">📍</span>
          <span class="btn-label">Marqueur</span>
        </button>
        <button
          class="edit-btn"
          :disabled="!hasActiveAssignment"
          @click="$emit('add-zone')"
        >
          <span class="btn-icon">🔲</span>
          <span class="btn-label">Zone</span>
        </button>
      </div>

      <div class="edit-section">
        <h3>Instructions</h3>
        <ul class="instructions">
          <li><strong>Drag</strong> : Déplacer marqueur/zone</li>
          <li><strong>Double-clic</strong> : Supprimer marqueur</li>
          <li><strong>Clic droit</strong> : Options du marqueur</li>
          <li><strong>Points</strong> : Modifier forme de zone</li>
        </ul>
      </div>

      <div v-if="!hasActiveAssignment" class="edit-warning">
        ⚠️ Sélectionnez un rôle pour éditer
      </div>

      <!-- Save/Cancel buttons at bottom -->
      <div class="edit-actions">
        <button class="btn-save" @click="$emit('save')">💾 Sauvegarder</button>
        <button class="btn-cancel" @click="$emit('cancel')">✕ Annuler</button>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use 'sass:color';

.planner-sidebar {
  background: $color-bg-secondary;
  min-width: 180px;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;

  @include tablet {
    min-width: 150px;
  }

  @include mobile-lg {
    min-width: 100%;
    max-width: 100%;
    border-right: none;
    border-bottom: 1px solid $color-border;
  }
}

.sidebar-header {
  padding: $spacing-md;
  border-bottom: 1px solid $color-border;

  @include tablet {
    padding: 0.75rem;
  }

  @include mobile-lg {
    padding: $spacing-sm;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: $color-text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-align: center;

    @include tablet {
      font-size: 1rem;
    }
  }
}

.mode-switch {
  display: flex;
  width: 100%;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: 2px;
  cursor: pointer;

  .mode-option {
    flex: 1;
    padding: $spacing-xs $spacing-sm;
    text-align: center;
    font-size: $font-size-sm;
    font-weight: 600;
    color: $color-text-secondary;
    border-radius: $radius-sm;
    transition: all 0.2s;

    &.active {
      background: $color-accent;
      color: #fff;
    }
  }

  &.edit-active .mode-option.active {
    background: $color-danger;
  }
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-md;

  @include tablet {
    padding: 0.75rem;
  }

  @include mobile-lg {
    padding: $spacing-sm;
    overflow-x: auto;
    overflow-y: visible;
  }
}

// Maps mode
.maps-mode {
  @include mobile-lg {
    padding: $spacing-xs $spacing-sm;
  }
}

.map-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  @include mobile-lg {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: $spacing-sm;
  }

  li {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-tertiary;
    border-radius: $radius-sm;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s;
    border-left: 3px solid transparent;
    white-space: nowrap;

    @include tablet {
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
    }

    @include mobile-lg {
      padding: 0.35rem 0.6rem;
      font-size: 0.8rem;
      border-left: none;
      border-bottom: 3px solid transparent;
    }

    &:hover {
      background: $color-bg-primary;
    }

    &.active {
      background: $color-bg-primary;
      border-left-color: $color-accent;

      @include mobile-lg {
        border-left-color: transparent;
        border-bottom-color: $color-accent;
      }
    }

    &.balanced {
      color: $color-success;
    }

    &.unbalanced {
      color: $color-danger;
    }
  }
}

// Edit mode
.edit-mode {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;

  @include mobile-lg {
    flex-direction: row;
    align-items: flex-start;
    gap: $spacing-md;
  }
}

.edit-section {
  h3 {
    margin: 0 0 $spacing-sm 0;
    font-size: $font-size-sm;
    color: $color-text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @include mobile-lg {
    h3 {
      display: none;
    }
  }
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-xs;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text-primary;
  font-size: $font-size-sm;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: $color-bg-primary;
    border-color: $color-accent;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: 1.2em;
  }

  @include mobile-lg {
    width: auto;
    padding: $spacing-sm;

    .btn-label {
      display: none;
    }
  }
}

.instructions {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-text-secondary;

  li {
    padding: $spacing-xs 0;
    border-bottom: 1px solid $color-border;

    &:last-child {
      border-bottom: none;
    }

    strong {
      color: $color-text-primary;
    }
  }

  @include mobile-lg {
    display: none;
  }
}

.edit-warning {
  padding: $spacing-sm;
  background: rgba($color-warning, 0.1);
  border: 1px solid rgba($color-warning, 0.3);
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  color: $color-warning;
  text-align: center;

  @include mobile-lg {
    padding: $spacing-xs $spacing-sm;
    white-space: nowrap;
  }
}

.edit-actions {
  margin-top: auto;
  padding-top: $spacing-md;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  @include mobile-lg {
    flex-direction: row;
    padding-top: 0;
  }
}

.btn-save,
.btn-cancel {
  padding: $spacing-sm $spacing-md;
  border: none;
  border-radius: $radius-sm;
  font-weight: 600;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;

  @include mobile-lg {
    padding: $spacing-sm;
    font-size: $font-size-xs;
  }
}

.btn-save {
  background: $color-success;
  color: $color-bg-secondary;

  &:hover {
    background: color.adjust($color-success, $lightness: 5%);
  }
}

.btn-cancel {
  background: $color-bg-tertiary;
  color: $color-text-secondary;
  border: 1px solid $color-border;

  &:hover {
    background: $color-bg-primary;
    color: $color-text-primary;
  }
}
</style>

