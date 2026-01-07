<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import CalendarGrid from '@/components/calendar/CalendarGrid.vue';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import { useAuth } from '@/composables/useAuth';
import { loadAllMaps, loadPlayers } from '@/config/config';
import {
  fetchMonthData,
  setAvailability,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventGamePlan,
} from '@/api/calendar.api';
import type {
  DayData,
  AvailabilityStatus,
  CalendarEvent,
  CreateEventRequest,
  MapConfig,
  Player,
  MatchGamePlan,
} from '@shared/types';

const { permissions, user } = useAuth();

// Current month state
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1); // 1-12

// Calendar data
const days = ref<Record<string, DayData>>({});
const isLoading = ref(true);
const error = ref('');

// Maps and players for RotationCalculator
const maps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);

// Event modal state
const showEventModal = ref(false);
const selectedDate = ref('');
const editingEvent = ref<CalendarEvent | undefined>(undefined);

// Can user create events?
const canCreateEvents = computed(() => permissions.value.canEdit);

// Month string for API (YYYY-MM)
const monthString = computed(() => {
  const m = currentMonth.value.toString().padStart(2, '0');
  return `${currentYear.value}-${m}`;
});

// Load calendar data for current month
async function loadCalendarData() {
  isLoading.value = true;
  error.value = '';

  try {
    const data = await fetchMonthData(monthString.value);
    days.value = data.days;
  } catch (err) {
    console.error('Error loading calendar:', err);
    error.value = err instanceof Error ? err.message : 'Erreur de chargement';
  } finally {
    isLoading.value = false;
  }
}

// Watch month changes
watch([currentYear, currentMonth], () => {
  loadCalendarData();
});

// Initial load
onMounted(async () => {
  // Load maps and players for RotationCalculator (in parallel with calendar)
  try {
    const [loadedMaps, loadedPlayers] = await Promise.all([
      loadAllMaps(),
      loadPlayers(),
    ]);
    maps.value = loadedMaps;
    players.value = loadedPlayers;
  } catch (err) {
    console.error('Error loading maps/players:', err);
  }

  loadCalendarData();
});

// Navigation
function goToPrevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function goToNextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}

// Toggle availability (cycle: null -> AVAILABLE -> UNAVAILABLE -> null)
async function handleToggleAvailability(date: string, currentStatus: AvailabilityStatus | null) {
  let newStatus: AvailabilityStatus | null;

  if (currentStatus === null) {
    newStatus = 'AVAILABLE';
  } else if (currentStatus === 'AVAILABLE') {
    newStatus = 'UNAVAILABLE';
  } else {
    newStatus = null;
  }

  // Optimistic update - update local state immediately for responsiveness
  if (days.value[date]) {
    days.value[date].currentUserStatus = newStatus;

    // Also update the current user in playerAvailabilities
    const currentUserId = user.value?.id;
    if (currentUserId) {
      const playerAvail = days.value[date].playerAvailabilities.find(
        p => p.userId === currentUserId
      );
      if (playerAvail) {
        playerAvail.status = newStatus;
      }
    }
  }

  try {
    await setAvailability(date, newStatus);
    // No need to reload - we already updated locally
  } catch (err) {
    console.error('Error setting availability:', err);
    // Revert on error
    if (days.value[date]) {
      days.value[date].currentUserStatus = currentStatus;
      const currentUserId = user.value?.id;
      if (currentUserId) {
        const playerAvail = days.value[date].playerAvailabilities.find(
          p => p.userId === currentUserId
        );
        if (playerAvail) {
          playerAvail.status = currentStatus;
        }
      }
    }
    alert(err instanceof Error ? err.message : 'Erreur');
  }
}

// Day click - open event creation if admin
function handleDayClick(date: string) {
  if (canCreateEvents.value) {
    selectedDate.value = date;
    editingEvent.value = undefined;
    showEventModal.value = true;
  }
}

// Event click - view/edit event (all users can view, only admins can edit)
function handleEventClick(event: CalendarEvent) {
  editingEvent.value = event;
  selectedDate.value = event.date;
  showEventModal.value = true;
}

// Create or update event
async function handleEventSubmit(eventData: CreateEventRequest) {
  try {
    if (editingEvent.value) {
      await updateEvent(editingEvent.value.id, eventData);
    } else {
      await createEvent(eventData);
    }

    showEventModal.value = false;
    await loadCalendarData();
  } catch (err) {
    console.error('Error saving event:', err);
    alert(err instanceof Error ? err.message : 'Erreur');
  }
}

// Delete event
async function handleEventDelete(eventId: string) {
  try {
    await deleteEvent(eventId);
    showEventModal.value = false;
    await loadCalendarData();
  } catch (err) {
    console.error('Error deleting event:', err);
    alert(err instanceof Error ? err.message : 'Erreur');
  }
}

// Update game plan for an event
async function handleGamePlanUpdate(eventId: string, gamePlan: MatchGamePlan) {
  try {
    await updateEventGamePlan(eventId, gamePlan);
    showEventModal.value = false;
    await loadCalendarData();
  } catch (err) {
    console.error('Error updating game plan:', err);
    alert(err instanceof Error ? err.message : 'Erreur');
  }
}
</script>

<template>
  <div class="calendar-page">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement du calendrier...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn-retry" @click="loadCalendarData">Réessayer</button>
    </div>

    <!-- Calendar -->
    <template v-else>

      <CalendarGrid
        :year="currentYear"
        :month="currentMonth"
        :days="days"
        @prev-month="goToPrevMonth"
        @next-month="goToNextMonth"
        @toggle-availability="handleToggleAvailability"
        @click-day="handleDayClick"
        @click-event="handleEventClick"
      />
    </template>

    <!-- Event creation/edit/view modal -->
    <EventFormModal
      :open="showEventModal"
      :selected-date="selectedDate"
      :edit-event="editingEvent"
      :read-only="!canCreateEvents"
      :maps="maps"
      :players="players"
      @close="showEventModal = false"
      @submit="handleEventSubmit"
      @delete="handleEventDelete"
      @update-gameplan="handleGamePlanUpdate"
    />
  </div>
</template>

<style scoped>
.calendar-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  overflow-y: auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #888;
  min-height: 300px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top-color: #7a7aba;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-retry {
  padding: 0.75rem 1.5rem;
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  border-radius: 8px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry:hover {
  background: #3a3a5a;
  border-color: #7a7aba;
}
</style>
