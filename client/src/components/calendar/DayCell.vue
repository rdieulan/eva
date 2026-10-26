<script setup lang="ts">
import { computed } from 'vue';
import type { AvailabilityStatus, PlayerAvailability, CalendarEvent, SubscriptionRenewal } from '@shared/types';
import { getPlayerInitials } from '@/utils/players';
import {
  getAvailabilityClass,
  getAvailabilityDisplay,
  getNextAvailabilityStatus,
  sortPlayersByAvailability,
} from '@/utils/availability';
import { getEventTypeClass } from '@/utils/calendar';
import { SUBSCRIPTION_TIER_LABELS } from '@/utils/subscription';
import SvgIcon from '@/components/common/SvgIcon.vue';

interface Props {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  currentPlayerStatus: AvailabilityStatus | null;
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
  renewals?: SubscriptionRenewal[]; // Players whose subscription renews that day
  showDayNumber?: boolean;
  editMode?: boolean; // Availability edit mode
  playerLabels?: Record<string, string>; // playerId -> roster-unique badge label
}

const props = withDefaults(defineProps<Props>(), {
  renewals: () => [],
  showDayNumber: true,
  editMode: false,
  playerLabels: () => ({}),
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

// Sort players by availability status then by name
const sortedPlayers = computed(() => {
  return sortPlayersByAvailability(props.playerAvailabilities);
});

// Check if there are events
const hasEvents = computed(() => props.events.length > 0);

// Subscription renewals: full names on wide cells, roster labels on narrow ones
const renewalNames = computed(() => props.renewals.map(renewal => renewal.playerName).join(', '));
const renewalLabels = computed(() => props.renewals
  .map(renewal => props.playerLabels[renewal.playerId] ?? getPlayerInitials(renewal.playerName))
  .join(' '));
const renewalTooltip = computed(() => {
  const players = props.renewals.map(renewal =>
    renewal.tier ? `${renewal.playerName} (${SUBSCRIPTION_TIER_LABELS[renewal.tier]})` : renewal.playerName,
  );
  return `Renouvellement d'abonnement : ${players.join(', ')}`;
});

// Cell background class based on current user's availability
const cellStatusClass = computed(() =>
  props.isPast ? 'status-past' : getAvailabilityClass(props.currentPlayerStatus),
);

// Symbol shown behind the day in edit mode
const currentStatusSymbol = computed(() => getAvailabilityDisplay(props.currentPlayerStatus).symbol);

// Badge label for a player: the roster-unique label when available, otherwise
// fall back to plain initials (e.g. when the component is used standalone).
function getPlayerLabel(player: PlayerAvailability): string {
  return props.playerLabels[player.playerId] ?? getPlayerInitials(player.playerName);
}

// Click on cell
function handleCellClick() {
  if (props.editMode) {
    // Edit mode: cycle through availability states (not for past days)
    if (!props.isPast) {
      cycleAvailability();
    }
  } else if (hasEvents.value) {
    // Normal mode with events: open event viewer (even for past days)
    emit('open-event-viewer', sortedEvents.value, 0);
  } else if (!props.isPast) {
    // Normal mode without events: emit to open create modal (for admins, not past)
    emit('open-create-event', props.date);
  }
}

// Click on specific event = open viewer at that event index (or cycle in edit mode)
function handleEventClick(e: MouseEvent, index: number) {
  e.stopPropagation();

  if (props.editMode) {
    // In edit mode, cycle availability (not for past days)
    if (!props.isPast) {
      cycleAvailability();
    }
  } else {
    // Open event viewer (even for past days)
    emit('open-event-viewer', sortedEvents.value, index);
  }
}

// Cycle availability through the statuses, then back to not set
function cycleAvailability() {
  if (props.isPast) return;
  emit('set-availability', getNextAvailabilityStatus(props.currentPlayerStatus ?? null));
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

    <!-- Subscription renewals -->
    <div v-if="renewals.length" class="renewal-strip" :title="renewalTooltip">
      <span class="renewal-icon">↻</span>
      <span class="renewal-names">{{ renewalNames }}</span>
      <span class="renewal-labels">{{ renewalLabels }}</span>
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
        v-for="player in sortedPlayers"
        :key="player.playerId"
        class="player-avatar"
        :class="getAvailabilityClass(player.status)"
        :title="`${player.playerName} : ${getAvailabilityDisplay(player.status).title}`"
      >
        {{ getPlayerLabel(player) }}
      </div>
    </div>

    <!-- Background status icon (only in edit mode) -->
    <div v-if="!isPast && editMode" class="status-bg-icon">
      <SvgIcon v-if="'icon' in currentStatusSymbol" :name="currentStatusSymbol.icon" />
      <template v-else>{{ currentStatusSymbol.text }}</template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use 'sass:color';
@use 'sass:map';

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

  &.availability--unset {
    background: $color-bg-secondary;
    border-color: $color-bg-tertiary;

    &:hover {
      background: $color-bg-tertiary;
      border-color: $color-border-light;
    }
  }

  @each $status, $style in $availability-styles {
    $color: map.get($style, color);

    &.availability--#{$status} {
      background: rgba($color, 0.15);
      border-color: rgba($color, 0.4);

      &:hover {
        background: rgba($color, 0.25);
        border-color: rgba($color, 0.6);
      }
    }
  }

  &.status-past {
    background: rgba($color-black, 0.3);
    border-color: rgba($color-border, 0.3);
    cursor: default;

    .day-number {
      color: rgba($color-text-muted, 0.4);
    }

    .event-badge {
      opacity: 0.4;
    }

    .players-summary {
      opacity: 0.5;
    }
  }

  &.other-month {
    background: rgba($color-bg-primary, 0.6);
    border-color: rgba($color-border, 0.2);
    cursor: default;
    pointer-events: none;

    .day-number {
      color: rgba($color-text-muted, 0.35);
    }

    .event-badge {
      opacity: 0.5;
    }

    .players-summary {
      opacity: 0.4;
    }

    // Disable hover effects for other month days
    &:hover {
      background: rgba($color-bg-primary, 0.6);
      border-color: rgba($color-border, 0.2);
    }
  }

  // Past days of other month - even more faded
  &.status-past.other-month {
    background: rgba($color-black, 0.4);
    border-color: rgba($color-border, 0.15);

    .day-number {
      color: rgba($color-text-muted, 0.25);
    }

    .event-badge {
      opacity: 0.3;
    }

    .players-summary {
      opacity: 0.3;
    }
  }

  &.is-today {
    box-shadow: 0 0 0 2px $color-accent;
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
  color: $color-text-muted;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  .is-today & {
    background: $color-accent;
    color: $color-white;
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

  @each $status, $style in $availability-styles {
    .availability--#{$status} & {
      color: map.get($style, color);
    }
  }

  .availability--unset & {
    color: $color-text-secondary;
  }

  // Icons do not take text-shadow: give them the same glow
  .svg-icon {
    filter: drop-shadow(0 0 10px currentColor);
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

.renewal-strip {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 2px 6px;
  border: 1px dashed rgba($color-renewal, 0.7);
  border-radius: $radius-sm;
  background: rgba($color-renewal, 0.15);
  color: $color-renewal;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;

  @include mobile-lg {
    padding: 1px 3px;
    font-size: 0.55rem;
  }
}

.renewal-icon {
  flex-shrink: 0;
}

.renewal-names,
.renewal-labels {
  overflow: hidden;
  text-overflow: ellipsis;
}

.renewal-labels {
  display: none;
}

@include mobile-lg {
  .renewal-names {
    display: none;
  }

  .renewal-labels {
    display: inline;
  }
}

@each $type, $color in $event-type-colors {
  .event-type--#{$type} {
    background: rgba($color, 0.3);
    border-left: 2px solid $color;
    color: $color;
  }
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
  color: $color-white;

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

.player-avatar.availability--unset {
  background: $color-border;
  color: $color-text-secondary;
}

@each $status, $style in $availability-styles {
  $color: map.get($style, color);

  .player-avatar.availability--#{$status} {
    background: color.scale($color, $lightness: map.get($style, avatar-bg));
    border: 1px solid color.scale($color, $lightness: map.get($style, avatar-border));
  }
}
</style>

