<script setup lang="ts" generic="T extends DayRowItem">
import { computed, ref } from 'vue';
import type {
  AvailabilityHours,
  AvailabilityStatus,
  PlayerAvailability,
  DayRowItem,
  SubscriptionRenewal,
  ScrimSearch,
  VenueEventView,
} from '@shared/types';
import { describeTeamAvailability, getTeamAvailabilityClass } from '@/utils/availability';
import { sortEventsByTime } from '@/utils/calendar';
import { assessTeamAvailability, formatAvailabilityHours } from '@shared/utils';
import DayItems from '@/components/calendar/DayItems.vue';
import DayCellCorner from '@/components/calendar/DayCellCorner.vue';
import DayCellMark from '@/components/calendar/DayCellMark.vue';
import DayCellRoster from '@/components/calendar/DayCellRoster.vue';
import type { WheelOpening } from '@/components/calendar/AvailabilityWheel.vue';
import { useCornerClearance } from '@/composables/useCornerClearance';
import { useWheelPress } from '@/composables/useWheelPress';

// A day of the calendar, in two readings.
// Normal: one colour answers "what can we do that day?", the team's lineup.
// The rows are what is planned in the team's view, and the other teams
// looking for an opponent in matchmaking, nothing of ours there: our events
// stay in the team's view. Bottom left is ours, in both views: the mark of a
// day picked for a search, or of our own search that day.
// Edit mode: the day opens the wheel of the reader's answer, and the whole
// card lists who said what, name by name.
// A venue's day (see VenueCalendar) is neither: no team, so no lineup nor
// reader, only what is planned in the venue, which it opens.
interface Props {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  currentPlayerStatus: AvailabilityStatus | null;
  currentPlayerHours?: AvailabilityHours | null; // The reader's hours, when available on part of the day
  currentPlayerId?: string; // Leaves the reader out of the roster: the cell already shows their status
  playerAvailabilities: PlayerAvailability[];
  events: T[]; // What is planned: the team's events, or what is planned in the venue
  renewals?: SubscriptionRenewal[]; // Players whose subscription renews that day
  venueEvents?: VenueEventView[]; // The events of the team's venue, open to all, the team has not added
  showDayNumber?: boolean;
  editMode?: boolean; // Availability edit mode
  matchmaking?: boolean; // Days can be picked for a search, and carry other teams' searches
  scrimSearches?: ScrimSearch[]; // The searches of that day: ours, and in matchmaking the other teams'
  selectable?: boolean; // Matchmaking: clicking the day picks it for a search
  selected?: boolean;
  venue?: boolean; // A day of a venue's calendar, read by no team
}

const props = withDefaults(defineProps<Props>(), {
  currentPlayerHours: null,
  currentPlayerId: undefined,
  renewals: () => [],
  venueEvents: () => [],
  showDayNumber: true,
  editMode: false,
  matchmaking: false,
  scrimSearches: () => [],
  selectable: false,
  selected: false,
  venue: false,
});

const emit = defineEmits<{
  'open-availability': [opening: WheelOpening]; // Edit mode: the wheel of the reader's answer for the day
  'open-event-viewer': [events: T[], initialIndex: number];
  'open-create-event': [date: string];
  'toggle-select': [date: string];
  'open-search': [search: ScrimSearch];
  'open-venue-event': [event: VenueEventView];
  'open-day': [date: string]; // The day's rows ran over: list the whole day
}>();

const sortedEvents = computed(() => sortEventsByTime(props.events));

// Check if there are events
const hasEvents = computed(() => props.events.length > 0);

// Our own search that day, and the other teams'
const ownSearch = computed(() => props.scrimSearches.find(search => search.isMine) ?? null);
const otherSearches = computed(() => props.scrimSearches.filter(search => !search.isMine));

// What the rows show: the other teams in matchmaking, what is planned in the
// team's view
const rowSearches = computed(() => (props.matchmaking ? otherSearches.value : []));
const rowEvents = computed(() => (props.matchmaking ? [] : props.events));
const rowRenewals = computed(() => (props.matchmaking ? [] : props.renewals));
const rowVenueEvents = computed(() => (props.matchmaking ? [] : props.venueEvents));

// A day to pick for a search: matchmaking, a reader who may search, a day to
// come, and no search of ours already that day, one being the most a day holds
const canPick = computed(() => props.matchmaking && props.selectable && !props.isPast && !ownSearch.value);

// A day shows five rows at most, the height every day has whatever it holds,
// so the grid never moves from one week to the next nor when the reading
// changes. A day with something of ours to mark, or that can be picked, gives
// the last of them to its mark, picked or not, so nothing moves on click.
// When the rows run over, the last one says how many are left out and lists
// the whole day.
const ROW_LIMIT = 5;

// Can the team line up that day, and when? The one colour of the cell in normal reading.
const teamAvailability = computed(() => assessTeamAvailability(props.playerAvailabilities));

const lineupTitle = computed(() => describeTeamAvailability(teamAvailability.value));

// A lineup on part of the day only: the hours it meets, bottom left, unless
// something of ours already holds that place. The end of the hours goes first
// on a narrow day, then the hours, leaving the clock (see DayCellMark).
const windowMark = computed(() => {
  const { status, window } = teamAvailability.value;
  if (props.editMode || props.isPast || !props.isCurrentMonth || props.selected || ownSearch.value) return null;
  if (status !== 'shaky' || !window) return null;
  return window.startTime && window.endTime
    ? { main: window.startTime, end: ` – ${window.endTime}` }
    : { main: formatAvailabilityHours(window), end: null };
});

const rowLimit = computed(() => (canPick.value || ownSearch.value || windowMark.value ? ROW_LIMIT - 1 : ROW_LIMIT));

// The cell, fill and border, is the team's lineup, in both readings; neutral
// while the lineup hangs on players who have not answered. The reader's own
// status sits in the corner. A day outside the month has no verdict: its
// availabilities are not loaded, and an empty roster would read as a day the
// team cannot use.
const cellStatusClass = computed(() => {
  if (props.isPast) return 'status-past';
  if (!props.isCurrentMonth || props.venue) return '';
  return teamAvailability.value.status === 'unknown' ? 'availability--unset' : getTeamAvailabilityClass(teamAvailability.value.status);
});

// Click on cell. In edit mode the press opens the wheel instead (below).
function handleCellClick() {
  if (props.editMode) return;
  if (props.matchmaking) {
    // Matchmaking: a day we already search opens our search; another day joins
    // (or leaves) the days to put up for an opponent. Our events are read in
    // the team's view.
    if (ownSearch.value) emit('open-search', ownSearch.value);
    else if (canPick.value) emit('toggle-select', props.date);
  } else if (hasEvents.value) {
    // With events: open event viewer (even for past days)
    emit('open-event-viewer', sortedEvents.value, 0);
  } else if (!props.isPast && !props.matchmaking && !props.venue) {
    // Team mode without events: emit to open create modal (for admins, not past)
    emit('open-create-event', props.date);
  }
}

// The rows and names reaching the corner stop before it: their room is
// measured once laid out (see useCornerClearance)
const cellRef = ref<HTMLElement | null>(null);
useCornerClearance(cellRef);

// Edit mode: a press on a day to come opens the wheel of the reader's answer
const { onPressStart } = useWheelPress({
  enabled: () => props.editMode && !props.isPast && props.isCurrentMonth,
  open: (x, y, dragging) => emit('open-availability', { date: props.date, x, y, dragging }),
});
</script>

<template>
  <div
    ref="cellRef"
    class="day-cell"
    :class="[
      cellStatusClass,
      {
        'other-month': !isCurrentMonth,
        'is-today': isToday,
        'is-past': isPast,
        'has-events': hasEvents,
        'edit-mode': editMode,
        'matchmaking': matchmaking,
        'is-selectable': canPick,
        'is-selected': selected,
        'venue-day': venue,
      }
    ]"
    :title="!editMode && !isPast && isCurrentMonth && !venue ? lineupTitle : undefined"
    @click="handleCellClick"
    @pointerdown="onPressStart"
  >
    <!-- The day, large and faint, behind everything -->
    <span v-if="props.showDayNumber" class="day-number" aria-hidden="true">{{ dayNumber }}</span>

    <!-- The reader's own status: a coloured corner with its symbol. Not on a
         day outside the month: its availabilities are not loaded, so there is
         nothing to say, and a "?" would read as an unanswered day -->
    <DayCellCorner v-if="!isPast && isCurrentMonth && !venue" :status="currentPlayerStatus" :hours="currentPlayerHours" />

    <!-- Ours, bottom left: the day picked for a search, our own search, or when a partial lineup meets -->
    <DayCellMark
      :selected="selected"
      :search="editMode ? null : ownSearch"
      :lineup-hours="windowMark"
      :lineup-title="lineupTitle"
      @open-search="search => emit('open-search', search)"
    />

    <!-- Edit mode: who said what, the most available first; the reader is the
         corner. Normal reading: what is planned. The two cross-fade. -->
    <Transition name="reading">
      <DayCellRoster
        v-if="editMode && !isPast"
        key="roster"
        :date="date"
        :availabilities="playerAvailabilities"
        :reader-id="currentPlayerId"
      />

      <div v-else key="items" class="items">
        <DayItems
          :searches="rowSearches"
          :events="rowEvents"
          :renewals="rowRenewals"
          :venue-events="rowVenueEvents"
          :limit="rowLimit"
          @open-search="search => emit('open-search', search)"
          @open-venue-event="venueEvent => emit('open-venue-event', venueEvent)"
          @open-event-viewer="(dayEvents, index) => emit('open-event-viewer', dayEvents, index)"
          @open-day="emit('open-day', date)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.day-cell {
  position: relative;
  min-width: 0; // Prevent overflow in grid
  // Its width sizes the corner while the reader edits (see DayCellCorner)
  container: day-cell / inline-size;
  // Padding and corner, stated once: the content reads them to keep clear of
  // the corner. The triangle has legs of `notch` and sits `rim` away from the
  // edges of the day, the share of the padding the theme asks for. Both are
  // whole pixels: the browser lays the face and the walls of the triangle on
  // the pixel grid but leaves the clip that rounds its vertex where it is, so
  // a fraction of a pixel would let that clip cut into the walls, 1px wide on
  // one day and 2px on the next, or make the gap a pixel wider on one edge
  // than on the other. The box of the corner, where the content does not go,
  // adds the rim on the three sides of the triangle: legs longer by
  // rim × (2 + √2).
  --pad: #{$spacing-sm};
  --notch: round(#{$corner-size}, 1px);
  --rim: round(calc(var(--pad) * #{$corner-rim}), 1px);
  --corner-leg: calc(var(--notch) + var(--rim) * 3.414);
  // The metrics of a row, and the height of the day: room for five rows,
  // whatever the day holds and whatever the reading (see ROW_LIMIT)
  --row-font: 0.75rem;
  --row-pad-y: 2px;
  --row-pad-x: 4px;
  --row-gap: 2px;
  --row-h: calc(var(--row-font) * 1.3 + var(--row-pad-y) * 2);
  --mark: var(--row-h); // Side of the selection mark of matchmaking, which takes the place of a row
  height: calc(var(--pad) * 2 + var(--cell-border) * 2 + var(--row-h) * 5 + var(--row-gap) * 4);
  padding: var(--pad);
  // Radius and border of the cell, read by the corner to follow its curve
  --cell-radius: #{$radius-md};
  --cell-border: #{$surface-border-width};
  border-radius: var(--cell-radius);
  cursor: pointer;
  transition: background 0.15s ease-out, border-color 0.15s ease-out;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  // Relief, where the theme has one, by kind of day: idle unless the team
  // can use it (raised, below) or it lies outside the month (sunken, below).
  // Kept in a custom property so the rings of today and of a picked day can
  // sit on top of it.
  --cell-elevation: #{$elevation-idle};
  --cell-tint: #{$surface-idle-tint};
  --cell-color: #{$day-number-ink}; // The day's own colour, read by the number; neutral until a lineup sets it
  // The corner takes the set the theme gives the kind of day
  --corner-cast: #{$corner-idle-cast};
  --corner-wall-bottom: #{$corner-idle-wall-bottom};
  --corner-wall-right: #{$corner-idle-wall-right};
  --corner-wall-diagonal: #{$corner-idle-wall-diagonal};
  --corner-face-shade: #{$corner-idle-face};
  --corner-face-filter: #{$corner-idle-face-filter};
  box-shadow: var(--cell-elevation);
  background-image: linear-gradient(var(--cell-tint)), $texture-bg;

  &.team-availability--ready,
  &.team-availability--shaky,
  &.team-availability--voice {
    --cell-elevation: #{$elevation-raised};
    --cell-tint: #{$surface-raised-tint};
    --corner-cast: #{$corner-raised-cast};
    --corner-wall-bottom: #{$corner-raised-wall-bottom};
    --corner-wall-right: #{$corner-raised-wall-right};
    --corner-wall-diagonal: #{$corner-raised-wall-diagonal};
    --corner-face-shade: #{$corner-raised-face};
    --corner-face-filter: #{$corner-raised-face-filter};
  }
  background-color: $surface-idle-fill; // The days the team can use set their own colour below
  border: var(--cell-border) solid $color-bg-tertiary;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;

  &:hover {
    background-color: $color-bg-tertiary;
    border-color: $color-border-light;
  }

  // The team's lineup, fill and border; neutral while the lineup hangs on silent players
  @each $status, $color in $team-availability-colors {
    &.team-availability--#{$status} {
      --cell-color: #{$color};
      background-color: with-alpha($color, 0.14);
      border-color: with-alpha($color, 0.5);

      &:hover {
        background-color: with-alpha($color, 0.22);
        border-color: with-alpha($color, 0.8);
      }
    }
  }

  &.status-past {
    --corner-leg: 0px; // No corner: nothing to keep clear of
    background-color: with-alpha($color-bg-primary, 0.7);
    border-color: with-alpha($color-border, 0.4);
    cursor: default;

    .items {
      opacity: 0.45;
    }
  }

  &.other-month {
    --corner-leg: 0px; // No corner: nothing to keep clear of
    background-color: with-alpha($color-bg-primary, 0.6);
    border-color: with-alpha($color-border, 0.2);
    cursor: default;
    pointer-events: none;
    --cell-elevation: #{$elevation-sunken};
    --cell-tint: #{$surface-sunken-tint};

    .items,
    .roster {
      opacity: 0.4;
    }

    &:hover {
      background-color: with-alpha($color-bg-primary, 0.6);
    }
  }

  // A venue's day: no reader, so no corner to keep clear of; a day with
  // nothing planned opens nothing
  &.venue-day {
    --corner-leg: 0px;

    &:not(.has-events) {
      pointer-events: none;
    }
  }

  // Today: an accent ring; the large day number takes the accent too (see .day-number)
  &.is-today {
    box-shadow: 0 0 0 2px $color-accent, var(--cell-elevation);
  }

  // A day that can be picked keeps its last row for the selection mark,
  // picked or not, so nothing moves on click (see ROW_LIMIT)
  &.is-selectable {
    cursor: pointer;
  }

  // A picked day stands out by light, not by colour
  &.is-selected {
    border-color: with-alpha($color-white, 0.85);
    box-shadow: inset 0 0 0 2px with-alpha($color-white, 0.85), var(--cell-elevation);
  }

  @include tablet {
    --pad: 0.4rem;
    --row-font: 0.7rem;
    gap: $spacing-xs;
  }

  @include mobile-lg {
    --pad: 0.3rem;
    --row-font: 0.6rem;
    --row-pad-y: 1px;
    --row-pad-x: 2px;
    --notch: round(calc(#{$corner-size} * 2 / 3), 1px);
    gap: 0.2rem;
    // A tighter curve, never rounder than the theme's own; set on the
    // property the corner reads, so its rounded vertex keeps following it
    --cell-radius: min(#{$radius-md}, 6px);
  }

  @include mobile {
    --pad: 0.2rem;
    --row-font: 0.55rem;
    --row-gap: 1px;
    gap: 0.15rem;
    --cell-radius: #{$radius-sm};
    --cell-border: min(#{$surface-border-width}, 1px);
  }
}

// The day, written large and faint behind the content; the accent for today
.day-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.2rem;
  font-weight: 900;
  line-height: 1;
  // The neutral ink, or as much of the day's own colour as the theme wants
  color: color-mix(in srgb, var(--cell-color) #{$day-number-tint}, #{$day-number-ink});
  pointer-events: none;
  z-index: 0;

  .is-today & {
    color: with-alpha($color-accent, 0.4);
  }

  @include tablet {
    font-size: 2.6rem;
  }

  @include mobile-lg {
    font-size: 2rem;
  }

  @include mobile {
    font-size: 1.6rem;
  }
}

// What is planned, a row per item (see DayItems), sized by the metrics of the
// day
.items {
  display: block;
  position: relative;
  z-index: 1;
  overflow: hidden;
  flex: 1;

  // The rows reaching the corner, the last ones of a busy day, end on a bevel
  // parallel to its hypotenuse, a hair away from it: one diagonal clip over
  // the bottom-right of the list, whatever the rows. At the bottom of the
  // list the hypotenuse is corner − 2 × padding in from the right edge. The
  // content of those rows stops before it on its own (see
  // useCornerClearance); the clip trims what has no edge of its own, the
  // light of a hover.
  --cut: max(0px, calc(var(--corner-leg) - var(--pad) * 2 + 3px));
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%);
}

// Starting or stopping the edit, the roster and the rows cross-fade while the
// corner changes size. The list leaving lies over the other's place instead
// of pushing it down, so the one coming is laid out, and measured against the
// corner, where it stays.
.reading-enter-active {
  transition: opacity 0.2s ease-out 0.06s;
}

.reading-leave-active {
  position: absolute;
  inset: var(--pad);
  transition: opacity 0.12s ease-in;
}

.reading-enter-from,
.reading-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .reading-enter-active,
  .reading-leave-active {
    transition: none;
  }
}
</style>
