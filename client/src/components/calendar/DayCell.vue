<script setup lang="ts">
import { computed } from 'vue';
import type { AvailabilityStatus, PlayerAvailability, CalendarEvent } from '@shared/types';

interface Props {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  currentUserStatus: AvailabilityStatus | null;
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
  showDayNumber?: boolean;
  editMode?: boolean; // Availability edit mode
}

const props = withDefaults(defineProps<Props>(), {
  showDayNumber: true,
  editMode: false,
});

const emit = defineEmits<{
  'set-availability': [status: AvailabilityStatus | null];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
}>();

// Sort events by start time
const sortedEvents = computed(() => {
  return [...props.events].sort((a, b) => {
    return a.startTime.localeCompare(b.startTime);
  });
});

// Check if there are events
const hasEvents = computed(() => props.events.length > 0);

// Cell background class based on current user's availability
const cellStatusClass = computed(() => {
  if (props.isPast) return 'status-past';
  if (props.currentUserStatus === 'AVAILABLE') return 'status-available';
  if (props.currentUserStatus === 'CONDITIONAL') return 'status-conditional';
  if (props.currentUserStatus === 'UNAVAILABLE') return 'status-unavailable';
  return 'status-unknown';
});

// Get player avatar color based on their availability
function getPlayerStatusClass(status: AvailabilityStatus | null): string {
  if (status === 'AVAILABLE') return 'player-available';
  if (status === 'CONDITIONAL') return 'player-conditional';
  if (status === 'UNAVAILABLE') return 'player-unavailable';
  return 'player-unknown';
}

// Get initials from player name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Event type to color class
function getEventTypeClass(type: string): string {
  return type === 'MATCH' ? 'event-match' : 'event-event';
}

// Click on cell
function handleCellClick() {
  if (props.isPast) return;

  if (props.editMode) {
    // Edit mode: cycle through availability states
    cycleAvailability();
  } else if (hasEvents.value) {
    // Normal mode with events: open event viewer
    emit('open-event-viewer', sortedEvents.value, 0);
  } else {
    // Normal mode without events: emit to open create modal (for admins)
    emit('open-create-event', props.date);
  }
}

// Click on specific event = open viewer at that event index (or cycle in edit mode)
function handleEventClick(e: MouseEvent, index: number) {
  e.stopPropagation();
  if (props.isPast) return;

  if (props.editMode) {
    // In edit mode, cycle availability
    cycleAvailability();
  } else {
    emit('open-event-viewer', sortedEvents.value, index);
  }
}

// Cycle availability: AVAILABLE -> CONDITIONAL -> UNAVAILABLE -> null -> AVAILABLE...
function cycleAvailability() {
  if (props.isPast) return;

  let newStatus: AvailabilityStatus | null;
  if (props.currentUserStatus === null || props.currentUserStatus === undefined) {
    newStatus = 'AVAILABLE';
  } else if (props.currentUserStatus === 'AVAILABLE') {
    newStatus = 'CONDITIONAL';
  } else if (props.currentUserStatus === 'CONDITIONAL') {
    newStatus = 'UNAVAILABLE';
  } else {
    // UNAVAILABLE -> back to null (grey)
    newStatus = null;
  }

  emit('set-availability', newStatus);
}
</script>

<template>
  <div
    class="day-cell"
    :class="[
      cellStatusClass,
      {
        'other-month': !isCurrentMonth,
        'is-today': isToday,
        'is-past': isPast,
        'has-events': hasEvents,
        'edit-mode': editMode,
      }
    ]"
    @click="handleCellClick"
  >
    <!-- Day number -->
    <div v-if="props.showDayNumber" class="day-header">
      <span class="day-number">
        {{ dayNumber }}
      </span>
    </div>

    <!-- Events list -->
    <div v-if="hasEvents" class="events-list">
      <div
        v-for="(event, index) in sortedEvents"
        :key="event.id"
        class="event-badge"
        :class="getEventTypeClass(event.type)"
        @click="handleEventClick($event, index)"
      >
        <span class="event-time">{{ event.startTime }}</span>
        <span class="event-title">{{ event.title }}</span>
      </div>
    </div>

    <!-- Player availability summary (always visible) -->
    <div class="players-summary">
      <div
        v-for="player in playerAvailabilities"
        :key="player.userId"
        class="player-avatar"
        :class="getPlayerStatusClass(player.status)"
      >
        {{ getInitials(player.userName) }}
      </div>
    </div>

    <!-- Background status icon (only in edit mode) -->
    <div v-if="!isPast && editMode" class="status-bg-icon">
      <template v-if="currentUserStatus === 'AVAILABLE'">✓</template>
      <template v-else-if="currentUserStatus === 'CONDITIONAL'">~</template>
      <template v-else-if="currentUserStatus === 'UNAVAILABLE'">✗</template>
      <template v-else>?</template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.day-cell {
  position: relative;
  min-height: 100px;
  min-width: 0; // Prevent overflow in grid
  padding: $spacing-sm;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.15s ease-out;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 2px solid transparent;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;

  &.status-unknown {
    background: #1e1e32;
    border-color: $color-bg-tertiary;

    &:hover {
      background: #252540;
      border-color: $color-border-light;
    }
  }

  &.status-available {
    background: rgba($color-success, 0.15);
    border-color: rgba($color-success, 0.4);

    &:hover {
      background: rgba($color-success, 0.25);
      border-color: rgba($color-success, 0.6);
    }
  }

  &.status-conditional {
    background: rgba($color-conditional, 0.15);
    border-color: rgba($color-conditional, 0.4);

    &:hover {
      background: rgba($color-conditional, 0.25);
      border-color: rgba($color-conditional, 0.6);
    }
  }

  &.status-unavailable {
    background: rgba(248, 113, 113, 0.15);
    border-color: rgba(248, 113, 113, 0.4);

    &:hover {
      background: rgba(248, 113, 113, 0.25);
      border-color: rgba(248, 113, 113, 0.6);
    }
  }

  &.status-past {
    background: #18181f;
    border-color: #222;
    cursor: not-allowed;
    opacity: 0.5;
  }

  &.other-month {
    opacity: 0.4;
  }

  &.is-today {
    box-shadow: 0 0 0 2px $color-accent;
  }

  &.is-past {
    pointer-events: none;
  }

  @include tablet {
    min-height: 85px;
    padding: 0.4rem;
    gap: $spacing-xs;
  }

  @include mobile-lg {
    min-height: 70px;
    padding: 0.3rem;
    gap: 0.2rem;
    border-radius: 6px;
  }

  @include mobile {
    min-height: 60px;
    padding: 0.2rem;
    gap: 0.15rem;
    border-radius: $radius-sm;
    border-width: 1px;
  }
}

.day-header {
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;

  @include mobile-lg {
    margin-bottom: 0.1rem;
  }
}

.day-number {
  font-weight: 600;
  font-size: 0.9rem;
  color: #ccc;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  .is-today & {
    background: $color-accent;
    color: #fff;
  }

  @include tablet {
    font-size: 0.85rem;
    width: 22px;
    height: 22px;
  }

  @include mobile-lg {
    font-size: 0.75rem;
    width: 20px;
    height: 20px;
  }

  @include mobile {
    font-size: 0.7rem;
    width: 18px;
    height: 18px;
  }
}

.status-bg-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 5rem;
  font-weight: 900;
  opacity: 0.25;
  pointer-events: none;
  z-index: 0;
  text-shadow: 0 0 10px currentColor;

  .status-available & {
    color: $color-success;
  }

  .status-conditional & {
    color: $color-conditional;
  }

  .status-unavailable & {
    color: #f87171;
  }

  .status-unknown & {
    color: #888;
  }

  @include tablet {
    font-size: 4rem;
  }

  @include mobile-lg {
    font-size: 3rem;
  }

  @include mobile {
    font-size: 2.5rem;
  }
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
  z-index: 1;
  overflow: hidden;

  @include mobile {
    gap: 1px;
  }
}

.event-badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 4px 6px;
  border-radius: $radius-sm;
  font-size: 0.75rem;
  cursor: pointer;
  transition: filter 0.15s;
  overflow: hidden;

  &:hover {
    filter: brightness(1.2);
  }

  @include tablet {
    padding: 3px 5px;
    font-size: 0.7rem;
  }

  @include mobile-lg {
    padding: 2px 4px;
    font-size: 0.6rem;
    border-radius: 3px;
  }

  @include mobile {
    padding: 2px 3px;
    font-size: 0.55rem;
    border-left-width: 1px;
  }
}

.event-match {
  background: rgba($color-warning, 0.3);
  border-left: 2px solid $color-warning;
  color: #fdba74;
}

.event-event {
  background: rgba($color-info, 0.3);
  border-left: 2px solid $color-info;
  color: #93c5fd;
}

.event-time {
  font-weight: 600;
  flex-shrink: 0;

  @include mobile-lg {
    display: none;
  }
}

.event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @include mobile {
    max-width: 100%;
  }
}


.players-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: auto;
  padding: 4px;
  border-radius: $radius-sm;
  min-height: 30px;
  position: relative;
  z-index: 1;


  @include mobile-lg {
    gap: 2px;
    padding: 3px;
    min-height: 24px;
  }

  @include mobile {
    gap: 1px;
    padding: 2px;
    min-height: 16px;
  }
}

.player-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  font-weight: 700;
  color: #fff;

  @include tablet {
    width: 20px;
    height: 20px;
    font-size: 0.5rem;
  }

  @include mobile-lg {
    width: 16px;
    height: 16px;
    font-size: 0.45rem;
  }

  @include mobile {
    // Compact dots without text
    width: 8px;
    height: 8px;
    font-size: 0;
    border-width: 0;
  }
}

.player-unknown {
  background: #444;
  color: $color-text-secondary;
}

.player-available {
  background: #166534;
  border: 1px solid $color-success;
}

.player-conditional {
  background: #854d0e;
  border: 1px solid $color-conditional;
}

.player-unavailable {
  background: #991b1b;
  border: 1px solid #f87171;
}
</style>

