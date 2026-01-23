<script setup lang="ts">
import type { MapConfig } from '@/types';
import { checkMapBalance } from '@/utils/balance';

const props = defineProps<{
  maps: MapConfig[];
  selectedMapId: string | null;
  editMode: boolean;
  canEdit: boolean;
  hasActiveAssignment: boolean;
  saveState?: 'idle' | 'saving' | 'success' | 'error';
  hasChanges?: boolean;
}>();

const emit = defineEmits<{
  'select-map': [mapId: string];
  'toggle-edit': [];
  'add-marker': [];
  'add-zone': [];
  'save': [];
  'cancel': [];
}>();


// Get balance status icon for a map
function getBalanceIcon(map: MapConfig): string {
  const result = checkMapBalance(map);
  if (result.isBalanced) {
    return '✓';
  }
  // Check if there are minor issues (warnings) vs critical errors
  // For now, any error is considered critical
  return '✗';
}

// Get balance status class for icon styling
function getBalanceClass(map: MapConfig): string {
  const result = checkMapBalance(map);
  if (result.isBalanced) {
    return 'status-ok';
  }
  return 'status-error';
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
          :class="{ active: selectedMapId === map.id }"
          @click="$emit('select-map', map.id)"
        >
          <span class="map-name">{{ map.name }}</span>
          <span class="balance-icon" :class="getBalanceClass(map)">{{ getBalanceIcon(map) }}</span>
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
          <span class="btn-icon-left">+</span>
          <span class="btn-label">Marqueur</span>
          <span class="btn-icon-right">📍</span>
        </button>
        <button
          class="edit-btn"
          :disabled="!hasActiveAssignment"
          @click="$emit('add-zone')"
        >
          <span class="btn-icon-left">+</span>
          <span class="btn-label">Zone</span>
          <span class="btn-icon-right">🔲</span>
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
        <button
          class="btn-save"
          :class="{
            'is-saving': saveState === 'saving',
            'is-success': saveState === 'success',
            'is-error': saveState === 'error',
            'has-changes': hasChanges && saveState === 'idle'
          }"
          :disabled="saveState === 'saving' || (!hasChanges && saveState === 'idle')"
          @click="$emit('save')"
        >
          <span v-if="saveState === 'saving'" class="btn-spinner"></span>
          <span v-else-if="saveState === 'success'" class="btn-check">✓</span>
          <span v-else-if="saveState === 'error'" class="btn-error">✕</span>
          <span v-else>💾 Sauvegarder</span>
        </button>
        <button
          class="btn-cancel"
          :class="{ 'has-changes': hasChanges }"
          :disabled="!hasChanges"
          @click="$emit('cancel')"
        >
          ✕ Annuler
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use 'sass:color';

.planner-sidebar {
  background: $color-bg-secondary;
  width: 100%;
  min-width: 180px;
  max-width: 220px;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @include tablet {
    min-width: 150px;
    max-width: 180px;
  }

  @include mobile-lg {
    width: 100%;
    min-width: unset;
    max-width: unset;
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
  border: 1px solid $color-accent;
  border-radius: $radius-md;
  padding: 2px;
  cursor: pointer;
  transition: border-color 0.2s;

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
      color: $color-white;
    }
  }

  // When edit mode is active, style in yellow
  &.edit-active {
    border-color: $color-edit;

    .mode-option.active {
      background: $color-edit;
      color: $color-black;
    }
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
  }
}

.map-name {
  flex: 1;
  color: $color-text-primary;
}

.balance-icon {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 0.9rem;
  margin-left: $spacing-sm;

  &.status-ok {
    color: $color-success;
  }

  &.status-warning {
    color: $color-warning;
  }

  &.status-error {
    color: $color-danger;
  }
}

.map-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  justify-content: space-between;
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

  .btn-icon-left {
    font-size: 1.2em;
    font-weight: 700;
    color: $color-success;
  }

  .btn-label {
    flex: 1;
    text-align: left;
  }

  .btn-icon-right {
    font-size: 1.2em;
  }

  @include mobile-lg {
    width: auto;
    padding: $spacing-sm;

    .btn-label {
      display: none;
    }

    .btn-icon-left {
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
  background: $color-bg-tertiary;
  color: $color-text-secondary;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  border: 1px solid $color-border;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.has-changes {
    background: $color-accent;
    color: white;
    border-color: $color-accent;

    &:hover:not(:disabled):not(.is-success):not(.is-error) {
      background: color.adjust($color-accent, $lightness: 5%);
    }
  }

  &.is-saving {
    background: $color-accent;
    color: white;
    border-color: $color-accent;
  }

  &.is-success {
    background: $color-success !important;
    color: white;
    border-color: $color-success !important;
    animation: pulse-success 0.3s ease-out;
  }

  &.is-error {
    background: $color-danger !important;
    color: white;
    border-color: $color-danger !important;
    animation: shake 0.3s ease-out;
  }
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba($color-white, 0.3);
  border-top-color: $color-white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-check {
  font-size: 1.2em;
  animation: fade-in 0.2s ease-out;
}

.btn-error {
  font-size: 1.2em;
  animation: fade-in 0.2s ease-out;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-success {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.btn-cancel {
  background: $color-bg-tertiary;
  color: $color-text-secondary;
  border: 1px solid $color-border;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.has-changes {
    background: $color-danger;
    color: white;
    border-color: $color-danger;

    &:hover:not(:disabled) {
      background: color.adjust($color-danger, $lightness: 5%);
    }
  }
}
</style>

