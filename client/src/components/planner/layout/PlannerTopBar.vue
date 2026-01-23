<script setup lang="ts">
import { computed, ref } from 'vue';
import { getAssignmentColor } from '@/utils/colors';
import { checkMapBalance, getPlayerAssignments, getPlayerMainAssignment, getAssignmentPlayers } from '@/utils/balance';
import type { MapConfig, Player, GamePhase, GamePlanSummary } from '@/types';
import RotationCalculatorModal from '@/components/common/rotation/RotationCalculatorModal.vue';
import PhaseSelector from '@/components/planner/PhaseSelector.vue';
import PlanSelector from '@/components/planner/PlanSelector.vue';

const props = defineProps<{
  players: Player[];
  selectedPlayerId: string | null;
  map: MapConfig | null;
  maps: MapConfig[];
  activeAssignments: number[];
  editMode: boolean;
  isLoading: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  // Phase section props
  currentPhase: GamePhase;
  plans: GamePlanSummary[];
  selectedPlanId: string | null;
}>();

const showCalculator = ref(false);

const emit = defineEmits<{
  'select-player': [playerId: string | null];
  'toggle-assignment': [assignmentId: number];
  // Phase section events
  'update:currentPhase': [phase: GamePhase];
  'select-plan': [planId: string];
  'create-plan': [];
  'duplicate-plan': [planId: string];
  'delete-plan': [planId: string];
  'rename-plan': [planId: string, newName: string];
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


// Check if a player is highlighted (associated to selected assignment)
function isPlayerHighlighted(playerId: string): boolean {
  if (props.activeAssignments.length === 0 || !props.map) return false;
  const selectedAssignmentId = props.activeAssignments[0] as number;
  const assignedPlayers = getAssignmentPlayers(props.map, selectedAssignmentId);
  return assignedPlayers.includes(playerId);
}

// Check if an assignment is the main role for selected player
function isMainRoleForSelectedPlayer(assignmentId: number): boolean {
  if (!props.selectedPlayerId || !props.map) return false;
  return getPlayerMainAssignment(props.map, props.selectedPlayerId) === assignmentId;
}
</script>

<template>
  <div class="planner-toolbar">
    <!-- Section 1: Phase -->
    <div class="section section-phase">
      <PlanSelector
        v-if="plans.length > 0"
        :plans="plans"
        :selectedPlanId="selectedPlanId"
        :canCreate="canCreate"
        :canEdit="canEdit"
        :canDelete="canDelete"
        @select="$emit('select-plan', $event)"
        @create="$emit('create-plan')"
        @duplicate="$emit('duplicate-plan', $event)"
        @delete="$emit('delete-plan', $event)"
        @rename="(id, name) => $emit('rename-plan', id, name)"
      />
      <PhaseSelector
        :modelValue="currentPhase"
        @update:modelValue="$emit('update:currentPhase', $event)"
      />
    </div>

    <!-- Section 2: Roles/Effectifs -->
    <div class="section section-roles">
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

      <nav class="assignment-bar">
        <button
          v-for="assignment in assignments"
          :key="assignment.id"
          :class="{
            active: isAssignmentActive(assignment.id),
            disabled: !isAssignmentAssociated(assignment.id),
            'main-role': isMainRoleForSelectedPlayer(assignment.id)
          }"
          :style="{ '--assignment-color': getAssignmentColor(assignment.id) }"
          :disabled="!isAssignmentAssociated(assignment.id)"
          @click="toggleAssignment(assignment.id)"
        >
          <span class="main-star" v-if="isMainRoleForSelectedPlayer(assignment.id)">★</span>
          {{ assignment.name }}
        </button>
      </nav>
    </div>

    <!-- Section 3: Calculator -->
    <div class="section section-calculator">
      <button
        class="btn-calculator"
        @click="showCalculator = true"
        title="Ouvrir le calculateur de rotation"
      >
        <span class="calculator-emoji">🔄</span>
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

    <!-- Rotation calculator modal -->
    <RotationCalculatorModal
      :open="showCalculator"
      :maps="maps"
      :players="players"
      @close="showCalculator = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.planner-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: $spacing-md;
  padding: 0 $spacing-md;

  @include mobile-lg {
    flex-wrap: wrap;
    gap: $spacing-sm;
    justify-content: center;
    padding: 0 $spacing-sm;
  }
}

.section {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

// Section 1: Calculator
.section-calculator {
  @include mobile-lg {
    display: none;
  }
}

// Section 2: Roles
.section-roles {
  flex-direction: column;
  gap: $spacing-xs;

  @include mobile {
    gap: 0.35rem;
  }
}

// Section 3: Phase
.section-phase {
  gap: $spacing-sm;
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
    fill: $color-success;
    color: $color-success;
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
    border: 2px solid $color-border;
    background: transparent;
    color: $color-text-muted;
    border-radius: $radius-sm;
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: $color-border-light;
      border-color: $color-text-secondary;
      color: $color-white;
    }

    &.active {
      background: rgba($color-accent, 0.4);
      border-color: $color-accent;
      color: $color-white;
      box-shadow: 0 0 8px rgba($color-accent, 0.3);
    }

    &.highlighted {
      border-color: white;

      &.active {
        background: linear-gradient(135deg, rgba($color-accent, 0.4) 0%, rgba($color-success, 0.3) 100%);
        border-color: white;
        color: $color-white;
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
      border-color: $color-border;
      color: $color-text-secondary;
      cursor: not-allowed;
      opacity: 0.5;
    }

    &.main-role {
      background: color-mix(in srgb, var(--assignment-color) 25%, transparent);
      box-shadow: 0 0 6px color-mix(in srgb, var(--assignment-color) 30%, transparent);
    }

    .main-star {
      margin-right: 0.2rem;
      font-size: 0.8em;
      color: $color-star;
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
</style>

