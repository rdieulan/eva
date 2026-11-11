<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import GamePlanViewer from '@/components/common/GamePlanViewer.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import SvgIcon from '@/components/common/SvgIcon.vue';
import EventSheet from '@/components/calendar/EventSheet.vue';
import { useErrors } from '@/composables/useErrors';
import { useVenueSlots } from '@/composables/useVenueSlots';
import { cancelScrimMatch } from '@/api';
import type { CalendarEvent } from '@shared/types';
import {
  getEventTypeClass,
  getEventTypeTitle,
  getVoiceMediumLabel,
  isPastDateStr,
} from '@/utils/calendar';
import { formatVenueLabel } from '@/utils/venues';
import { buildEvaBookingUrl, assessSlotHeadcount, formatVenuePlace } from '@shared/utils';
import { ERROR, PLANNER_ENABLED } from '@shared/constants';

const props = defineProps<{
  events: CalendarEvent[];
  initialIndex?: number;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCancelMatch?: boolean; // May call off a match the matchmaking made
  selectedDate?: string;
}>();

const emit = defineEmits<{
  close: [];
  'edit-event': [event: CalendarEvent];
  'create-event': [date: string];
  'delete-event': [eventId: string];
  'match-cancelled': []; // A match of the matchmaking called off: both calendars lost it
}>();

// Error handling
const { errors, setError, setErrorFromException, clearErrors } = useErrors();

// Current event index
const currentIndex = ref(props.initialIndex ?? 0);

// Reset index when events change
watch(() => props.events, () => {
  currentIndex.value = props.initialIndex ?? 0;
}, { immediate: true });

// Current event
const currentEvent = computed(() => props.events[currentIndex.value] ?? null);

// Check if current event is in the past
const isEventPast = computed(() => {
  if (!currentEvent.value) return false;
  return isPastDateStr(currentEvent.value.date);
});

// Permissions - check if not past date
const canEditEvent = computed(() => props.canEdit && !isEventPast.value);
const canCreateEvent = computed(() => props.canCreate && !isEventPast.value);

// A match the matchmaking made is called off, from either team, rather than
// deleted on one side: both calendars lose it
const canCancelMatch = computed(() => !!currentEvent.value?.scrimSearchId && props.canCancelMatch && !isEventPast.value);
const confirmCancel = ref(false);
const isCancelling = ref(false);

async function cancelMatch() {
  confirmCancel.value = false;
  const event = currentEvent.value;
  if (!event || isCancelling.value) return;
  isCancelling.value = true;
  clearErrors();
  try {
    await cancelScrimMatch(event.id);
    emit('match-cancelled');
  } catch (error) {
    setErrorFromException(error, ERROR.scrimMatchCancelFailed);
  } finally {
    isCancelling.value = false;
  }
}

// Navigation
const hasPrev = computed(() => currentIndex.value > 0);
const hasNext = computed(() => currentIndex.value < props.events.length - 1);

function goToPrev() {
  if (hasPrev.value) {
    currentIndex.value--;
  }
}

function goToNext() {
  if (hasNext.value) {
    currentIndex.value++;
  }
}



// Where the match is played, once the event is a match
// How many players eva.gg has on the slots of this match. It tells us the
// count, never the names, so this shows whether seats are missing, not who.
const { slots: venueSlots, status: slotsStatus } = useVenueSlots({
  venueId: computed(() => currentEvent.value?.venue?.id ?? null),
  date: computed(() => currentEvent.value?.date ?? ''),
  enabled: computed(() => !!currentEvent.value?.evaSlotIds.length && !isEventPast.value),
});

const matchSlots = computed(() => {
  const ids = currentEvent.value?.evaSlotIds ?? [];
  return ids
    .map(id => venueSlots.value.find(slot => slot.slotId === id))
    .filter((slot): slot is NonNullable<typeof slot> => !!slot);
});

// Each slot measured against a full match. One line when every slot of the match
// holds the same players, one per slot otherwise, since a player who booked only
// the first half shows up exactly there.
const bookedLines = computed(() => {
  const slots = matchSlots.value;
  if (slotsStatus.value !== 'ready' || !slots.length) return null;

  const distinct = new Set(slots.map(slot => slot.takenSeats));
  if (distinct.size === 1) {
    const headcount = assessSlotHeadcount(slots[0]!.takenSeats);
    return [{ ...headcount, prefix: '' }];
  }
  return slots.map(slot => ({ ...assessSlotHeadcount(slot.takenSeats), prefix: `${slot.startTime} : ` }));
});

// Where a player books their own seat for this match. eva.gg tells us how many
// players are in, never who, so each one checks their own booking there.
const bookingUrl = computed(() => {
  const event = currentEvent.value;
  if (!event || event.type !== 'MATCH' || isEventPast.value) return null;
  return buildEvaBookingUrl(event.venue?.evaLocationId ?? null, event.date);
});

const venueLabel = computed(() => {
  if (currentEvent.value?.type !== 'MATCH') return null;
  const venue = currentEvent.value.venue;
  if (!venue) return 'Non définie';

  const arena = currentEvent.value.arenaNumber;
  return formatVenuePlace(formatVenueLabel(venue), arena);
});

// Platform the meeting is held on, once the event is a voice meeting
const mediumLabel = computed(() => {
  const medium = currentEvent.value?.voiceMedium;
  return medium ? getVoiceMediumLabel(medium) : null;
});

// Show modal when events are provided
const showModal = computed(() => props.events.length > 0);

// Admin actions
function handleEditEvent() {
  if (currentEvent.value) {
    emit('edit-event', currentEvent.value);
  }
}

function handleCreateEvent() {
  const date = currentEvent.value?.date || props.selectedDate || '';
  if (date) {
    emit('create-event', date);
  }
}
</script>

<template>
  <Modal :open="showModal" size="md" :show-close-button="false" @close="emit('close')">
    <template #header>
      <!-- Navigation header with arrows -->
      <div class="viewer-header">
        <button
          v-if="events.length > 1"
          class="nav-arrow"
          :class="{ disabled: !hasPrev }"
          :disabled="!hasPrev"
          @click="goToPrev"
          title="Événement précédent"
        >
          ◀
        </button>

        <div class="header-content">
          <span class="event-counter" v-if="events.length > 1">
            {{ currentIndex + 1 }} / {{ events.length }}
          </span>
          <span v-if="currentEvent" class="event-type" :class="getEventTypeClass(currentEvent.type)">
            {{ getEventTypeTitle(currentEvent.type) }}
          </span>
        </div>

        <button
          v-if="events.length > 1"
          class="nav-arrow"
          :class="{ disabled: !hasNext }"
          :disabled="!hasNext"
          @click="goToNext"
          title="Événement suivant"
        >
          ▶
        </button>
      </div>
    </template>

    <template #default>
      <div v-if="currentEvent" class="event-viewer">
        <EventSheet
          :title="currentEvent.title"
          :date="currentEvent.date"
          :start-time="currentEvent.startTime"
          :end-time="currentEvent.endTime"
          :description="currentEvent.description"
        >
          <template #hours>
            <span v-if="currentEvent.evaSlotIds.length" class="detail-tag">
              {{ currentEvent.evaSlotIds.length > 1 ? `${currentEvent.evaSlotIds.length} créneaux` : '1 créneau' }}
            </span>
          </template>

          <template #details>
            <div v-if="bookedLines" class="detail-row">
              <span class="detail-label">👥 Sur eva.gg</span>
              <span class="detail-value">
                <span
                  v-for="line in bookedLines"
                  :key="line.prefix"
                  class="booked-line"
                  :class="`headcount-${line.status}`"
                >
                  {{ line.prefix }}{{ line.label }}<template v-if="line.note"> · {{ line.note }}</template>
                </span>
              </span>
            </div>
            <div v-if="venueLabel" class="detail-row">
              <span class="detail-label">📍 Salle</span>
              <span class="detail-value">
                {{ venueLabel }}
                <a
                  v-if="currentEvent.venue?.discord"
                  class="detail-link"
                  :href="currentEvent.venue.discord"
                  target="_blank"
                  rel="noopener noreferrer"
                >Discord</a>
              </span>
            </div>
            <div v-if="mediumLabel" class="detail-row">
              <span class="detail-label">🎙️ Plateforme</span>
              <span class="detail-value">{{ mediumLabel }}</span>
            </div>
          </template>

          <!-- Booking on eva.gg: a seat is taken there, not here; in the match's colour, as on the home -->
          <a
            v-if="bookingUrl"
            class="btn-booking"
            :href="bookingUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Réserver ma place sur eva.gg ↗
          </a>
        </EventSheet>

        <!-- Game Plan (for MATCH events) -->
        <ErrorDisplay :errors="errors" />
        <GamePlanViewer
          v-if="PLANNER_ENABLED && currentEvent.type === 'MATCH' && currentEvent.gamePlan"
          :gamePlan="currentEvent.gamePlan"
          @error="setError"
        />
      </div>
    </template>

    <template #footer>
      <div class="footer-actions">
        <!-- Admin buttons (only for non-past events) -->
        <div v-if="canEditEvent || canCreateEvent || canCancelMatch" class="admin-actions">
          <button
            v-if="canCancelMatch"
            class="btn btn-danger"
            :disabled="isCancelling"
            title="Retirer ce match des deux calendriers"
            @click="confirmCancel = true"
          >
            Annuler le match
          </button>
          <button v-if="canEditEvent" class="btn btn-edit" @click="handleEditEvent" title="Modifier cet événement">
            <SvgIcon name="edit" size="1em" />
            Modifier
          </button>
          <button v-if="canCreateEvent" class="btn btn-accent" @click="handleCreateEvent" title="Ajouter un événement">
            ➕ Ajouter
          </button>
        </div>
        <button class="btn btn-secondary" @click="emit('close')">
          Fermer
        </button>
      </div>
    </template>
  </Modal>

  <ConfirmModal
    :open="confirmCancel"
    title="Annuler le match"
    message="Le match sera retiré de votre calendrier et de celui de l'autre équipe. Les réservations faites sur eva.gg sont à annuler là-bas."
    confirm-text="Annuler le match"
    cancel-text="Garder le match"
    :danger="true"
    @confirm="cancelMatch"
    @cancel="confirmCancel = false"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.viewer-header {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  width: 100%;
}

.header-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.event-counter {
  font-size: 0.75rem;
  color: $color-text-secondary;
}

.event-type {
  font-size: 1rem;
  font-weight: 600;

  @each $type, $color in $event-type-colors {
    &.event-type--#{$type} {
      color: $color;
    }
  }
}

.nav-arrow {
  width: 36px;
  height: 36px;
  border: $border-thin solid $color-border-light;
  background: $color-bg-tertiary;
  border-radius: $radius-md;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  font-size: 1rem;
  color: $color-text-secondary;

  &:hover:not(.disabled) {
    background: $color-border-light;
    border-color: $color-accent;
    color: $color-white;
  }

  &.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}


.event-viewer {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.booked-line {
  display: block;
  white-space: nowrap;

  & + & {
    margin-top: 2px;
  }

  // Against a full match of 8: short is a partial lineup, extra players a problem to sort out
  &.headcount-full {
    color: $color-success;
  }

  &.headcount-missing {
    color: $color-conditional;
  }

  &.headcount-over {
    color: $color-danger;
  }
}

.btn-booking {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: 0.75rem;
  background: with-alpha($color-match, 0.15);
  border: $border-thin solid $color-match;
  border-radius: $radius-md;
  color: $color-match;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;

  &:hover {
    background: with-alpha($color-match, 0.25);
  }
}

.detail-link {
  margin-left: $spacing-sm;
  padding: 2px 8px;
  border-radius: $radius-sm;
  background: with-alpha($color-accent, 0.2);
  color: $color-accent;
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    background: with-alpha($color-accent, 0.35);
  }
}

.game-plan-section {
  padding: $spacing-md;
  background: with-alpha($color-bg-tertiary, 0.5);
  border-radius: $radius-md;
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

.absent-badge {
  background: with-alpha($color-danger, 0.2);
  color: $color-danger;
  padding: $spacing-xs 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.btn {
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: $color-border-light;
  color: $color-text-muted;

  &:hover {
    background: $color-bg-tertiary;
  }
}

// Modifying, in the colour of every Modifier of the app
.btn-edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  background: $color-edit;
  color: $color-bg-primary;

  &:hover {
    filter: brightness(1.1);
  }
}

.btn-accent {
  background: $color-accent;
  color: $color-white;

  &:hover {
    filter: brightness(1.1);
  }
}

// Same as the event form's delete button
.btn-danger {
  background: $color-danger;
  color: $color-white;
  border: $border-thin solid $color-danger;

  &:hover:not(:disabled) {
    background: tint($color-danger, 5%);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.footer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: $spacing-md;

  @include mobile {
    flex-direction: column-reverse;
    gap: $spacing-sm;
  }
}

.admin-actions {
  display: flex;
  gap: $spacing-sm;

  @include mobile {
    width: 100%;
    flex-wrap: wrap;

    .btn {
      flex: 1;
    }

    // Calling a match off takes a row of its own: three buttons side by side wrap their labels
    .btn-danger {
      flex-basis: 100%;
    }
  }
}
</style>

