<script setup lang="ts">
import { ref, computed, onMounted, provide } from 'vue';
import CalendarTopBar from '@/components/calendar/layout/CalendarTopBar.vue';
import CalendarHeader from '@/components/calendar/layout/CalendarHeader.vue';
import CalendarGrid from '@/components/calendar/CalendarGrid.vue';
import WeekGrid from '@/components/calendar/WeekGrid.vue';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';
import { useAuth } from '@/composables/useAuth';
import { useCalendar } from '@/composables/useCalendar';
import { useCalendarEvents } from '@/composables/useCalendarEvents';
import { fetchAllMaps, fetchPlayers } from '@/api';
import type { MapConfig, Player } from '@shared/types';

const { permissions, user } = useAuth();

// Check if teleport target exists (for SSR/test compatibility)
const teleportDisabled = ref(true);
onMounted(() => {
  teleportDisabled.value = !document.getElementById('topbar-dynamic-content');
});

// Use calendar composable
const {
  viewMode,
  currentYear,
  currentMonth,
  currentWeekStart,
  navigationTitle,
  days,
  isLoading,
  error,
  editMode,
  toggleEditMode,
  goToPrev,
  goToNext,
  goToPrevMonth,
  goToNextMonth,
  goToPrevWeek,
  goToNextWeek,
  loadCalendarData,
  setAvailability,
} = useCalendar({
  userId: computed(() => user.value?.id),
});

// Use calendar events composable
const {
  showEventModal,
  selectedDate,
  editingEvent,
  viewerEvents,
  viewerInitialIndex,
  canCreateEvents,
  openEventViewer,
  closeEventViewer,
  openCreateEvent,
  editEventFromViewer,
  createEventFromViewer,
  submitEvent,
  removeEvent,
  updateGamePlan,
} = useCalendarEvents({
  days,
  canEdit: computed(() => permissions.value.canEdit),
  reloadData: loadCalendarData,
});

// Provide editMode and toggle function for TopBar
provide('calendarEditMode', editMode);
provide('toggleCalendarEditMode', toggleEditMode);

// Maps and players for RotationCalculator
const maps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);

// Initial load
onMounted(async () => {
  // Load maps and players for RotationCalculator (in parallel with calendar)
  try {
    const [loadedMaps, loadedPlayers] = await Promise.all([
      fetchAllMaps(),
      fetchPlayers(),
    ]);
    maps.value = loadedMaps;
    players.value = loadedPlayers;
  } catch (err) {
    console.error('Error loading maps/players:', err);
  }

  loadCalendarData();
});
</script>

<template>
  <div class="calendar-page">
    <!-- Teleport toolbar to TopBar -->
    <Teleport v-if="!teleportDisabled" to="#topbar-dynamic-content">
      <CalendarTopBar
        :edit-mode="editMode"
        @toggle-edit-mode="toggleEditMode"
      />
    </Teleport>

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
      <!-- Calendar controls -->
      <CalendarHeader
        :view-mode="viewMode"
        :navigation-title="navigationTitle"
        @update:view-mode="viewMode = $event"
        @prev="goToPrev"
        @next="goToNext"
      />

      <!-- Scrollable calendar content -->
      <div class="calendar-content">
        <!-- Month view -->
        <CalendarGrid
          v-if="viewMode === 'month'"
          :year="currentYear"
          :month="currentMonth"
          :days="days"
          :edit-mode="editMode"
          @prev-month="goToPrevMonth"
          @next-month="goToNextMonth"
          @set-availability="setAvailability"
          @open-event-viewer="openEventViewer"
          @open-create-event="openCreateEvent"
        />

        <!-- Week view -->
        <WeekGrid
          v-else
          :year="currentYear"
          :month="currentMonth"
          :week-start="currentWeekStart"
          :days="days"
          :edit-mode="editMode"
          @prev-week="goToPrevWeek"
          @next-week="goToNextWeek"
          @set-availability="setAvailability"
          @open-event-viewer="openEventViewer"
          @open-create-event="openCreateEvent"
        />
      </div>
    </template>

    <!-- Event viewer modal -->
    <EventViewerModal
      :events="viewerEvents"
      :initial-index="viewerInitialIndex"
      :is-admin="canCreateEvents"
      :selected-date="viewerEvents[0]?.date"
      @close="closeEventViewer"
      @edit-event="editEventFromViewer"
      @create-event="createEventFromViewer"
    />

    <!-- Event form modal -->
    <EventFormModal
      :open="showEventModal"
      :selected-date="selectedDate"
      :edit-event="editingEvent"
      :read-only="!canCreateEvents"
      :maps="maps"
      :players="players"
      @close="showEventModal = false"
      @submit="submitEvent"
      @delete="removeEvent"
      @update-gameplan="updateGamePlan"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.calendar-page {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, $color-bg-secondary 0%, #16213e 100%);
  overflow: hidden;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  color: $color-text-secondary;
  min-height: 300px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid $color-border;
  border-top-color: $color-accent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-retry {
  padding: 0.75rem $spacing-lg;
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: $color-accent;
  }
}

.calendar-content {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 $spacing-xl $spacing-md;

  @include tablet {
    padding: 0 $spacing-lg $spacing-sm;
  }

  @include mobile-lg {
    padding: 0 $spacing-md $spacing-sm;
  }

  @include mobile {
    padding: 0 $spacing-sm $spacing-sm;
  }
}
</style>

