<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Modal from '@/components/common/Modal.vue';
import RotationCalculator from '@/components/RotationCalculator.vue';
import type {
  EventType,
  CreateEventRequest,
  CalendarEvent,
  MatchGamePlan,
  MapConfig,
  Player,
} from '@shared/types';

const props = defineProps<{
  open: boolean;
  selectedDate?: string; // Pre-fill date
  editEvent?: CalendarEvent; // Event to edit (if editing)
  readOnly?: boolean; // View-only mode (for non-admin users)
  maps?: MapConfig[]; // Maps for RotationCalculator
  players?: Player[]; // Players for RotationCalculator
}>();

const emit = defineEmits<{
  close: [];
  submit: [event: CreateEventRequest];
  delete: [eventId: string];
  'update-gameplan': [eventId: string, gamePlan: MatchGamePlan];
}>();

// Form state
const date = ref('');
const startTime = ref('20:00');
const endTime = ref('22:00');
const type = ref<EventType>('MATCH');
const title = ref('');
const description = ref('');
const gamePlan = ref<MatchGamePlan | null>(null);

// UI state
const showRotationCalculator = ref(false);

// Error message
const error = ref('');

// Reset form when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      error.value = '';
      showRotationCalculator.value = false;
      if (props.editEvent) {
        // Edit/View mode: fill with existing event data
        date.value = props.editEvent.date;
        startTime.value = props.editEvent.startTime;
        endTime.value = props.editEvent.endTime;
        type.value = props.editEvent.type;
        title.value = props.editEvent.title;
        description.value = props.editEvent.description || '';
        gamePlan.value = props.editEvent.gamePlan || null;
      } else {
        // Create mode: reset with defaults
        date.value = props.selectedDate || '';
        startTime.value = '20:00';
        endTime.value = '22:00';
        type.value = 'MATCH';
        title.value = '';
        description.value = '';
        gamePlan.value = null;
      }
    }
  }
);

// Modal title
const modalTitle = computed(() => {
  if (props.readOnly && props.editEvent) {
    return props.editEvent.type === 'MATCH' ? '🎮 Match' : '📅 Événement';
  }
  return props.editEvent ? 'Modifier l\'événement' : 'Créer un événement';
});

// Format date for display (DD/MM/YYYY)
const formattedDate = computed(() => {
  if (!date.value) return '';
  const [year, month, day] = date.value.split('-');
  return `${day}/${month}/${year}`;
});

// Validate and submit
function handleSubmit() {
  error.value = '';

  if (!date.value) {
    error.value = 'Veuillez sélectionner une date';
    return;
  }
  if (!title.value.trim()) {
    error.value = 'Veuillez entrer un titre';
    return;
  }
  if (!startTime.value || !endTime.value) {
    error.value = 'Veuillez renseigner les heures de début et fin';
    return;
  }
  if (startTime.value >= endTime.value) {
    error.value = 'L\'heure de fin doit être après l\'heure de début';
    return;
  }

  const eventData: CreateEventRequest = {
    date: date.value,
    startTime: startTime.value,
    endTime: endTime.value,
    type: type.value,
    title: title.value.trim(),
    description: description.value.trim() || undefined,
  };

  emit('submit', eventData);
}

function handleDelete() {
  if (props.editEvent && confirm('Supprimer cet événement ?')) {
    emit('delete', props.editEvent.id);
  }
}

// Open rotation calculator to set game plan
function openRotationCalculator() {
  showRotationCalculator.value = true;
}

// Handle game plan association from RotationCalculator
function handleGamePlanAssociate(newGamePlan: MatchGamePlan) {
  gamePlan.value = newGamePlan;
  showRotationCalculator.value = false;

  // If editing existing event, emit update immediately
  if (props.editEvent) {
    emit('update-gameplan', props.editEvent.id, newGamePlan);
  }
}

// Check if we can show the game plan button
const canSetGamePlan = computed(() => {
  return type.value === 'MATCH' && props.maps && props.maps.length > 0 && props.players && props.players.length > 0;
});

// Check if there's a game plan to display
const hasGamePlan = computed(() => {
  return gamePlan.value && gamePlan.value.maps && gamePlan.value.maps.length > 0;
});

// Modal size: larger when there's a game plan to display
const modalSize = computed(() => {
  return hasGamePlan.value ? 'lg' : 'sm';
});
</script>

<template>
  <!-- Rotation Calculator Modal -->
  <RotationCalculator
    v-if="showRotationCalculator && maps && players"
    :maps="maps"
    :players="players"
    mode="associate"
    @close="showRotationCalculator = false"
    @associate="handleGamePlanAssociate"
  />

  <Modal :open="open && !showRotationCalculator" :title="modalTitle" :size="modalSize" @close="emit('close')">
    <!-- Read-only view for non-admin users -->
    <div v-if="readOnly && editEvent" class="event-view">
      <div class="event-view-header" :class="editEvent.type === 'MATCH' ? 'type-match' : 'type-event'">
        <span class="event-view-type">{{ editEvent.type === 'MATCH' ? '🎮 Match' : '📅 Événement' }}</span>
      </div>

      <h3 class="event-view-title">{{ title }}</h3>

      <div class="event-view-details">
        <div class="event-view-row">
          <span class="event-view-label">📅 Date</span>
          <span class="event-view-value">{{ formattedDate }}</span>
        </div>
        <div class="event-view-row">
          <span class="event-view-label">🕐 Horaire</span>
          <span class="event-view-value">{{ startTime }} - {{ endTime }}</span>
        </div>
      </div>

      <div v-if="description" class="event-view-description">
        <span class="event-view-label">📝 Description</span>
        <p>{{ description }}</p>
      </div>

      <!-- Game Plan Display (readonly) -->
      <div v-if="hasGamePlan && gamePlan" class="game-plan-view">
        <div class="game-plan-header">
          <span class="event-view-label">🎯 Plan de jeu</span>
          <span class="absent-badge">{{ gamePlan.absentPlayerName }} absent(e)</span>
        </div>
        <div class="game-plan-table">
          <table>
            <thead>
              <tr>
                <th>Map</th>
                <th v-for="map in gamePlan.maps[0]?.assignments" :key="map.visibleplayerId">
                  {{ map.visibleplayerName }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="mapPlan in gamePlan.maps" :key="mapPlan.mapId">
                <td class="map-name">{{ mapPlan.mapName }}</td>
                <td
                  v-for="assignment in mapPlan.assignments"
                  :key="assignment.assignmentId"
                  class="assignment-cell"
                >
                  <span
                    class="assignment-badge"
                    :style="{
                      color: assignment.assignmentColor,
                      borderColor: assignment.assignmentColor
                    }"
                  >
                    {{ assignment.assignmentName }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Edit form for admin users -->
    <form v-else class="event-form" @submit.prevent="handleSubmit">
      <!-- Error message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Event type -->
      <div class="form-group">
        <label class="form-label">Type</label>
        <div class="type-selector">
          <button
            type="button"
            class="type-btn"
            :class="{ active: type === 'MATCH', 'type-match': type === 'MATCH' }"
            @click="type = 'MATCH'"
          >
            🎮 Match
          </button>
          <button
            type="button"
            class="type-btn"
            :class="{ active: type === 'EVENT', 'type-event': type === 'EVENT' }"
            @click="type = 'EVENT'"
          >
            📅 Événement
          </button>
        </div>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label" for="event-date">Date</label>
        <input
          id="event-date"
          v-model="date"
          type="date"
          class="form-input"
          required
        />
      </div>

      <!-- Time range -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="event-start">Début</label>
          <input
            id="event-start"
            v-model="startTime"
            type="time"
            class="form-input"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="event-end">Fin</label>
          <input
            id="event-end"
            v-model="endTime"
            type="time"
            class="form-input"
            required
          />
        </div>
      </div>

      <!-- Title -->
      <div class="form-group">
        <label class="form-label" for="event-title">Titre</label>
        <input
          id="event-title"
          v-model="title"
          type="text"
          class="form-input"
          placeholder="Ex: Match vs TeamX"
          required
        />
      </div>

      <!-- Description -->
      <div class="form-group">
        <label class="form-label" for="event-desc">Description (optionnel)</label>
        <textarea
          id="event-desc"
          v-model="description"
          class="form-input form-textarea"
          rows="3"
          placeholder="Détails supplémentaires..."
        ></textarea>
      </div>

      <!-- Game Plan (only for MATCH type) -->
      <div v-if="canSetGamePlan" class="form-group">
        <label class="form-label">🎯 Plan de jeu</label>

        <!-- Game plan visualization if set (same as readonly view, with modify button) -->
        <div v-if="hasGamePlan && gamePlan" class="game-plan-view game-plan-edit">
          <div class="game-plan-header">
            <span class="absent-badge">{{ gamePlan.absentPlayerName }} absent(e)</span>
            <button type="button" class="btn-change-plan" @click="openRotationCalculator">
              ✏️ Modifier
            </button>
          </div>
          <div class="game-plan-table">
            <table>
              <thead>
                <tr>
                  <th>Map</th>
                  <th v-for="assignment in gamePlan.maps[0]?.assignments" :key="assignment.visibleplayerId">
                    {{ assignment.visibleplayerName }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="mapPlan in gamePlan.maps" :key="mapPlan.mapId">
                  <td class="map-name">{{ mapPlan.mapName }}</td>
                  <td
                    v-for="assignment in mapPlan.assignments"
                    :key="assignment.assignmentId"
                    class="assignment-cell"
                  >
                    <span
                      class="assignment-badge"
                      :style="{
                        color: assignment.assignmentColor,
                        borderColor: assignment.assignmentColor
                      }"
                    >
                      {{ assignment.assignmentName }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Button to open rotation calculator if no plan yet -->
        <button
          v-else
          type="button"
          class="btn-set-gameplan"
          @click="openRotationCalculator"
        >
          📋 Définir le plan de jeu
        </button>
      </div>
    </form>

    <template #footer>
      <!-- Read-only mode: only close button -->
      <template v-if="readOnly">
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          Fermer
        </button>
      </template>

      <!-- Edit mode: full controls -->
      <template v-else>
        <button
          v-if="editEvent"
          type="button"
          class="btn btn-danger"
          @click="handleDelete"
        >
          Supprimer
        </button>
        <div class="spacer"></div>
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          Annuler
        </button>
        <button type="button" class="btn btn-primary" @click="handleSubmit">
          {{ editEvent ? 'Enregistrer' : 'Créer' }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.event-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-message {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid #f87171;
  color: #fca5a5;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #aaa;
}

.form-input {
  padding: 0.75rem;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  border-radius: 6px;
  color: #fff;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #7a7aba;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

/* Type selector */
.type-selector {
  display: flex;
  gap: 0.5rem;
}

.type-btn {
  flex: 1;
  padding: 0.75rem;
  background: #2a2a4a;
  border: 2px solid #3a3a5a;
  border-radius: 8px;
  color: #888;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn:hover {
  background: #3a3a5a;
}

.type-btn.active.type-match {
  background: rgba(251, 146, 60, 0.2);
  border-color: #fb923c;
  color: #fdba74;
}

.type-btn.active.type-event {
  background: rgba(96, 165, 250, 0.2);
  border-color: #60a5fa;
  color: #93c5fd;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #7a7aba;
  color: #fff;
}

.btn-primary:hover {
  background: #9a9ada;
}

.btn-secondary {
  background: #3a3a5a;
  color: #ccc;
}

.btn-secondary:hover {
  background: #4a4a6a;
}

.btn-danger {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
  border: 1px solid #f87171;
}

.btn-danger:hover {
  background: rgba(248, 113, 113, 0.3);
}

.spacer {
  flex: 1;
}

/* Read-only event view */
.event-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.event-view-header {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  text-align: center;
}

.event-view-header.type-match {
  background: rgba(251, 146, 60, 0.2);
  color: #fdba74;
}

.event-view-header.type-event {
  background: rgba(96, 165, 250, 0.2);
  color: #93c5fd;
}

.event-view-title {
  margin: 0;
  font-size: 1.25rem;
  color: #fff;
  text-align: center;
}

.event-view-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(42, 42, 74, 0.5);
  border-radius: 8px;
}

.event-view-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-view-label {
  color: #888;
  font-size: 0.9rem;
}

.event-view-value {
  color: #fff;
  font-weight: 500;
}

.event-view-description {
  padding: 1rem;
  background: rgba(42, 42, 74, 0.5);
  border-radius: 8px;
}

.event-view-description .event-view-label {
  display: block;
  margin-bottom: 0.5rem;
}

.event-view-description p {
  margin: 0;
  color: #ccc;
  white-space: pre-wrap;
}

/* Game Plan View (readonly) */
.game-plan-view {
  padding: 1rem;
  background: rgba(42, 42, 74, 0.5);
  border-radius: 8px;
}

.game-plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.absent-badge {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.game-plan-table {
  overflow-x: auto;
}

.game-plan-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.game-plan-table th,
.game-plan-table td {
  padding: 0.5rem;
  text-align: center;
  border-bottom: 1px solid #3a3a5a;
}

.game-plan-table th {
  color: #888;
  font-weight: 600;
}

.game-plan-table .map-name {
  text-align: left;
  color: #fff;
  font-weight: 500;
}

.assignment-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border: 1px solid;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Game Plan Edit (admin form) */
.game-plan-edit {
  border: 1px solid #3a3a5a;
}

.game-plan-edit .game-plan-header {
  border-bottom: 1px solid #3a3a5a;
  padding-bottom: 0.75rem;
  margin-bottom: 0.75rem;
}

.btn-change-plan {
  padding: 0.4rem 0.75rem;
  background: #3a3a5a;
  border: 1px solid #4a4a6a;
  border-radius: 4px;
  color: #ccc;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-change-plan:hover {
  background: #4a4a6a;
  color: #fff;
}

.btn-set-gameplan {
  width: 100%;
  padding: 0.75rem;
  background: rgba(251, 146, 60, 0.2);
  border: 2px dashed #fb923c;
  border-radius: 8px;
  color: #fdba74;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-set-gameplan:hover {
  background: rgba(251, 146, 60, 0.3);
  border-style: solid;
}
</style>

