<script setup lang="ts">
import { ref } from 'vue';
import type { Player, MapConfig } from '@shared/types';
import { getPlayerAssignments, getPlayerMainAssignment } from '@/utils/balance';

const props = defineProps<{
  assignmentId: number;
  assignmentName: string;
  assignmentColor: string;
  position: { x: number; y: number };
  players: Player[];
  map: MapConfig;
}>();

const emit = defineEmits<{
  'toggle-player': [playerId: string];
  'toggle-main': [playerId: string];
  'update-name': [name: string];
  'close': [];
}>();

// Name editing state
const isEditingName = ref(false);
const tempName = ref('');

// Check if a player is associated to this assignment
function isPlayerAssociated(playerId: string): boolean {
  return getPlayerAssignments(props.map, playerId).includes(props.assignmentId);
}

// Check if this assignment is the main role for a player
function isMainRole(playerId: string): boolean {
  return getPlayerMainAssignment(props.map, playerId) === props.assignmentId;
}

// Start editing name
function startEditingName(): void {
  tempName.value = props.assignmentName;
  isEditingName.value = true;
}

// Save name
function saveName(): void {
  if (tempName.value.trim()) {
    emit('update-name', tempName.value.trim());
  }
  isEditingName.value = false;
}

// Cancel name editing
function cancelEditingName(): void {
  isEditingName.value = false;
}
</script>

<template>
  <div class="player-edit-panel" :style="{ left: position.x + 'px', top: position.y + 'px' }">
    <div class="panel-header">
      <!-- Name display mode (clickable to edit) -->
      <span
        v-if="!isEditingName"
        class="panel-title editable"
        :style="{ color: assignmentColor }"
        @click="startEditingName"
        title="Click to edit name"
      >
        {{ assignmentName }}
        <span class="edit-hint">✎</span>
      </span>
      <!-- Name edit mode -->
      <div v-else class="name-edit-wrapper">
        <input
          v-model="tempName"
          class="name-input"
          :style="{ color: assignmentColor }"
          @keyup.enter="saveName"
          @keyup.escape="cancelEditingName"
          autofocus
        />
        <button class="name-save" @click="saveName">✓</button>
        <button class="name-cancel" @click="cancelEditingName">✕</button>
      </div>
      <button class="panel-close" @click="emit('close')">✕</button>
    </div>

    <div class="panel-content">
      <div v-for="player in players" :key="player.id" class="player-row">
        <label class="player-checkbox" :class="{ checked: isPlayerAssociated(player.id) }">
          <input
            type="checkbox"
            :checked="isPlayerAssociated(player.id)"
            @change="emit('toggle-player', player.id)"
          />
          {{ player.name }}
        </label>
        <button
          v-if="isPlayerAssociated(player.id)"
          class="main-role-btn"
          :class="{ active: isMainRole(player.id) }"
          @click="emit('toggle-main', player.id)"
          title="Définir comme rôle principal"
        >
          {{ isMainRole(player.id) ? '★' : '☆' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Backdrop -->
  <div class="panel-backdrop" @click="emit('close')"></div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.player-edit-panel {
  position: fixed;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-sm;
  z-index: 1001;
  min-width: 180px;
  max-width: 250px;
  box-shadow: 0 4px 12px $color-shadow;
  transform: translate(-50%, 10px);

  .panel-header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-sm;
    padding-bottom: $spacing-sm;
    border-bottom: 1px solid $color-border;

    .panel-title {
      flex: 1;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }

      .edit-hint {
        font-size: 12px;
        opacity: 0.5;
        margin-left: 4px;
      }
    }

    .name-edit-wrapper {
      flex: 1;
      display: flex;
      gap: 4px;

      .name-input {
        flex: 1;
        background: $color-bg-primary;
        border: 1px solid $color-border;
        border-radius: $radius-sm;
        padding: 4px 8px;
        font-size: 14px;
        font-weight: bold;
        min-width: 0;
      }

      .name-save,
      .name-cancel {
        background: $color-bg-tertiary;
        border: 1px solid $color-border;
        border-radius: $radius-sm;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 14px;

        &:hover {
          background: $color-bg-primary;
        }
      }

      .name-save {
        color: $color-success;
      }

      .name-cancel {
        color: $color-danger;
      }
    }

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

  .panel-content {
    max-height: 200px;
    overflow-y: auto;

    .player-row {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      padding: 4px 0;

      .player-checkbox {
        flex: 1;
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        cursor: pointer;
        font-size: 13px;
        color: $color-text-primary;

        input[type="checkbox"] {
          cursor: pointer;
        }

        &.checked {
          font-weight: 600;
        }
      }

      .main-role-btn {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: $color-text-secondary;
        padding: 2px;

        &:hover,
        &.active {
          color: $color-star;
        }
      }
    }
  }
}

.panel-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}
</style>

