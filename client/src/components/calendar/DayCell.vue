<script setup lang="ts">
import { computed } from 'vue';
import type { AvailabilityStatus, PlayerAvailability, CalendarEvent } from '@shared/types';

interface Props {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean; // Jour déjà passé
  currentUserStatus: AvailabilityStatus | null;
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
  showDayNumber?: boolean; // Show day number in header (default: true)
}

const props = withDefaults(defineProps<Props>(), {
  showDayNumber: true,
});

const emit = defineEmits<{
  'toggle-availability': [];
  'click-day': [];
  'click-event': [event: CalendarEvent];
}>();

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

// Handle cell click - toggle availability if not past
function handleCellClick() {
  if (!props.isPast) {
    emit('toggle-availability');
  }
}

// Handle day number click for admin event creation
function handleDayClick(e: MouseEvent) {
  e.stopPropagation();
  if (!props.isPast) {
    emit('click-day');
  }
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
      }
    ]"
    @click="handleCellClick"
    :title="isPast ? 'Jour passé' : 'Cliquer pour changer votre disponibilité'"
  >
    <!-- Day number -->
    <div v-if="props.showDayNumber" class="day-header">
      <span
        class="day-number"
        @click="handleDayClick"
        :class="{ 'clickable': !isPast }"
        :title="!isPast ? 'Créer un événement' : undefined"
      >
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
        @click.stop="emit('click-event', event)"
        :title="`${event.title} (${event.startTime} - ${event.endTime})`"
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

<style scoped>
.day-cell {
  min-height: 100px;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease-out;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 2px solid transparent;
}

/* Status-based backgrounds */
.day-cell.status-unknown {
  background: #1e1e32;
  border-color: #2a2a4a;
}

.day-cell.status-unknown:hover {
  background: #252540;
  border-color: #3a3a5a;
}

.day-cell.status-available {
  background: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.4);
}

.day-cell.status-available:hover {
  background: rgba(74, 222, 128, 0.25);
  border-color: rgba(74, 222, 128, 0.6);
}

.day-cell.status-unavailable {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.4);
}

.day-cell.status-unavailable:hover {
  background: rgba(248, 113, 113, 0.25);
  border-color: rgba(248, 113, 113, 0.6);
}

.day-cell.status-past {
  background: #18181f;
  border-color: #222;
  cursor: not-allowed;
  opacity: 0.5;
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.is-today {
  box-shadow: 0 0 0 2px #7a7aba;
}

.day-cell.is-past {
  pointer-events: none;
}

.day-cell.is-past .events-list,
.day-cell.is-past .event-badge {
  pointer-events: auto;
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  transition: background 0.15s;
}

.day-number.clickable:hover {
  background: rgba(122, 122, 186, 0.3);
}

.is-today .day-number {
  background: #7a7aba;
  color: #fff;
}

/* Status icon */
.status-icon {
  font-size: 0.85rem;
  font-weight: 700;
}

.status-available .status-icon {
  color: #4ade80;
}

.status-unavailable .status-icon {
  color: #f87171;
}

.status-unknown .status-icon {
  color: #555;
}

/* Events list */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: filter 0.15s;
  overflow: hidden;
}

.event-badge:hover {
  filter: brightness(1.2);
}

.event-match {
  background: rgba(251, 146, 60, 0.3);
  border-left: 2px solid #fb923c;
  color: #fdba74;
}

.event-event {
  background: rgba(96, 165, 250, 0.3);
  border-left: 2px solid #60a5fa;
  color: #93c5fd;
}

.event-time {
  font-weight: 600;
  flex-shrink: 0;
}

.event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.events-more {
  font-size: 0.65rem;
  color: #888;
  padding-left: 4px;
}

/* Players summary */
.players-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: auto;
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
}

.player-avatar:hover {
  transform: scale(1.15);
}

.player-unknown {
  background: #444;
  color: #888;
}

.player-available {
  background: #166534;
  border: 1px solid #4ade80;
}

.player-unavailable {
  background: #991b1b;
  border: 1px solid #f87171;
}
</style>

