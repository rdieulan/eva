<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import GamePlanViewer from '@/components/common/GamePlanViewer.vue';
import type { CalendarEvent } from '@shared/types';
import { getEventTypeLabel as getEventTypeLabelUtil, isPastDateStr } from '@/utils/calendar';

const props = defineProps<{
  events: CalendarEvent[];
  initialIndex?: number;
  isAdmin?: boolean;
  selectedDate?: string;
}>();

const emit = defineEmits<{
  close: [];
  'edit-event': [event: CalendarEvent];
  'create-event': [date: string];
}>();

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

// Can edit (admin and not past)
const canEdit = computed(() => props.isAdmin && !isEventPast.value);

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

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Get event type label (with emoji)
function getEventTypeLabel(type: string): string {
  const baseLabel = getEventTypeLabelUtil(type);
  return type === 'MATCH' ? `⚔️ ${baseLabel}` : `📅 ${baseLabel}`;
}


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
          <span class="event-type" :class="currentEvent?.type?.toLowerCase()">
            {{ currentEvent ? getEventTypeLabel(currentEvent.type) : '' }}
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
        <!-- Event title -->
        <h2 class="event-title">{{ currentEvent.title }}</h2>

        <!-- Event details -->
        <div class="event-details">
          <div class="detail-row">
            <span class="detail-label">📅 Date</span>
            <span class="detail-value">{{ formatDate(currentEvent.date) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🕐 Horaire</span>
            <span class="detail-value">{{ currentEvent.startTime }} - {{ currentEvent.endTime }}</span>
          </div>
        </div>

        <!-- Description -->
        <div v-if="currentEvent.description" class="event-description">
          <span class="detail-label">📝 Description</span>
          <p>{{ currentEvent.description }}</p>
        </div>

        <!-- Game Plan (for MATCH events) -->
        <GamePlanViewer
          v-if="currentEvent.type === 'MATCH' && currentEvent.gamePlan"
          :gamePlan="currentEvent.gamePlan"
        />
      </div>
    </template>

    <template #footer>
      <div class="footer-actions">
        <!-- Admin buttons (only for non-past events) -->
        <div v-if="canEdit" class="admin-actions">
          <button class="btn btn-primary" @click="handleEditEvent" title="Modifier cet événement">
            ✏️ Modifier
          </button>
          <button class="btn btn-accent" @click="handleCreateEvent" title="Ajouter un événement">
            ➕ Ajouter
          </button>
        </div>
        <button class="btn btn-secondary" @click="emit('close')">
          Fermer
        </button>
      </div>
    </template>
  </Modal>
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

  &.match {
    color: #fdba74;
  }

  &.event {
    color: #93c5fd;
  }
}

.nav-arrow {
  width: 36px;
  height: 36px;
  border: 1px solid $color-border-light;
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
    color: #fff;
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

.event-title {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
  text-align: center;

  @include mobile-lg {
    font-size: 1.25rem;
  }
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: $spacing-md;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  @include mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
  }
}

.detail-label {
  color: $color-text-secondary;
  font-size: 0.9rem;
}

.detail-value {
  color: #fff;
  font-weight: 500;
}

.event-description {
  padding: $spacing-md;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;

  .detail-label {
    display: block;
    margin-bottom: $spacing-sm;
  }

  p {
    margin: 0;
    color: #ccc;
    white-space: pre-wrap;
  }
}

.game-plan-section {
  padding: $spacing-md;
  background: rgba($color-bg-tertiary, 0.5);
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
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
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
  color: #ccc;

  &:hover {
    background: #4a4a6a;
  }
}

.btn-primary {
  background: $color-accent;
  color: #fff;

  &:hover {
    background: $color-accent-light;
  }
}

.btn-accent {
  background: $color-success;
  color: #fff;

  &:hover {
    filter: brightness(1.1);
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

    .btn {
      flex: 1;
    }
  }
}
</style>

