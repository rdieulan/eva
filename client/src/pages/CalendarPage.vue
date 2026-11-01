<script setup lang="ts">
import { ref, computed, onMounted, provide, watch } from 'vue';
import CalendarTopBar from '@/components/calendar/layout/CalendarTopBar.vue';
import CalendarHeader from '@/components/calendar/layout/CalendarHeader.vue';
import CalendarBody from '@/components/calendar/layout/CalendarBody.vue';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';
import ScrimSelectionBar from '@/components/calendar/ScrimSelectionBar.vue';
import ScrimSearchModal from '@/components/calendar/ScrimSearchModal.vue';
import ScrimSearchViewerModal from '@/components/calendar/ScrimSearchViewerModal.vue';
import NoTeamMessage from '@/components/common/NoTeamMessage.vue';
import ErrorModal from '@/components/common/error/ErrorModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { useAuth } from '@/composables/useAuth';
import { useCalendar } from '@/composables/useCalendar';
import { useCalendarEvents } from '@/composables/useCalendarEvents';
import { useScrimSearches } from '@/composables/useScrimSearches';
import { useErrors } from '@/composables/useErrors';
import { fetchAllMaps, fetchPlayers, fetchVenues, fetchCurrentTeam } from '@/api';
import { computePlayerInitials } from '@/utils/players';
import { splitMatchmakingVenues, formatVenueLabel } from '@/utils/venues';
import { ERROR } from '@shared/constants';
import type { MapConfig, Player, Venue, ScrimSearch } from '@shared/types';

const { permissions, account } = useAuth();

// Error handling
const { errors, setErrors, setErrorFromException } = useErrors();
const showErrorModal = ref(false);

function handleError(errorMessages: string[]) {
  setErrors(errorMessages);
  showErrorModal.value = true;
}

// Check if teleport target exists (for SSR/test compatibility)
const teleportDisabled = ref(true);
onMounted(() => {
  teleportDisabled.value = !document.getElementById('topbar-dynamic-content');
});

// Use calendar composable
const {
  viewMode,
  calendarMode,
  currentYear,
  currentMonth,
  monthString,
  currentWeekStart,
  navigationTitle,
  days,
  isLoading,
  errors: calendarErrors,
  noTeam,
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
  playerId: computed(() => account.value?.playerId ?? undefined),
  onError: handleError,
});

// Use calendar events composable
const {
  showEventModal,
  selectedDate,
  editingEvent,
  viewerEvents,
  viewerInitialIndex,
  canCreateEvents,
  canEditEvents,
  canDeleteEvents,
  openEventViewer,
  closeEventViewer,
  openCreateEvent,
  editEventFromViewer,
  createEventFromViewer,
  submitEvent,
  removeEvent,
  updateGamePlan,
} = useCalendarEvents({
  canCreate: computed(() => permissions.value.calendar.canCreateEvents),
  canEdit: computed(() => permissions.value.calendar.canEditEvents),
  canDelete: computed(() => permissions.value.calendar.canDeleteEvents),
  reloadData: loadCalendarData,
  onError: handleError,
});

// Provide editMode and toggle function for TopBar
provide('calendarEditMode', editMode);
provide('toggleCalendarEditMode', toggleEditMode);

// Stable, roster-unique badge labels so players who share a first letter stay
// distinguishable in the availability pastilles. Derived from the loaded days
// (keyed by playerId) so it matches the ids the pastilles render with.
const playerLabels = computed<Record<string, string>>(() => {
  const roster = new Map<string, string>(); // playerId -> playerName
  for (const day of Object.values(days.value)) {
    for (const p of day?.playerAvailabilities ?? []) {
      if (!roster.has(p.playerId)) roster.set(p.playerId, p.playerName);
    }
  }
  return computePlayerInitials(
    [...roster].map(([playerId, playerName]) => ({ playerId, playerName }))
  );
});

// Maps and players for RotationCalculator
const maps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);

// Venues a match can be played in, and the one a new match defaults to
const venues = ref<Venue[]>([]);
const teamVenueId = ref<string | null>(null);
const teamFavoriteVenueIds = ref<string[]>([]);

// Matchmaking: the team's venues first, the rest of the network behind, and the one shown
const matchmakingVenues = computed(() =>
  splitMatchmakingVenues(venues.value, { venueId: teamVenueId.value, favoriteVenueIds: teamFavoriteVenueIds.value }),
);
const matchmakingVenueId = ref<string | null>(null);
const isMatchmaking = computed(() => calendarMode.value === 'matchmaking');

// Entering matchmaking lands on the team's venue, or the first one it can show
watch(isMatchmaking, entering => {
  if (!entering || matchmakingVenueId.value) return;
  matchmakingVenueId.value = matchmakingVenues.value.quick[0]?.id ?? matchmakingVenues.value.others[0]?.id ?? null;
});

const matchmakingVenue = computed(() => venues.value.find(venue => venue.id === matchmakingVenueId.value) ?? null);

// Teams looking for an opponent: at the shown venue in matchmaking, the team's own otherwise
const {
  byDate: scrimSearchesByDate,
  mine: ownScrimSearches,
  load: loadScrimSearches,
} = useScrimSearches({
  month: monthString,
  venueId: computed(() => (isMatchmaking.value ? matchmakingVenueId.value : null)),
  enabled: computed(() => !noTeam.value && (!isMatchmaking.value || matchmakingVenueId.value !== null)),
});

// Days picked for a search. Picking only makes sense with a venue to pick slots in.
const canSearchScrims = computed(() => canCreateEvents.value && matchmakingVenueId.value !== null);
const selectedDates = ref<string[]>([]);
const showScrimSearchModal = ref(false);

function toggleSelectedDate(date: string) {
  selectedDates.value = selectedDates.value.includes(date)
    ? selectedDates.value.filter(selected => selected !== date)
    : [...selectedDates.value, date];
}

function clearSelectedDates() {
  selectedDates.value = [];
}

// A selection belongs to one venue and one view of the month
watch([isMatchmaking, matchmakingVenueId, monthString], clearSelectedDates);

function handleScrimSearchesOpened() {
  clearSelectedDates();
  loadScrimSearches();
}

// The search being looked at, from a cell
const viewedScrimSearch = ref<ScrimSearch | null>(null);

const viewedSearchVenueLabel = computed(() => {
  const venue = venues.value.find(candidate => candidate.id === viewedScrimSearch.value?.venueId);
  return venue ? formatVenueLabel(venue) : null;
});

// Initial load
onMounted(async () => {
  // Load what the event form and the RotationCalculator need (in parallel with calendar)
  try {
    const [loadedMaps, loadedPlayers, loadedVenues, team] = await Promise.all([
      fetchAllMaps(),
      fetchPlayers(),
      fetchVenues(),
      fetchCurrentTeam(),
    ]);
    maps.value = loadedMaps;
    players.value = loadedPlayers;
    venues.value = loadedVenues;
    teamVenueId.value = team?.venueId ?? null;
    teamFavoriteVenueIds.value = team?.favoriteVenueIds ?? [];
  } catch (err) {
    console.error('Error loading maps/players/venues:', err);
    setErrorFromException(err, ERROR.serverError);
    showErrorModal.value = true;
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
        :matchmaking="isMatchmaking"
        @toggle-edit-mode="toggleEditMode"
      />
    </Teleport>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement du calendrier...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="calendarErrors.length > 0" class="error-state">
      <ErrorDisplay :errors="calendarErrors" />
      <button class="btn-retry" @click="loadCalendarData">Réessayer</button>
    </div>

    <!-- No team state -->
    <NoTeamMessage v-else-if="noTeam" />

    <!-- Calendar -->
    <template v-else>
      <!-- Calendar controls -->
      <CalendarHeader
        v-model:venue-id="matchmakingVenueId"
        :view-mode="viewMode"
        :calendar-mode="calendarMode"
        :navigation-title="navigationTitle"
        :quick-venues="matchmakingVenues.quick"
        :other-venues="matchmakingVenues.others"
        :can-search="canSearchScrims"
        @update:view-mode="viewMode = $event"
        @update:calendar-mode="calendarMode = $event"
        @prev="goToPrev"
        @next="goToNext"
      />

      <!-- Scrollable calendar content -->
      <div class="calendar-content">
        <CalendarBody
          :view-mode="viewMode"
          :year="currentYear"
          :month="currentMonth"
          :week-start="currentWeekStart"
          :days="days"
          :edit-mode="editMode"
          :matchmaking="isMatchmaking"
          :scrim-searches="scrimSearchesByDate"
          :selectable="canSearchScrims"
          :selected-dates="selectedDates"
          :player-labels="playerLabels"
          @prev-month="goToPrevMonth"
          @next-month="goToNextMonth"
          @prev-week="goToPrevWeek"
          @next-week="goToNextWeek"
          @set-availability="setAvailability"
          @open-event-viewer="openEventViewer"
          @open-create-event="openCreateEvent"
          @toggle-select="toggleSelectedDate"
          @open-search="viewedScrimSearch = $event"
        />
      </div>

      <ScrimSelectionBar
        :count="selectedDates.length"
        @search="showScrimSearchModal = true"
        @clear="clearSelectedDates"
      />
    </template>

    <!-- Put the picked days up for an opponent -->
    <ScrimSearchModal
      :open="showScrimSearchModal"
      :venue="matchmakingVenue"
      :dates="selectedDates"
      :days="days"
      :own-searches="ownScrimSearches"
      @close="showScrimSearchModal = false"
      @opened="handleScrimSearchesOpened"
    />

    <!-- A search picked in a cell -->
    <ScrimSearchViewerModal
      :search="viewedScrimSearch"
      :venue-label="viewedSearchVenueLabel"
      :can-withdraw="(viewedScrimSearch?.isMine ?? false) && canCreateEvents"
      @close="viewedScrimSearch = null"
      @withdrawn="loadScrimSearches"
    />

    <!-- Event viewer modal -->
    <EventViewerModal
      :events="viewerEvents"
      :initial-index="viewerInitialIndex"
      :can-create="canCreateEvents"
      :can-edit="canEditEvents"
      :can-delete="canDeleteEvents"
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
      :can-create="canCreateEvents"
      :can-edit="canEditEvents"
      :can-delete="canDeleteEvents"
      :can-attach-game-plan="permissions.calendar.canAttachGamePlan"
      :maps="maps"
      :players="players"
      :venues="venues"
      :team-venue-id="teamVenueId"
      @close="showEventModal = false"
      @submit="submitEvent"
      @delete="removeEvent"
      @update-gameplan="updateGamePlan"
    />

    <!-- Error Modal -->
    <ErrorModal
      :open="showErrorModal"
      :errors="errors"
      @close="showErrorModal = false"
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
  background: linear-gradient(135deg, $color-bg-secondary 0%, $color-bg-tertiary 100%);
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
  color: $color-text-muted;
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

  // Hide scrollbar but keep scroll functionality
  scrollbar-width: none; // Firefox
  -ms-overflow-style: none; // IE/Edge
  &::-webkit-scrollbar {
    display: none; // Chrome/Safari/Opera
  }

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

