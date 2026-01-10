<script setup lang="ts">
import { ref, computed, onMounted, watch, provide } from 'vue';
import CalendarGrid from '@/components/calendar/CalendarGrid.vue';
import WeekGrid from '@/components/calendar/WeekGrid.vue';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';
import SvgIcon from '@/components/common/SvgIcon.vue';
import { useAuth } from '@/composables/useAuth';
import { loadAllMaps, loadPlayers } from '@/config/config';
import {
  fetchMonthData,
  setAvailability as setAvailabilityApi,
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

// Check if teleport target exists (for SSR/test compatibility)
const teleportDisabled = ref(true);
onMounted(() => {
  teleportDisabled.value = !document.getElementById('topbar-dynamic-content');
});

// View mode state
type ViewMode = 'month' | 'week';
const viewMode = ref<ViewMode>('month');

// Edit mode state (for availability editing)
const editMode = ref(false);
let lastToggleTime = 0;

// Toggle edit mode - with minimal debounce for mobile double-event issue
function toggleEditMode() {
  const now = Date.now();
  if (now - lastToggleTime < 50) return; // Ignore if less than 50ms since last toggle
  lastToggleTime = now;
  editMode.value = !editMode.value;
}

// Provide editMode and toggle function for TopBar
provide('calendarEditMode', editMode);
provide('toggleCalendarEditMode', toggleEditMode);

// Current month state
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1); // 1-12

// Current week state (start of week - Monday)
const currentWeekStart = ref<Date>(getMonday(new Date()));

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

// Event viewer modal state (read-only view with navigation)
const showEventViewer = ref(false);
const viewerEvents = ref<CalendarEvent[]>([]);
const viewerInitialIndex = ref(0);

// Can user create events?
const canCreateEvents = computed(() => permissions.value.canEdit);

// Month string for API (YYYY-MM)
const monthString = computed(() => {
  const m = currentMonth.value.toString().padStart(2, '0');
  return `${currentYear.value}-${m}`;
});

// Month names for display
const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Month display title
const monthDisplay = computed(() => {
  return `${monthNames[currentMonth.value - 1]} ${currentYear.value}`;
});

// Week display title
const weekDisplay = computed(() => {
  const start = currentWeekStart.value;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = monthNames[start.getMonth()];
  const endMonth = monthNames[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startDay} - ${endDay} ${startMonth} ${start.getFullYear()}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${start.getFullYear()}`;
  } else {
    return `${startDay} ${startMonth} ${start.getFullYear()} - ${endDay} ${endMonth} ${end.getFullYear()}`;
  }
});

// Navigation title based on view mode
const navigationTitle = computed(() => {
  return viewMode.value === 'month' ? monthDisplay.value : weekDisplay.value;
});

// Navigation functions
function goToPrev() {
  if (viewMode.value === 'month') {
    goToPrevMonth();
  } else {
    goToPrevWeek();
  }
}

function goToNext() {
  if (viewMode.value === 'month') {
    goToNextMonth();
  } else {
    goToNextWeek();
  }
}

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

// Watch view mode changes
watch(viewMode, (newMode) => {
  if (newMode === 'week') {
    syncWeekToMonth();
  }
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

// Get Monday of the week for a given date
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Week navigation
function goToPrevWeek() {
  const newDate = new Date(currentWeekStart.value);
  newDate.setDate(newDate.getDate() - 7);
  currentWeekStart.value = newDate;
  updateMonthFromWeek();
}

function goToNextWeek() {
  const newDate = new Date(currentWeekStart.value);
  newDate.setDate(newDate.getDate() + 7);
  currentWeekStart.value = newDate;
  updateMonthFromWeek();
}

// Sync month/year when week changes
function updateMonthFromWeek() {
  const midWeek = new Date(currentWeekStart.value);
  midWeek.setDate(midWeek.getDate() + 3); // Wednesday (middle of week)
  currentYear.value = midWeek.getFullYear();
  currentMonth.value = midWeek.getMonth() + 1;
}

// Sync week when switching to week view
function syncWeekToMonth() {
  // Use today's date to get the current week
  const today = new Date();
  // Only sync to current week if we're viewing the current month
  if (currentYear.value === today.getFullYear() && currentMonth.value === today.getMonth() + 1) {
    currentWeekStart.value = getMonday(today);
  } else {
    // If viewing a different month, show the first week of that month
    const firstOfMonth = new Date(currentYear.value, currentMonth.value - 1, 1);
    currentWeekStart.value = getMonday(firstOfMonth);
  }
}

// Set availability (direct status, not cycling)
async function handleSetAvailability(date: string, newStatus: AvailabilityStatus | null) {
  // Store previous status for rollback
  const previousStatus = days.value[date]?.currentUserStatus ?? null;

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
    await setAvailabilityApi(date, newStatus);
    // No need to reload - we already updated locally
  } catch (err) {
    console.error('Error setting availability:', err);
    // Revert on error
    if (days.value[date]) {
      days.value[date].currentUserStatus = previousStatus;
      const currentUserId = user.value?.id;
      if (currentUserId) {
        const playerAvail = days.value[date].playerAvailabilities.find(
          p => p.userId === currentUserId
        );
        if (playerAvail) {
          playerAvail.status = previousStatus;
        }
      }
    }
    alert(err instanceof Error ? err.message : 'Erreur');
  }
}


// Open event viewer modal (read-only with navigation)
function handleOpenEventViewer(events: CalendarEvent[], initialIndex: number) {
  if (events.length === 0) return;
  viewerEvents.value = events;
  viewerInitialIndex.value = initialIndex;
  showEventViewer.value = true;
}

// Close event viewer
function closeEventViewer() {
  showEventViewer.value = false;
  viewerEvents.value = [];
}

// Open edit modal for an event (from viewer)
function handleEditEventFromViewer(event: CalendarEvent) {
  closeEventViewer();
  editingEvent.value = event;
  selectedDate.value = event.date;
  showEventModal.value = true;
}

// Open create modal for a date (from viewer)
function handleCreateEventFromViewer(date: string) {
  closeEventViewer();
  editingEvent.value = undefined;
  selectedDate.value = date;
  showEventModal.value = true;
}

// Open create event modal directly (when clicking on day without events)
function handleOpenCreateEvent(date: string) {
  if (!canCreateEvents.value) return;
  editingEvent.value = undefined;
  selectedDate.value = date;
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
    <!-- Teleport edit button to TopBar -->
    <Teleport v-if="!teleportDisabled" to="#topbar-dynamic-content">
      <div class="calendar-toolbar">
        <!-- Availability legend -->
        <div class="availability-legend">
          <span class="legend-item available">
            <span class="legend-dot"></span>
            <span class="legend-label">Dispo</span>
          </span>
          <span class="legend-item conditional">
            <span class="legend-dot"></span>
            <span class="legend-label">Possible</span>
          </span>
          <span class="legend-item unavailable">
            <span class="legend-dot"></span>
            <span class="legend-label">Indispo</span>
          </span>
          <span class="legend-item unknown">
            <span class="legend-dot"></span>
            <span class="legend-label">?</span>
          </span>
        </div>

        <!-- Edit mode button -->
        <button
          class="edit-mode-btn"
          :class="{ active: editMode }"
          @pointerdown.prevent="toggleEditMode"
          :title="editMode ? 'Quitter le mode édition' : 'Modifier mes disponibilités'"
        >
          <span class="edit-icon">✏️</span>
          <span class="edit-label">{{ editMode ? 'Terminer' : 'Dispos' }}</span>
        </button>
      </div>
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
      <!-- Calendar controls (fixed at top) -->
      <div class="calendar-controls">
        <!-- View mode switch -->
        <div class="view-switch">
          <button
            class="view-btn"
            :class="{ active: viewMode === 'month' }"
            @click="viewMode = 'month'"
          >
            📅 Mois
          </button>
          <button
            class="view-btn"
            :class="{ active: viewMode === 'week' }"
            @click="viewMode = 'week'"
          >
            📆 Semaine
          </button>
        </div>

        <!-- Navigation header -->
        <div class="nav-header">
          <button class="nav-btn" @click="goToPrev" :title="viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'">
            <SvgIcon name="chevron-left" class="nav-icon" />
          </button>
          <h2 class="nav-title">{{ navigationTitle }}</h2>
          <button class="nav-btn" @click="goToNext" :title="viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'">
            <SvgIcon name="chevron-right" class="nav-icon" />
          </button>
        </div>

        <!-- Weekdays header (only for month view) -->
        <div v-if="viewMode === 'month'" class="weekdays-header">
          <div v-for="dayName in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']" :key="dayName" class="weekday-name">
            {{ dayName }}
          </div>
        </div>
      </div>

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
          @set-availability="handleSetAvailability"
          @open-event-viewer="handleOpenEventViewer"
          @open-create-event="handleOpenCreateEvent"
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
          @set-availability="handleSetAvailability"
          @open-event-viewer="handleOpenEventViewer"
          @open-create-event="handleOpenCreateEvent"
        />
      </div>
    </template>

    <!-- Event viewer modal (read-only with navigation) -->
    <EventViewerModal
      :events="viewerEvents"
      :initial-index="viewerInitialIndex"
      :is-admin="canCreateEvents"
      :selected-date="viewerEvents[0]?.date"
      @close="closeEventViewer"
      @edit-event="handleEditEventFromViewer"
      @create-event="handleCreateEventFromViewer"
    />

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

.calendar-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-sm $spacing-xl;
  background: linear-gradient(135deg, $color-bg-secondary 0%, #16213e 100%);
  flex-shrink: 0;

  @include tablet {
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
  }

  @include mobile-lg {
    gap: $spacing-xs;
    padding: $spacing-sm $spacing-md;
  }

  @include mobile {
    padding: $spacing-xs $spacing-sm;
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

.view-switch {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-xs;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: 10px;

  @include mobile {
    padding: 0.2rem;
    border-radius: $radius-md;
  }
}

.nav-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-lg;

  @include tablet {
    gap: $spacing-md;
  }

  @include mobile-lg {
    gap: 0.75rem;
  }

  @include mobile {
    gap: $spacing-sm;
  }
}

.nav-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: $color-accent;
  }

  @include mobile-lg {
    width: 36px;
    height: 36px;
  }

  @include mobile {
    width: 32px;
    height: 32px;
  }
}

.nav-icon {
  width: 20px;
  height: 20px;
  fill: $color-text-secondary;

  .nav-btn:hover & {
    fill: #fff;
  }

  @include mobile {
    width: 16px;
    height: 16px;
  }
}

.nav-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #fff;
  text-align: center;
  min-width: 200px;

  @include tablet {
    font-size: 1.15rem;
    min-width: 180px;
  }

  @include mobile-lg {
    font-size: 1rem;
    min-width: 150px;
  }

  @include mobile {
    font-size: 0.9rem;
    min-width: 130px;
  }
}

.weekdays-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: $spacing-sm;
  width: 100%;
  max-width: 1200px;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
  }

  @include mobile {
    gap: 0.15rem;
  }
}

.weekday-name {
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: $color-accent;
  padding: $spacing-xs;

  @include mobile-lg {
    font-size: 0.7rem;
    padding: 0.15rem;
  }

  @include mobile {
    font-size: 0.65rem;
    padding: 0.1rem;
  }
}

.view-btn {
  padding: 0.6rem 1.25rem;
  background: transparent;
  border: none;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: #ccc;
    background: rgba($color-border-light, 0.5);
  }

  &.active {
    background: $color-accent;
    color: #fff;
  }

  @include mobile-lg {
    padding: $spacing-sm $spacing-md;
    font-size: 0.85rem;
  }

  @include mobile {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    border-radius: 6px;
  }
}
</style>

<style lang="scss">
@use '@/styles/variables' as *;

// Global styles for teleported content
.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-lg;

  @include mobile-lg {
    gap: $spacing-sm;
  }
}

.availability-legend {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: 0.4rem 0.75rem;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;
  font-size: 0.8rem;

  @include tablet {
    gap: $spacing-sm;
  }

  @include mobile-lg {
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.7rem;
  }

  @include mobile {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 0.2rem 0.5rem;
    padding: 0.25rem 0.4rem;
    font-size: 0.6rem;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;

  @include mobile-lg {
    gap: 0.2rem;
  }

  @include mobile {
    gap: 0.15rem;
  }
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid;

  .available & {
    background: #166534;
    border-color: $color-success;
  }

  .conditional & {
    background: #854d0e;
    border-color: $color-conditional;
  }

  .unavailable & {
    background: #991b1b;
    border-color: #f87171;
  }

  .unknown & {
    background: #444;
    border-color: #666;
  }

  @include mobile-lg {
    width: 10px;
    height: 10px;
  }

  @include mobile {
    width: 8px;
    height: 8px;
  }
}

.legend-label {
  color: $color-text-secondary;

  .available & {
    color: $color-success;
  }

  .conditional & {
    color: $color-conditional;
  }

  .unavailable & {
    color: #f87171;
  }
}

.edit-mode-btn {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 0.5rem 1rem;
  background: $color-bg-tertiary;
  border: 2px solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: $color-border-light;
    border-color: $color-accent;
    color: #fff;
  }

  &.active {
    background: rgba($color-success, 0.2);
    border-color: $color-success;
    color: $color-success;
  }

  .edit-icon {
    font-size: 1rem;
  }

  @include mobile-lg {
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    gap: $spacing-xs;

    .edit-label {
      display: none;
    }
  }
}
</style>

