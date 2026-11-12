<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import RotationCalculatorModal from '@/components/common/rotation/RotationCalculatorModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import EventTypeSelector from '@/components/calendar/EventTypeSelector.vue';
import EventGamePlanField from '@/components/calendar/EventGamePlanField.vue';
import { useErrors } from '@/composables/useErrors';
import { useEventPlace } from '@/composables/useEventPlace';
import { ERROR, PLANNER_ENABLED } from '@shared/constants';
import { VOICE_MEDIUMS } from '@shared/types';
import { formatVenuePlace } from '@shared/utils';
import { getVoiceMediumLabel } from '@/utils/calendar';
import { formatVenueLabel } from '@/utils/venues';
import type {
  EventType,
  CreateEventRequest,
  CalendarEvent,
  MatchGamePlan,
  MapConfig,
  Player,
  Venue,
  VoiceMedium,
} from '@shared/types';

// Creates an event of the team or changes one: the calendar opens it only for
// a reader who may, an event being read on its sheet (EventViewerModal)
const props = defineProps<{
  open: boolean;
  selectedDate?: string; // Pre-fill date
  editEvent?: CalendarEvent; // Event to edit (if editing)
  canDelete?: boolean; // Can delete events
  canAttachGamePlan?: boolean; // Can attach game plan to match
  maps?: MapConfig[]; // Maps for RotationCalculator
  players?: Player[]; // Players for RotationCalculator
  venues?: Venue[]; // Venues a match can be played in
  teamVenueId?: string | null; // Venue the team is affiliated with: default for a new match
}>();

const emit = defineEmits<{
  close: [];
  submit: [event: CreateEventRequest];
  delete: [eventId: string];
  'update-gameplan': [eventId: string, gamePlan: MatchGamePlan];
}>();

// Teams meet on Discord far more than on anything else, so that is where a
// new voice meeting starts
const DEFAULT_VOICE_MEDIUM: VoiceMedium = 'DISCORD';

// Form state
const date = ref('');
const startTime = ref('20:00');
const endTime = ref('22:00');
const type = ref<EventType>('MATCH');
const title = ref('');
const description = ref('');
const voiceMedium = ref<VoiceMedium>(DEFAULT_VOICE_MEDIUM);
const gamePlan = ref<MatchGamePlan | null>(null);

// Only a match is played somewhere
const showVenue = computed(() => type.value === 'MATCH');

// Only a voice meeting is held on a platform
const showMedium = computed(() => type.value === 'VOICE_MEETING');

// Where the match is played: venue, arena and slots, the slots setting its hours
const { venueId, arenaNumber, evaSlotIds, arenaNumbers, showSlotPicker, slotStatus, usesSlots, applySlots, dropArena, resetPlace } =
  useEventPlace({ venues: () => props.venues, isMatch: showVenue, date, startTime, endTime });

// UI state
const showRotationCalculator = ref(false);
const showDeleteConfirm = ref(false);

// Error handling
const { errors, setError, addError, clearErrors, hasErrors } = useErrors();

// A match the matchmaking made keeps the time and place both teams agreed on,
// and is called off from its sheet, not deleted on one side
const isMatchmakingMatch = computed(() => !!props.editEvent?.scrimSearchId);

const canShowDeleteButton = computed(() => props.canDelete && props.editEvent && !isMatchmakingMatch.value);

// Reset form when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    clearErrors();
    showRotationCalculator.value = false;
    const event = props.editEvent;
    if (event) {
      // Edit mode: fill with existing event data
      date.value = event.date;
      startTime.value = event.startTime;
      endTime.value = event.endTime;
      type.value = event.type;
      title.value = event.title;
      description.value = event.description || '';
      voiceMedium.value = event.voiceMedium ?? DEFAULT_VOICE_MEDIUM;
      gamePlan.value = event.gamePlan || null;
      resetPlace({ venueId: event.venue?.id ?? null, arenaNumber: event.arenaNumber ?? null, evaSlotIds: event.evaSlotIds });
    } else {
      // Create mode: reset with defaults
      date.value = props.selectedDate || '';
      startTime.value = '20:00';
      endTime.value = '22:00';
      type.value = 'MATCH';
      title.value = '';
      description.value = '';
      voiceMedium.value = DEFAULT_VOICE_MEDIUM;
      gamePlan.value = null;
      resetPlace({ venueId: props.teamVenueId ?? null, arenaNumber: null, evaSlotIds: [] });
    }
  }
);

const modalTitle = computed(() => (props.editEvent ? 'Modifier l\'événement' : 'Créer un événement'));

// An event turned into a match starts from the team's venue, like a new match does
watch(type, (newType) => {
  if (newType === 'MATCH' && venueId.value === null) {
    venueId.value = props.teamVenueId ?? null;
  }
});

// Venue of the event being changed, for the fixed place of a match of the matchmaking
const eventVenueLabel = computed(() => {
  const venue = props.editEvent?.venue;
  if (!venue) return null;
  const arena = props.editEvent?.arenaNumber;
  return formatVenuePlace(formatVenueLabel(venue), arena);
});

// Format date for display (DD/MM/YYYY)
const formattedDate = computed(() => {
  if (!date.value) return '';
  const [year, month, day] = date.value.split('-');
  return `${day}/${month}/${year}`;
});

// Validate and submit
function handleSubmit() {
  clearErrors();

  if (!date.value) {
    addError(ERROR.eventDateRequired);
  }
  if (!title.value.trim()) {
    addError(ERROR.eventTitleRequired);
  }
  if (usesSlots.value && !evaSlotIds.value.length) {
    addError(ERROR.eventSlotRequired);
  } else if (!startTime.value || !endTime.value) {
    addError(ERROR.eventTimeRequired);
  } else if (startTime.value >= endTime.value) {
    addError(ERROR.eventTimeInvalid);
  }

  if (hasErrors()) {
    return;
  }

  const eventData: CreateEventRequest = {
    date: date.value,
    startTime: startTime.value,
    endTime: endTime.value,
    type: type.value,
    title: title.value.trim(),
    // Always sent, empty included: that is how clearing it reaches the server
    description: description.value.trim(),
    venueId: showVenue.value ? venueId.value : null,
    arenaNumber: showVenue.value ? arenaNumber.value : null,
    evaSlotIds: showVenue.value ? evaSlotIds.value : [],
    voiceMedium: showMedium.value ? voiceMedium.value : null,
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
  return PLANNER_ENABLED && props.canAttachGamePlan && type.value === 'MATCH' && props.maps && props.maps.length > 0 && props.players && props.players.length > 0;
});

// Check if there's a game plan to display
const hasGamePlan = computed(() => {
  return PLANNER_ENABLED && gamePlan.value && gamePlan.value.maps && gamePlan.value.maps.length > 0;
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
    <form class="event-form" @submit.prevent="handleSubmit">
      <!-- Error message -->
      <ErrorDisplay :errors="errors" />

      <!-- A match of the matchmaking: its time and place, fixed -->
      <div v-if="isMatchmakingMatch" class="form-group matchmaking-place">
        <span class="form-label">Match du matchmaking</span>
        <p class="matchmaking-place-value">{{ eventVenueLabel ?? 'Salle non définie' }} · {{ formattedDate }} · {{ startTime }} – {{ endTime }}</p>
        <p class="form-hint">Son heure et son lieu ne changent pas : pour en convenir d'autres, annule-le depuis sa fiche.</p>
      </div>

      <!-- Event type -->
      <div v-if="!isMatchmakingMatch" class="form-group">
        <label class="form-label">Type</label>
        <EventTypeSelector v-model="type" />
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

      <!-- Venue (only for MATCH type) -->
      <div v-if="showVenue && !isMatchmakingMatch" class="form-group">
        <label class="form-label" for="event-venue">📍 Salle</label>
        <select id="event-venue" v-model="venueId" class="form-input form-select" @change="dropArena">
          <option :value="null">Non définie</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">
            {{ formatVenueLabel(venue) }}
          </option>
        </select>
      </div>

      <!-- Arena (only when the venue runs several and no slot names it) -->
      <div v-if="showVenue && arenaNumbers.length && !usesSlots && !isMatchmakingMatch" class="form-group">
        <label class="form-label" for="event-arena">🏟️ Arène</label>
        <select id="event-arena" v-model="arenaNumber" class="form-input form-select">
          <option :value="null">Non définie</option>
          <option v-for="number in arenaNumbers" :key="number" :value="number">
            Arène {{ number }}
          </option>
        </select>
      </div>

      <!-- Date -->
      <div v-if="!isMatchmakingMatch" class="form-group">
        <label class="form-label" for="event-date">Date</label>
        <input
          id="event-date"
          v-model="date"
          type="date"
          class="form-input"
          required
        />
      </div>

      <!-- Slots of the venue (only when its slots are listed) -->
      <VenueSlotPicker
        v-if="showSlotPicker && !isMatchmakingMatch"
        :venue-id="venueId"
        :date="date"
        :model-value="evaSlotIds"
        :current-start-time="startTime"
        :current-end-time="endTime"
        @select="applySlots"
        @status="slotStatus = $event"
      />

      <!-- Time range, typed by hand only when no slot grid gives it -->
      <div v-if="!usesSlots && !isMatchmakingMatch" class="form-row">
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

      <!-- Platform (only for VOICE_MEETING type) -->
      <div v-if="showMedium" class="form-group">
        <label class="form-label" for="event-medium">🎙️ Plateforme</label>
        <select id="event-medium" v-model="voiceMedium" class="form-input form-select">
          <option v-for="medium in VOICE_MEDIUMS" :key="medium" :value="medium">
            {{ getVoiceMediumLabel(medium) }}
          </option>
        </select>
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
        <EventGamePlanField :game-plan="hasGamePlan ? gamePlan : null" @edit="openRotationCalculator" @error="setError" />
      </div>
    </form>

    <template #footer>
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
@use '@/styles/forms' as *;

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
  @include form-label;
}

.form-input {
  @include form-input;
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
  border: $border-thin solid $color-danger;

  &:hover {
    background: tint($color-danger, 5%);
  }
}

.spacer {
  flex: 1;
}

// A match of the matchmaking: its time and place, read only
.matchmaking-place-value {
  margin: 0;
  color: $color-white;
  font-weight: 600;
}

.form-hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.8rem;
}
</style>
