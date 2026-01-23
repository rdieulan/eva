<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import RotationCalculatorModal from '@/components/common/rotation/RotationCalculatorModal.vue';
import GamePlanViewer from '@/components/common/GamePlanViewer.vue';
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
  canCreate?: boolean; // Can create events
  canEdit?: boolean; // Can edit events
  canDelete?: boolean; // Can delete events
  canAttachGamePlan?: boolean; // Can attach game plan to match
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
const showDeleteConfirm = ref(false);

// Error message
const error = ref('');

// Computed permissions
const isViewOnly = computed(() => {
  // View-only if editing an event but no edit permission
  if (props.editEvent && !props.canEdit) return true;
  // View-only if creating but no create permission
  if (!props.editEvent && !props.canCreate) return true;
  return false;
});

const canShowDeleteButton = computed(() => props.canDelete && props.editEvent);

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
  if (isViewOnly.value && props.editEvent) {
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
  showDeleteConfirm.value = true;
}

function confirmDelete() {
  if (props.editEvent) {
    emit('delete', props.editEvent.id);
    showDeleteConfirm.value = false;
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
  return props.canAttachGamePlan && type.value === 'MATCH' && props.maps && props.maps.length > 0 && props.players && props.players.length > 0;
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
  <RotationCalculatorModal
    :open="showRotationCalculator && !!maps && !!players"
    :maps="maps!"
    :players="players!"
    :initialGamePlan="gamePlan"
    mode="associate"
    @close="showRotationCalculator = false"
    @associate="handleGamePlanAssociate"
  />

  <Modal :open="open && !showRotationCalculator" :title="modalTitle" :size="modalSize" @close="emit('close')">
    <!-- Read-only view for non-admin users -->
    <div v-if="isViewOnly && editEvent" class="event-view">
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

      <!-- Game Plan Display (readonly) - with export -->
      <GamePlanViewer
        v-if="hasGamePlan && gamePlan"
        :gamePlan="gamePlan"
      />
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

        <!-- Game plan visualization if set (with modify button) -->
        <div v-if="hasGamePlan && gamePlan" class="game-plan-edit">
          <button type="button" class="btn-change-plan" @click="openRotationCalculator">
            ✏️ Modifier le plan
          </button>
          <GamePlanViewer :gamePlan="gamePlan" />
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
      <template v-if="isViewOnly">
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          Fermer
        </button>
      </template>

      <!-- Edit mode: full controls -->
      <template v-else>
        <button
          v-if="canShowDeleteButton"
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

  <!-- Delete Confirmation Modal -->
  <ConfirmModal
    :open="showDeleteConfirm"
    title="Supprimer l'événement"
    :message="`Êtes-vous sûr de vouloir supprimer l'événement « ${editEvent?.title || ''} » ?`"
    :danger="true"
    @confirm="confirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use 'sass:color';

.event-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;

  @include tablet {
    gap: 0.875rem;
  }

  @include mobile-lg {
    gap: 0.75rem;
  }
}

.error-message {
  background: rgba($color-danger, 0.2);
  border: 1px solid $color-danger;
  color: $color-danger;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.form-row {
  display: flex;
  gap: $spacing-md;

  .form-group {
    flex: 1;
  }

  @include tablet {
    gap: 0.75rem;
  }

  @include mobile-lg {
    flex-direction: column;
    gap: 0.75rem;
  }
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: $color-text-secondary;

  @include mobile {
    font-size: 0.8rem;
  }
}

.form-input {
  padding: 0.75rem;
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: 6px;
  color: $color-white;
  font-size: 0.95rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: $color-accent;
  }

  @include mobile-lg {
    font-size: 16px; // Prevents zoom on iOS
  }
}

.form-textarea {
  resize: vertical;
  min-height: 80px;

  @include mobile-lg {
    font-size: 16px;
  }
}

.form-select {
  @include mobile-lg {
    font-size: 16px;
  }
}

.type-selector {
  display: flex;
  gap: $spacing-sm;

  @include mobile-lg {
    gap: $spacing-sm;
  }
}

.type-btn {
  flex: 1;
  padding: 0.75rem;
  background: $color-bg-tertiary;
  border: 2px solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
  }

  &.active.type-match {
    background: rgba($color-warning, 0.2);
    border-color: $color-warning;
    color: $color-warning;
  }

  &.active.type-event {
    background: rgba($color-info, 0.2);
    border-color: $color-info;
    color: $color-info;
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

.btn {
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  @include tablet {
    padding: 0.625rem $spacing-md;
    font-size: 0.85rem;
  }

  @include mobile-lg {
    padding: 0.625rem 0.875rem;
    font-size: 0.85rem;
  }
}

.btn-primary {
  background: $color-accent;
  color: $color-white;

  &:hover {
    background: $color-accent;
  }
}

.btn-secondary {
  background: $color-border-light;
  color: $color-text-muted;

  &:hover {
    background: $color-bg-tertiary;
  }
}

.btn-danger {
  background: $color-danger;
  color: white;
  border: 1px solid $color-danger;

  &:hover {
    background: color.adjust($color-danger, $lightness: 5%);
  }
}

.spacer {
  flex: 1;
}

.event-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.event-view-header {
  padding: $spacing-sm $spacing-md;
  border-radius: 6px;
  font-weight: 600;
  text-align: center;

  &.type-match {
    background: rgba($color-warning, 0.2);
    color: $color-warning;
  }

  &.type-event {
    background: rgba($color-info, 0.2);
    color: $color-info;
  }
}

.event-view-title {
  margin: 0;
  font-size: 1.25rem;
  color: $color-white;
  text-align: center;

  @include mobile-lg {
    font-size: 1.1rem;
  }
}

.event-view-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: $spacing-md;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;

  @include mobile {
    padding: 0.75rem;
  }
}

.event-view-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  @include mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
  }
}

.event-view-label {
  color: $color-text-secondary;
  font-size: 0.9rem;
}

.event-view-value {
  color: $color-white;
  font-weight: 500;
}

.event-view-description {
  padding: $spacing-md;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;

  .event-view-label {
    display: block;
    margin-bottom: $spacing-sm;
  }

  p {
    margin: 0;
    color: $color-text-muted;
    white-space: pre-wrap;
  }
}

.game-plan-view {
  padding: $spacing-md;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;

  @include mobile-lg {
    padding: 0.75rem;
  }
}

.game-plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  @include mobile-lg {
    flex-direction: column;
    gap: $spacing-sm;
    align-items: flex-start;
  }
}

.phase-selector-centered {
  display: flex;
  justify-content: center;
  margin-bottom: $spacing-md;
}

.absent-badge {
  background: rgba($color-danger, 0.2);
  color: $color-danger;
  padding: $spacing-xs 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;

  @include mobile {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
  }
}

.game-plan-edit {
  border: 1px solid $color-border-light;

  .game-plan-header {
    border-bottom: 1px solid $color-border-light;
    padding-bottom: 0.75rem;
    margin-bottom: 0.75rem;
  }
}

.btn-change-plan {
  padding: 0.4rem 0.75rem;
  background: $color-border-light;
  border: 1px solid $color-bg-tertiary;
  border-radius: $radius-sm;
  color: $color-text-muted;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-bg-tertiary;
    color: $color-white;
  }

  @include mobile {
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
  }
}

.btn-set-gameplan {
  width: 100%;
  padding: 0.75rem;
  background: rgba($color-warning, 0.2);
  border: 2px dashed $color-warning;
  border-radius: $radius-md;
  color: $color-warning;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba($color-warning, 0.3);
    border-style: solid;
  }

  @include mobile-lg {
    padding: 0.625rem;
    font-size: 0.85rem;
  }
}
</style>
