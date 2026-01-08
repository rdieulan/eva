<script setup lang="ts">
import { computed, ref } from 'vue';
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
}

const props = withDefaults(defineProps<Props>(), {
  showDayNumber: true,
});

const emit = defineEmits<{
  'toggle-availability': [];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
}>();

// Long press handling
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const isLongPress = ref(false);
const LONG_PRESS_DURATION = 500; // ms

// Cell background class based on current user's availability
const cellStatusClass = computed(() => {
  if (props.isPast) return 'status-past';
  if (props.currentUserStatus === 'AVAILABLE') return 'status-available';
  if (props.currentUserStatus === 'UNAVAILABLE') return 'status-unavailable';
  return 'status-unknown';
});

// Get player avatar color based on their availability
function getPlayerStatusClass(status: AvailabilityStatus | null): string {
  if (status === 'AVAILABLE') return 'player-available';
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

// Handle pointer down - start long press timer
function handlePointerDown() {
  if (props.isPast) return;

  isLongPress.value = false;
  longPressTimer.value = setTimeout(() => {
    isLongPress.value = true;
    // Open event viewer on long press (if events exist)
    if (props.events.length > 0) {
      emit('open-event-viewer', props.events, 0);
    }
  }, LONG_PRESS_DURATION);
}

// Handle pointer up - clear timer
function handlePointerUp() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

// Handle pointer leave - clear timer
function handlePointerLeave() {
  handlePointerUp();
}

// Handle cell click - toggle availability (short click only)
function handleCellClick() {
  if (props.isPast || isLongPress.value) return;
  emit('toggle-availability');
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
        'has-events': events.length > 0,
      }
    ]"
    @click="handleCellClick"
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
    @pointerleave="handlePointerLeave"
    @contextmenu.prevent
    :title="isPast ? 'Jour passé' : 'Clic = disponibilité | Appui long = événements'"
  >
    <!-- Day number -->
    <div v-if="props.showDayNumber" class="day-header">
      <span class="day-number">
        {{ dayNumber }}
      </span>
      <!-- Status indicator icon -->
      <span v-if="!isPast" class="status-icon">
        <template v-if="currentUserStatus === 'AVAILABLE'">✓</template>
        <template v-else-if="currentUserStatus === 'UNAVAILABLE'">✗</template>
        <template v-else>?</template>
      </span>
    </div>

    <!-- Events -->
    <div v-if="events.length > 0" class="events-list">
      <div
        v-for="event in events.slice(0, 2)"
        :key="event.id"
        class="event-badge"
        :class="getEventTypeClass(event.type)"
      >
        <span class="event-time">{{ event.startTime }}</span>
        <span class="event-title">{{ event.title }}</span>
      </div>
      <div v-if="events.length > 2" class="events-more">
        +{{ events.length - 2 }}
      </div>
    </div>

    <!-- Player availability summary (mini avatars) -->
    <div class="players-summary">
      <div
        v-for="player in playerAvailabilities"
        :key="player.userId"
        class="player-avatar"
        :class="getPlayerStatusClass(player.status)"
        :title="`${player.userName}: ${
          player.status === 'AVAILABLE'
            ? 'Disponible'
            : player.status === 'UNAVAILABLE'
            ? 'Indisponible'
            : 'Non renseigné'
        }`"
      >
        {{ getInitials(player.userName) }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.day-cell {
  min-height: 100px;
  padding: $spacing-sm;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.15s ease-out;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 2px solid transparent;

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
  justify-content: space-between;

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

.status-icon {
  font-size: 0.85rem;
  font-weight: 700;

  .status-available & {
    color: $color-success;
  }

  .status-unavailable & {
    color: #f87171;
  }

  .status-unknown & {
    color: #555;
  }

  @include mobile-lg {
    font-size: 0.7rem;
  }

  @include mobile {
    font-size: 0.6rem;
  }
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 2px;

  @include mobile {
    gap: 1px;
  }
}

.event-badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 2px 6px;
  border-radius: $radius-sm;
  font-size: 0.7rem;
  cursor: pointer;
  transition: filter 0.15s;
  overflow: hidden;

  &:hover {
    filter: brightness(1.2);
  }

  @include tablet {
    padding: 2px 4px;
    font-size: 0.65rem;
  }

  @include mobile-lg {
    padding: 1px 3px;
    font-size: 0.6rem;
    border-radius: 3px;
  }

  @include mobile {
    padding: 1px 2px;
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

.events-more {
  font-size: 0.65rem;
  color: $color-text-secondary;
  padding-left: 4px;

  @include mobile-lg {
    font-size: 0.55rem;
  }
}

.players-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: auto;

  @include mobile-lg {
    gap: 2px;
  }

  @include mobile {
    gap: 1px;
    // Keep visible on mobile with compact dots
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
  transition: transform 0.15s;

  &:hover {
    transform: scale(1.15);
  }

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

.player-unavailable {
  background: #991b1b;
  border: 1px solid #f87171;
}
</style>

