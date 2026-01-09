<script setup lang="ts">
import { computed, ref } from 'vue';
import { assignmentColors, checkMapBalance, getPlayerAssignments, getAssignmentPlayers } from '@/config/config';
import type { MapConfig, Player } from '@/types';
import RotationCalculator from '@/components/RotationCalculator.vue';
import SvgIcon from '@/components/common/SvgIcon.vue';

const props = defineProps<{
  players: Player[];
  selectedPlayerId: string | null;
  map: MapConfig | null;
  maps: MapConfig[];
  activeAssignments: number[];
  editMode: boolean;
  isLoading: boolean;
  canEdit: boolean;
}>();

const showCalculator = ref(false);

const emit = defineEmits<{
  'select-player': [playerId: string | null];
  'toggle-assignment': [assignmentId: number];
  'toggle-edit': [];
  'save': [];
  'cancel': [];
  'reset': [];
}>();

// List of available assignments (from current map or fallback)
const assignments = computed(() => {
  if (props.map && props.map.assignments.length > 0) {
    return props.map.assignments.map(p => ({ id: p.id, name: p.name }));
  }
  return [
    { id: 1, name: 'Poste 1' },
    { id: 2, name: 'Poste 2' },
    { id: 3, name: 'Poste 3' },
    { id: 4, name: 'Poste 4' },
  ];
});

// Balance check system
interface BalanceCheck {
  isBalanced: boolean;
  messages: string[];
}

const balanceCheck = computed<BalanceCheck>(() => {
  if (!props.map) {
    return { isBalanced: true, messages: ['Effectif équilibré'] };
  }

  const result = checkMapBalance(props.map);

  if (result.isBalanced) {
    return { isBalanced: true, messages: ['Effectif équilibré'] };
  }

  return {
    isBalanced: false,
    messages: result.errors,
  };
});

// Toggle player
function togglePlayer(playerId: string) {
  emit('select-player', playerId);
}

// Check if an assignment is associated with selected player
function isAssignmentAssociated(assignmentId: number): boolean {
  if (!props.selectedPlayerId || !props.map) return true;
  const playerAssignments = getPlayerAssignments(props.map, props.selectedPlayerId);
  return playerAssignments.includes(assignmentId);
}

// Check if an assignment is active
function isAssignmentActive(assignmentId: number): boolean {
  return props.activeAssignments.includes(assignmentId);
}

// Toggle assignment
function toggleAssignment(assignmentId: number) {
  if (!isAssignmentAssociated(assignmentId)) return;
  emit('toggle-assignment', assignmentId);
}

// Get assignment color
function getAssignmentColor(assignmentId: number): string {
  return assignmentColors[assignmentId] || '#888';
}

// Check if a player is highlighted (associated to selected assignment)
function isPlayerHighlighted(playerId: string): boolean {
  if (props.activeAssignments.length === 0 || !props.map) return false;
  const selectedAssignmentId = props.activeAssignments[0] as number;
  const assignedPlayers = getAssignmentPlayers(props.map, selectedAssignmentId);
  return assignedPlayers.includes(playerId);
}
</script>

<template>
  <div class="planner-toolbar">
    <!-- Left section - Messages -->
    <div class="section-left">
    <!-- Calculator icon -->
    <button
      class="btn-calculator"
      @click="showCalculator = true"
      title="Ouvrir le calculateur de rotation"
    >
      <SvgIcon name="calculator" class="calculator-icon" />
    </button>

    <div
      class="balance-messages"
      :class="{ 'is-balanced': balanceCheck.isBalanced, 'is-unbalanced': !balanceCheck.isBalanced }"
    >
      <div
        v-for="(msg, index) in balanceCheck.messages"
        :key="index"
        class="balance-message-row"
      >
        <span class="message-icon">{{ balanceCheck.isBalanced ? '✓' : '⚠' }}</span>
        <span class="message-text">{{ msg }}</span>
      </div>
    </div>
  </div>

  <!-- Center section - Players + Assignments -->
  <div class="section-center">
    <!-- Cartouche block -->
    <div class="cartouches-wrapper">
      <!-- Player cartouches -->
      <nav class="player-bar">
        <button
          v-for="player in players"
          :key="player.id"
          :class="{
            active: selectedPlayerId === player.id,
            highlighted: isPlayerHighlighted(player.id)
          }"
          @click="togglePlayer(player.id)"
        >
          {{ player.name }}
        </button>
      </nav>

      <!-- Assignment cartouches -->
      <nav class="assignment-bar">
        <button
          v-for="assignment in assignments"
          :key="assignment.id"
          :class="{
            active: isAssignmentActive(assignment.id),
            disabled: !isAssignmentAssociated(assignment.id)
          }"
          :style="{ '--assignment-color': getAssignmentColor(assignment.id) }"
          :disabled="!isAssignmentAssociated(assignment.id)"
          @click="toggleAssignment(assignment.id)"
        >
          {{ assignment.name }}
        </button>
      </nav>
    </div>

    <!-- Reset block -->
    <div class="reset-wrapper">
      <button
        class="btn-reset"
        @click="$emit('reset')"
        title="Réinitialiser la sélection"
      >
        <SvgIcon name="reset" class="reset-icon" />
      </button>
    </div>
  </div>

  <!-- Right section - Edit buttons (admin only) -->
  <div class="section-right">
    <div v-if="canEdit" class="edit-controls">
      <template v-if="editMode">
        <button class="btn-save" @click="$emit('save')">💾 Sauvegarder</button>
        <button class="btn-cancel" @click="$emit('cancel')">✕ Annuler</button>
      </template>
      <button
        class="btn-edit"
        :class="{ active: editMode }"
        @click="$emit('toggle-edit')"
        :disabled="isLoading"
      >
        {{ editMode ? '🔓 Mode Édition' : '🔒 Éditer' }}
      </button>
    </div>
  </div>
  </div>

  <!-- Rotation calculator modal -->
  <RotationCalculator
    v-if="showCalculator"
    :maps="maps"
    :players="players"
    @close="showCalculator = false"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.planner-toolbar {
  display: flex;
  flex: 1;
  align-items: stretch;
  width: 100%;

  @include mobile-lg {
    flex-direction: column;
    gap: $spacing-xs;
    padding: $spacing-xs;
  }
}

.section-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: $spacing-sm $spacing-md;
  min-width: 0;

  @include tablet {
    padding: $spacing-sm 0.75rem;
  }

  @include mobile-lg {
    display: none; // Hide balance messages on mobile
  }
}

.section-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem $spacing-md;
  flex-shrink: 0;

  @include tablet {
    padding: 0.4rem $spacing-sm;
  }

  @include mobile-lg {
    order: 1;
    padding: $spacing-xs;
    width: 100%;
  }

  @include mobile {
    flex-direction: column;
    gap: 0.35rem;
  }
}

.section-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: $spacing-sm $spacing-md;
  min-width: 0;

  @include tablet {
    padding: $spacing-sm 0.75rem;
  }

  @include mobile-lg {
    order: 2;
    justify-content: center;
    padding: $spacing-xs;
  }
}

.btn-calculator {
  width: $touch-target-min;
  height: $touch-target-min;
  border: none;
  background: $color-bg-tertiary;
  border-radius: $radius-md;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: $color-border-light;
    transform: scale(1.05);
  }

  @include mobile-lg {
    width: 36px;
    height: 36px;
  }
}

.calculator-icon {
  width: 100%;
  height: 100%;
  fill: $color-success;
  color: $color-success;

  .btn-calculator:hover & {
    fill: #6ee7a0;
    color: #6ee7a0;
  }
}

.balance-messages {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  font-size: 0.8rem;
  font-weight: 600;
  padding: $spacing-sm 0.75rem;
  border-radius: $radius-sm;
  max-width: 400px;

  &.is-balanced {
    color: $color-success;
    background: rgba($color-success, 0.1);
    border: 1px solid rgba($color-success, 0.3);
  }

  &.is-unbalanced {
    color: $color-danger;
    background: rgba($color-danger, 0.1);
    border: 1px solid rgba($color-danger, 0.3);
  }

  @include tablet {
    font-size: 0.75rem;
    padding: 0.4rem 0.6rem;
    max-width: 300px;
  }
}

.balance-message-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.message-icon {
  flex-shrink: 0;
}

.message-text {
  line-height: 1.3;
}

.cartouches-wrapper {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  @include mobile-lg {
    width: 100%;
  }
}

.reset-wrapper {
  display: flex;
  align-items: center;

  @include mobile {
    position: absolute;
    top: $spacing-xs;
    right: $spacing-xs;
  }
}

.btn-reset {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  @include mobile-lg {
    width: 32px;
    height: 32px;
  }
}

.reset-icon {
  width: 32px;
  height: 32px;
  fill: $color-text-secondary;
  transition: transform 0.3s, fill 0.2s;

  .btn-reset:hover & {
    fill: #fff;
    transform: rotate(90deg);
  }

  @include mobile-lg {
    width: 28px;
    height: 28px;
  }
}

.player-bar {
  display: flex;
  gap: $spacing-sm;
  justify-content: center;

  @include mobile-lg {
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35rem;
  }

  button {
    padding: 0.3rem 0.75rem;
    border: 2px solid #666;
    background: transparent;
    color: #ccc;
    border-radius: $radius-sm;
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: $color-border-light;
      border-color: $color-text-secondary;
      color: #fff;
    }

    &.active {
      background: #4a4a8a;
      border-color: $color-accent;
      color: #fff;
      box-shadow: 0 0 8px rgba(100, 100, 200, 0.3);
    }

    &.highlighted {
      border-color: white;

      &.active {
        background: linear-gradient(135deg, #4a4a8a 0%, rgba($color-success, 0.3) 100%);
        border-color: white;
        color: #fff;
      }
    }

    @include tablet {
      padding: $spacing-xs $spacing-sm;
      font-size: 0.75rem;
    }

    @include mobile-lg {
      padding: 0.3rem $spacing-sm;
      font-size: 0.7rem;
    }

    @include mobile {
      padding: $spacing-xs 0.4rem;
      font-size: 0.65rem;
    }
  }
}

.assignment-bar {
  display: flex;
  gap: $spacing-sm;
  justify-content: center;

  @include mobile-lg {
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35rem;
  }

  button {
    padding: $spacing-xs 0.7rem;
    border: 2px solid var(--assignment-color);
    background: transparent;
    color: var(--assignment-color);
    border-radius: $radius-sm;
    font-weight: 600;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(.disabled) {
      background: color-mix(in srgb, var(--assignment-color) 20%, transparent);
    }

    &.active {
      background: color-mix(in srgb, var(--assignment-color) 30%, transparent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--assignment-color) 40%, transparent);
    }

    &.disabled {
      border-color: #444;
      color: #555;
      cursor: not-allowed;
      opacity: 0.5;
    }

    @include tablet {
      padding: 0.2rem $spacing-sm;
      font-size: 0.7rem;
    }

    @include mobile-lg {
      padding: $spacing-xs 0.45rem;
      font-size: 0.65rem;
    }

    @include mobile {
      padding: $spacing-xs 0.4rem;
      font-size: 0.65rem;
    }
  }
}

.edit-controls {
  display: flex;
  gap: $spacing-sm;

  @include mobile-lg {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.btn-edit,
.btn-save,
.btn-cancel {
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: $radius-sm;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  @include tablet {
    padding: 0.35rem 0.6rem;
    font-size: 0.75rem;
  }

  @include mobile-lg {
    padding: 0.3rem $spacing-sm;
    font-size: 0.7rem;
  }
}

.btn-edit {
  background: $color-bg-tertiary;
  color: #ccc;
  border: 1px solid #444;

  &:hover {
    background: $color-border-light;
  }

  &.active {
    background: $color-danger;
    color: #fff;
    border-color: $color-danger;
  }
}

.btn-save {
  background: #4ecdc4;
  color: $color-bg-secondary;

  &:hover {
    background: #5fd9d0;
  }
}

.btn-cancel {
  background: #666;
  color: #fff;

  &:hover {
    background: $color-text-secondary;
  }
}
</style>

