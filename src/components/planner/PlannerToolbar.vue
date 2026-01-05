<script setup lang="ts">
import { computed, ref } from 'vue';
import { assignmentColors, checkMapBalance, getPlayerAssignments, getAssignmentPlayers } from '../../data/config';
import type { MapConfig, Player } from '../../types';
import RotationCalculator from '../RotationCalculator.vue';

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
      <svg viewBox="0 0 24 24" class="calculator-icon">
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
        <path d="M7 12l1.5-1.5M8.5 10.5L7 9M7 9l1.5 1.5M8.5 10.5L7 12" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M7 17l1.5-1.5M8.5 15.5L7 14M7 14l1.5 1.5M8.5 15.5L7 17" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M16 12l1.5-1.5M17.5 10.5L16 9M16 9l1.5 1.5M17.5 10.5L16 12" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M16 17l1.5-1.5M17.5 15.5L16 14M16 14l1.5 1.5M17.5 15.5L16 17" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <circle cx="12" cy="10" r="1.5"/>
        <circle cx="12" cy="15" r="1.5"/>
        <path d="M10 11.5l-1.5 1.5M14 11.5l1.5 1.5" stroke="currentColor" stroke-width="1" fill="none"/>
      </svg>
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
        <svg viewBox="0 0 24 24" class="reset-icon">
          <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
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

<style scoped>
.planner-toolbar {
  display: flex;
  flex: 1;
  align-items: stretch;
  width: 100%;
}

.section-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  min-width: 0;
}

.section-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 1rem;
  flex-shrink: 0;
}

.section-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
  min-width: 0;
}

.btn-calculator {
  width: 44px;
  height: 44px;
  border: none;
  background: #2a2a4a;
  border-radius: 8px;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-calculator:hover {
  background: #3a3a5a;
  transform: scale(1.05);
}

.calculator-icon {
  width: 100%;
  height: 100%;
  fill: #4ade80;
  color: #4ade80;
}

.btn-calculator:hover .calculator-icon {
  fill: #6ee7a0;
  color: #6ee7a0;
}

.balance-messages {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  max-width: 400px;
}

.balance-message-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.message-icon {
  flex-shrink: 0;
}

.message-text {
  line-height: 1.3;
}

.balance-messages.is-balanced {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.balance-messages.is-unbalanced {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
}


.cartouches-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reset-wrapper {
  display: flex;
  align-items: center;
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
}

.reset-icon {
  width: 32px;
  height: 32px;
  fill: #888;
  transition: transform 0.3s, fill 0.2s;
}

.btn-reset:hover .reset-icon {
  fill: #fff;
  transform: rotate(90deg);
}


/* Joueurs */
.player-bar {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.player-bar button {
  padding: 0.3rem 0.75rem;
  border: 2px solid #666;
  background: transparent;
  color: #ccc;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.player-bar button:hover {
  background: #3a3a5a;
  border-color: #888;
  color: #fff;
}

.player-bar button.active {
  background: #4a4a8a;
  border-color: #7a7aba;
  color: #fff;
  box-shadow: 0 0 8px rgba(100, 100, 200, 0.3);
}

.player-bar button.highlighted {
  border-color: white;
}

.player-bar button.highlighted.active {
  background: linear-gradient(135deg, #4a4a8a 0%, rgba(74, 222, 128, 0.3) 100%);
  border-color: white;
  color: #fff;
}

/* Postes */
.assignment-bar {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.assignment-bar button {
  padding: 0.25rem 0.7rem;
  border: 2px solid var(--assignment-color);
  background: transparent;
  color: var(--assignment-color);
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.assignment-bar button:hover:not(.disabled) {
  background: color-mix(in srgb, var(--assignment-color) 20%, transparent);
}

.assignment-bar button.active {
  background: color-mix(in srgb, var(--assignment-color) 30%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--assignment-color) 40%, transparent);
}

.assignment-bar button.disabled {
  border-color: #444;
  color: #555;
  cursor: not-allowed;
  opacity: 0.5;
}

/* Edit buttons */
.edit-controls {
  display: flex;
  gap: 0.5rem;
}

.btn-edit, .btn-save, .btn-cancel {
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit {
  background: #2a2a4a;
  color: #ccc;
  border: 1px solid #444;
}

.btn-edit:hover {
  background: #3a3a5a;
}

.btn-edit.active {
  background: #ff6b6b;
  color: #fff;
  border-color: #ff6b6b;
}

.btn-save {
  background: #4ecdc4;
  color: #1a1a2e;
}

.btn-save:hover {
  background: #5fd9d0;
}

.btn-cancel {
  background: #666;
  color: #fff;
}

.btn-cancel:hover {
  background: #888;
}
</style>

