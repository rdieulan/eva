<script setup lang="ts">
import { ref, computed, nextTick, onMounted, provide, watch } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import CalendarTopBar from '@/components/calendar/layout/CalendarTopBar.vue';
import CalendarHeader from '@/components/calendar/layout/CalendarHeader.vue';
import CalendarBody from '@/components/calendar/layout/CalendarBody.vue';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import EventViewerModal from '@/components/calendar/EventViewerModal.vue';
import ScrimSelectionBar from '@/components/calendar/ScrimSelectionBar.vue';
import ScrimSearchModal from '@/components/calendar/ScrimSearchModal.vue';
import ScrimSearchViewerModal from '@/components/calendar/ScrimSearchViewerModal.vue';
import DayAgendaModal, { type DayAgenda } from '@/components/calendar/DayAgendaModal.vue';
import AvailabilityWheel, { type WheelOpening } from '@/components/calendar/AvailabilityWheel.vue';
import AvailabilityHoursModal from '@/components/calendar/AvailabilityHoursModal.vue';
import NoTeamMessage from '@/components/common/NoTeamMessage.vue';
import ErrorModal from '@/components/common/error/ErrorModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { useAuth } from '@/composables/useAuth';
import { useCalendar } from '@/composables/useCalendar';
import { useCalendarEvents } from '@/composables/useCalendarEvents';
import { useScrimSearches } from '@/composables/useScrimSearches';
import { useErrors } from '@/composables/useErrors';
import { fetchAllMaps, fetchPlayers, fetchVenues, fetchCurrentTeam, updateTeam } from '@/api';
import { groupMatchmakingVenues } from '@/utils/venues';
import { searchVenueIds } from '@/utils/scrims';
import { ERROR, SCRIM_SEARCH_VENUES_MAX, TEAM_FAVORITE_VENUES_MAX } from '@shared/constants';
import type { AvailabilityHours, AvailabilityStatus, CalendarEvent, MapConfig, Player, Venue, ScrimSearch } from '@shared/types';

const { permissions, account } = useAuth();
const route = useRoute();
const router = useRouter();

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
  goToDate,
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

// Edit mode: the wheel of the reader's answer for a day, then, from its hub,
// the hours of a partial availability
const wheel = ref<WheelOpening | null>(null);
const hoursDate = ref<string | null>(null);

function pickAvailability(status: AvailabilityStatus | null) {
  const date = wheel.value?.date;
  wheel.value = null;
  if (date) setAvailability(date, status);
}

function openHours() {
  hoursDate.value = wheel.value?.date ?? null;
  wheel.value = null;
}

function saveHours(hours: AvailabilityHours) {
  const date = hoursDate.value;
  hoursDate.value = null;
  if (date) setAvailability(date, 'PARTIAL', hours);
}

// Maps and players for RotationCalculator
const maps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);

// Venues a match can be played in, and the one a new match defaults to
const venues = ref<Venue[]>([]);
const teamVenueId = ref<string | null>(null);
const teamFavoriteVenueIds = ref<string[]>([]);

// Matchmaking: the team's affiliated venue, its favorites, the rest of the
// network, and the venues ticked in the menu
const matchmakingVenues = computed(() =>
  groupMatchmakingVenues(venues.value, { venueId: teamVenueId.value, favoriteVenueIds: teamFavoriteVenueIds.value }),
);
const matchmakingVenueIds = ref<string[]>([]);
const isMatchmaking = computed(() => calendarMode.value === 'matchmaking');

// Entering matchmaking lands on the team's venue, or the first one it can show
watch(isMatchmaking, entering => {
  if (!entering || matchmakingVenueIds.value.length) return;
  const { affiliated, favorites, others } = matchmakingVenues.value;
  const first = affiliated ?? favorites[0] ?? others[0];
  matchmakingVenueIds.value = first ? [first.id] : [];
});

// The ticked venues in the order of the menu, the order a search offers them in
const selectedVenues = computed(() => {
  const { affiliated, favorites, others } = matchmakingVenues.value;
  return [...(affiliated ? [affiliated] : []), ...favorites, ...others]
    .filter(venue => matchmakingVenueIds.value.includes(venue.id));
});

// A star in the venue menu: the venue joins the team's favorites, last, or
// leaves them. The menu reorders at once; a refusal puts it back.
const canEditFavorites = computed(() => permissions.value.team.canManageTeam);
const favoritesFull = computed(() => teamFavoriteVenueIds.value.length >= TEAM_FAVORITE_VENUES_MAX);
const savingFavorites = ref(false);

async function toggleFavoriteVenue(venueId: string) {
  if (savingFavorites.value) return;
  const before = teamFavoriteVenueIds.value;
  teamFavoriteVenueIds.value = before.includes(venueId) ? before.filter(id => id !== venueId) : [...before, venueId];
  savingFavorites.value = true;
  try {
    const saved = await updateTeam({ favoriteVenueIds: teamFavoriteVenueIds.value });
    teamFavoriteVenueIds.value = saved.favoriteVenueIds;
  } catch (err) {
    teamFavoriteVenueIds.value = before;
    setErrorFromException(err, ERROR.teamUpdateFailed);
    showErrorModal.value = true;
  } finally {
    savingFavorites.value = false;
  }
}

// Teams looking for an opponent: ours wherever they are, and in matchmaking
// every other team's in the ticked venues
const {
  byDate: scrimSearchesByDate,
  status: scrimSearchesStatus,
  load: loadScrimSearches,
} = useScrimSearches({
  month: monthString,
  venueIds: computed(() => (isMatchmaking.value ? matchmakingVenueIds.value : null)),
  enabled: computed(() => !noTeam.value && (!isMatchmaking.value || matchmakingVenueIds.value.length > 0)),
});

// Days picked for a search. Picking only makes sense with venues to pick slots in.
const canSearchScrims = computed(() => permissions.value.matchmaking.canSearch && matchmakingVenueIds.value.length > 0);
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

// A selection belongs to one view of the month; the venues can change under it,
// as long as one at least is left to offer slots in
watch([isMatchmaking, monthString], clearSelectedDates);
watch(matchmakingVenueIds, ids => {
  if (!ids.length) clearSelectedDates();
});

function handleScrimSearchesOpened() {
  clearSelectedDates();
  loadScrimSearches();
}

// A proposal was sent, answered or withdrawn; an accepted one also put a match in the calendar
function handleScrimSearchChanged({ matched }: { matched: boolean }) {
  loadScrimSearches();
  if (matched) loadCalendarData();
}

// A match of the matchmaking called off from its sheet: both calendars lost
// it, and a search still open got its time back
function handleMatchCancelled() {
  closeEventViewer();
  loadCalendarData();
  loadScrimSearches();
}

// The search being looked at, from a cell, or from the search modal over which it opens
const viewedScrimSearch = ref<ScrimSearch | null>(null);

// Our own search being changed, from its sheet: the search modal opens on it,
// in place of the sheet
const editedScrimSearch = ref<ScrimSearch | null>(null);

// The venues of the search being changed first, then the ticked ones, as many as a search takes
const editedSearchVenues = computed<Venue[]>(() => {
  const search = editedScrimSearch.value;
  if (!search) return [];
  const ids = [...new Set([...searchVenueIds(search), ...matchmakingVenueIds.value])].slice(0, SCRIM_SEARCH_VENUES_MAX);
  return ids.flatMap(id => venues.value.filter(venue => venue.id === id));
});

function editScrimSearch(search: ScrimSearch) {
  viewedScrimSearch.value = null;
  editedScrimSearch.value = search;
  showScrimSearchModal.value = true;
}

function closeScrimSearchModal() {
  showScrimSearchModal.value = false;
  editedScrimSearch.value = null;
}


// A day listed whole, from the row of a cell that counts what the cell leaves
// out. It reads the day as the calendar does: the searches alone in
// matchmaking, what is planned besides in the team's view.
const agendaDate = ref<string | null>(null);

const agendaDay = computed<DayAgenda | null>(() => {
  const date = agendaDate.value;
  if (!date) return null;
  const searches = scrimSearchesByDate.value[date] ?? [];
  if (isMatchmaking.value) return { date, searches, events: [], renewals: [] };
  return { date, searches, events: days.value[date]?.events ?? [], renewals: days.value[date]?.renewals ?? [] };
});

// What the team planned on the day of the search being looked at: an answer
// picks its hours around it
const viewedSearchPlans = computed(() =>
  viewedScrimSearch.value ? days.value[viewedScrimSearch.value.date]?.events ?? [] : [],
);

// A row of the list opens what it shows, in place of the list
function openSearchFromAgenda(search: ScrimSearch) {
  agendaDate.value = null;
  viewedScrimSearch.value = search;
}

function openEventsFromAgenda(events: CalendarEvent[], initialIndex: number) {
  agendaDate.value = null;
  openEventViewer(events, initialIndex);
}

// A notification or a venue's public board leads here with the day to show,
// the mode, a venue to tick and what to open (see calendarRoute). The link is
// followed once the venues are known; what it opens, once the calendar has
// loaded that day.
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const pendingOpen = ref<{ date: string; kind: 'scrimSearch' | 'event'; id: string } | null>(null);

function queryText(value: LocationQuery[string] | undefined): string | null {
  return typeof value === 'string' && value ? value : null;
}

async function followLink(query: LocationQuery) {
  const date = queryText(query.date);
  if (!date || !DAY_PATTERN.test(date)) return;
  // Followed once: a reload of the page stays where the reader is
  router.replace({ query: {} });

  calendarMode.value = query.mode === 'matchmaking' ? 'matchmaking' : 'team';
  const venueId = queryText(query.venue);
  if (venueId && venues.value.some(venue => venue.id === venueId) && !matchmakingVenueIds.value.includes(venueId)) {
    matchmakingVenueIds.value = [...matchmakingVenueIds.value, venueId].slice(-SCRIM_SEARCH_VENUES_MAX);
  }
  goToDate(date);

  const searchId = queryText(query.search);
  const eventId = queryText(query.event);
  pendingOpen.value = searchId
    ? { date, kind: 'scrimSearch', id: searchId }
    : eventId ? { date, kind: 'event', id: eventId } : null;
  // The reloads the month, the mode or the venues set off start with the watchers
  await nextTick();
  openPending();
}

// Open what a link asked for once its day is loaded; gone since, nothing opens
function openPending() {
  const target = pendingOpen.value;
  if (!target) return;
  if (target.kind === 'scrimSearch') {
    if (scrimSearchesStatus.value === 'loading') return;
    pendingOpen.value = null;
    const search = scrimSearchesByDate.value[target.date]?.find(candidate => candidate.id === target.id);
    if (search) viewedScrimSearch.value = search;
    return;
  }
  if (isLoading.value || !days.value[target.date]) return;
  pendingOpen.value = null;
  const events = days.value[target.date]!.events;
  const index = events.findIndex(event => event.id === target.id);
  if (index >= 0) openEventViewer(events, index);
}

watch([scrimSearchesStatus, isLoading], openPending);
watch(() => route.query, query => {
  void followLink(query);
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

  await followLink(route.query);
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
        v-model:venue-ids="matchmakingVenueIds"
        :view-mode="viewMode"
        :calendar-mode="calendarMode"
        :navigation-title="navigationTitle"
        :venues="matchmakingVenues"
        :can-edit-favorites="canEditFavorites"
        :favorites-full="favoritesFull"
        :saving-favorites="savingFavorites"
        :can-search="canSearchScrims"
        @update:view-mode="viewMode = $event"
        @update:calendar-mode="calendarMode = $event"
        @toggle-favorite="toggleFavoriteVenue"
        @prev="goToPrev"
        @next="goToNext"
      />

      <!-- Scrollable calendar content -->
      <div class="calendar-content" :class="{ 'has-selection-bar': selectedDates.length > 0 }">
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
          :current-player-id="account?.playerId ?? undefined"
          @prev-month="goToPrevMonth"
          @next-month="goToNextMonth"
          @prev-week="goToPrevWeek"
          @next-week="goToNextWeek"
          @open-availability="wheel = $event"
          @open-event-viewer="openEventViewer"
          @open-create-event="openCreateEvent"
          @toggle-select="toggleSelectedDate"
          @open-search="viewedScrimSearch = $event"
          @open-day="agendaDate = $event"
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
      :venues="editedScrimSearch ? editedSearchVenues : selectedVenues"
      :dates="selectedDates"
      :days="days"
      :searches="scrimSearchesByDate"
      :editing="editedScrimSearch"
      :can-propose="permissions.matchmaking.canPropose"
      @close="closeScrimSearchModal"
      @opened="handleScrimSearchesOpened"
      @saved="loadScrimSearches"
      @open-search="viewedScrimSearch = $event"
    />

    <!-- The reader's answer for a day, picked on a wheel; its hours from the hub -->
    <AvailabilityWheel
      v-if="wheel"
      :opening="wheel"
      :status="days[wheel.date]?.currentPlayerStatus ?? null"
      :hours="days[wheel.date]?.currentPlayerHours ?? null"
      @pick="pickAvailability"
      @hours="openHours"
      @close="wheel = null"
    />
    <AvailabilityHoursModal
      :open="hoursDate !== null"
      :date="hoursDate"
      :hours="hoursDate ? days[hoursDate]?.currentPlayerHours ?? null : null"
      @save="saveHours"
      @close="hoursDate = null"
    />

    <!-- A day whose rows ran over, listed whole -->
    <DayAgendaModal
      :day="agendaDay"
      @close="agendaDate = null"
      @open-search="openSearchFromAgenda"
      @open-event-viewer="openEventsFromAgenda"
    />

    <!-- A search picked in a cell, or answered from the search modal -->
    <ScrimSearchViewerModal
      :search="viewedScrimSearch"
      :venues="venues"
      :planned-events="viewedSearchPlans"
      :can-search="permissions.matchmaking.canSearch"
      :can-propose="permissions.matchmaking.canPropose"
      :can-respond="permissions.matchmaking.canRespond"
      @close="viewedScrimSearch = null"
      @changed="handleScrimSearchChanged"
      @edit="editScrimSearch"
    />

    <!-- Event viewer modal -->
    <EventViewerModal
      :events="viewerEvents"
      :initial-index="viewerInitialIndex"
      :can-create="canCreateEvents"
      :can-edit="canEditEvents"
      :can-delete="canDeleteEvents"
      :can-cancel-match="permissions.matchmaking.canRespond"
      :selected-date="viewerEvents[0]?.date"
      @close="closeEventViewer"
      @edit-event="editEventFromViewer"
      @create-event="createEventFromViewer"
      @match-cancelled="handleMatchCancelled"
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
  @include surface-gradient;
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
  border: $border-thin solid $color-border-light;
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

  // Room under the last week for the floating selection bar: the content
  // scrolls clear of it, so the bar never hides a day
  &.has-selection-bar {
    padding-bottom: 5rem;
  }

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

