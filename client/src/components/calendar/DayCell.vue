<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AvailabilityStatus, PlayerAvailability, CalendarEvent, SubscriptionRenewal, ScrimSearch } from '@shared/types';
import {
  getAvailabilityClass,
  getAvailabilityDisplay,
  getNextAvailabilityStatus,
  getTeamAvailabilityClass,
  getTeamAvailabilityDisplay,
  sortPlayersByAvailability,
} from '@/utils/availability';
import { sortEventsByTime } from '@/utils/calendar';
import { assessTeamAvailability } from '@shared/utils';
import SvgIcon from '@/components/common/SvgIcon.vue';
import DayItems from '@/components/calendar/DayItems.vue';
import OwnSearchMark from '@/components/calendar/OwnSearchMark.vue';
import { useCornerClearance } from '@/composables/useCornerClearance';

// A day of the calendar, in two readings.
// Normal: one colour answers "what can we do that day?", the team's lineup.
// The rows are what is planned in the team's view, and the other teams
// looking for an opponent in matchmaking, nothing of ours there: our events
// stay in the team's view. Bottom left is ours, in both views: the mark of a
// day picked for a search, or of our own search that day.
// Edit mode: the colour is the reader's own status, the thing a click changes,
// and the whole card lists who said what, name by name.
interface Props {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  currentPlayerStatus: AvailabilityStatus | null;
  currentPlayerId?: string; // Leaves the reader out of the roster: the cell already shows their status
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
  renewals?: SubscriptionRenewal[]; // Players whose subscription renews that day
  showDayNumber?: boolean;
  editMode?: boolean; // Availability edit mode
  matchmaking?: boolean; // Days can be picked for a search, and carry other teams' searches
  scrimSearches?: ScrimSearch[]; // The searches of that day: ours, and in matchmaking the other teams'
  selectable?: boolean; // Matchmaking: clicking the day picks it for a search
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  currentPlayerId: undefined,
  renewals: () => [],
  showDayNumber: true,
  editMode: false,
  matchmaking: false,
  scrimSearches: () => [],
  selectable: false,
  selected: false,
});

const emit = defineEmits<{
  'set-availability': [status: AvailabilityStatus | null];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
  'toggle-select': [date: string];
  'open-search': [search: ScrimSearch];
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

const rowLimit = computed(() => (canPick.value || ownSearch.value ? ROW_LIMIT - 1 : ROW_LIMIT));

// Can the team line up that day? The one colour of the cell in normal reading.
const teamAvailability = computed(() =>
  assessTeamAvailability(props.playerAvailabilities.map(player => player.status)),
);

const lineupTitle = computed(() => getTeamAvailabilityDisplay(teamAvailability.value.status).title);

// The cell, fill and border, is the team's lineup, in both readings; neutral
// while the lineup hangs on players who have not answered. The reader's own
// status sits in the corner. A day outside the month has no verdict: its
// availabilities are not loaded, and an empty roster would read as a day the
// team cannot use.
const cellStatusClass = computed(() => {
  if (props.isPast) return 'status-past';
  if (!props.isCurrentMonth) return '';
  return teamAvailability.value.status === 'unknown' ? 'availability--unset' : getTeamAvailabilityClass(teamAvailability.value.status);
});

// The corner: the reader's own status, colour and symbol
const ownStatusClass = computed(() => getAvailabilityClass(props.currentPlayerStatus));
const ownStatusDisplay = computed(() => getAvailabilityDisplay(props.currentPlayerStatus));

// Edit mode: the teammates, from the most to the least available, then by name.
// The reader is not listed: the corner of the cell already says where they stand.
const roster = computed(() =>
  sortPlayersByAvailability(props.playerAvailabilities.filter(player => player.playerId !== props.currentPlayerId)),
);

// Click on cell
function handleCellClick() {
  if (props.editMode) {
    // Edit mode: cycle through availability states (not for past days)
    if (!props.isPast) {
      cycleAvailability();
    }
  } else if (props.matchmaking) {
    // Matchmaking: a day we already search opens our search; another day joins
    // (or leaves) the days to put up for an opponent. Our events are read in
    // the team's view.
    if (ownSearch.value) emit('open-search', ownSearch.value);
    else if (canPick.value) emit('toggle-select', props.date);
  } else if (hasEvents.value) {
    // With events: open event viewer (even for past days)
    emit('open-event-viewer', sortedEvents.value, 0);
  } else if (!props.isPast && !props.matchmaking) {
    // Team mode without events: emit to open create modal (for admins, not past)
    emit('open-create-event', props.date);
  }
}

// The rows and names reaching the corner stop before it: their room is
// measured once laid out (see useCornerClearance)
const cellRef = ref<HTMLElement | null>(null);
useCornerClearance(cellRef);

// Cycle availability through the statuses, then back to not set
function cycleAvailability() {
  if (props.isPast) return;
  emit('set-availability', getNextAvailabilityStatus(props.currentPlayerStatus ?? null));
}
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
      }
    ]"
    :title="!editMode && !isPast && isCurrentMonth ? lineupTitle : undefined"
    @click="handleCellClick"
  >
    <!-- The day, large and faint, behind everything -->
    <span v-if="props.showDayNumber" class="day-number" aria-hidden="true">{{ dayNumber }}</span>

    <!-- The reader's own status: a coloured corner with its symbol. Not on a
         day outside the month: its availabilities are not loaded, so there is
         nothing to say, and a "?" would read as an unanswered day -->
    <div
      v-if="!isPast && isCurrentMonth"
      class="corner"
      :class="ownStatusClass"
      :title="`Ma disponibilité : ${ownStatusDisplay.title}`"
    >
      <span class="corner-relief" aria-hidden="true">
        <span class="corner-notch">
          <span class="corner-wall corner-wall--bottom"></span>
          <span class="corner-wall corner-wall--right"></span>
          <span class="corner-wall corner-wall--diagonal"></span>
          <span class="corner-face"></span>
        </span>
      </span>
      <!-- A click sets another status: the new symbol springs in over the old -->
      <Transition name="symbol">
        <span :key="ownStatusClass" class="corner-symbol">
          <SvgIcon v-if="'icon' in ownStatusDisplay.symbol" :name="ownStatusDisplay.symbol.icon" />
          <template v-else>{{ ownStatusDisplay.symbol.text }}</template>
        </span>
      </Transition>
    </div>

    <!-- Ours, bottom left: the day picked for a search, or our own search -->
    <span v-if="selected" class="selected-mark" aria-label="Jour sélectionné">✓</span>
    <OwnSearchMark
      v-else-if="ownSearch && !editMode"
      class="own-search-mark"
      data-corner-clear
      :search="ownSearch"
      show-hours
      @open="search => emit('open-search', search)"
    />

    <!-- Edit mode: who said what, the most available first; the reader is the
         corner. Normal reading: what is planned. The two cross-fade. -->
    <Transition name="reading">
      <ul v-if="editMode && !isPast" key="roster" class="roster" :aria-label="`Disponibilités du ${date}`">
        <li
          v-for="player in roster"
          :key="player.playerId"
          class="roster-player"
          data-corner-clear
          :class="getAvailabilityClass(player.status)"
          :title="`${player.playerName} : ${getAvailabilityDisplay(player.status).title}`"
        >
          <span class="roster-dot" aria-hidden="true"></span>
          <span class="roster-name">{{ player.playerName }}</span>
        </li>
      </ul>

      <div v-else key="items" class="items">
        <DayItems
          :searches="rowSearches"
          :events="rowEvents"
          :renewals="rowRenewals"
          :limit="rowLimit"
          @open-search="search => emit('open-search', search)"
          @open-event-viewer="(dayEvents, index) => emit('open-event-viewer', dayEvents, index)"
          @open-day="emit('open-day', date)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// The legs of the reader's triangle as drawn (see .corner). Registered as a
// length so a transition can carry it from one size to the other.
@property --leg {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}

.day-cell {
  position: relative;
  min-width: 0; // Prevent overflow in grid
  // Its width sizes the corner while the reader edits (see .edit-mode .corner)
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

// The reader's own status: a chamfered triangle in the bottom-right corner
// of the cell, cut as a recess in the day, or standing on it as a chip where
// the theme says so. The box itself is not clipped, so a chip inside can cast
// a shadow on the cell; the rim around the walls is the bare surface of the
// day.
.corner {
  position: absolute;
  bottom: 0;
  right: 0;
  // The triangle at rest and its rim around it: the box the lines of the day
  // keep clear of. It takes its new size at once when the reader starts or
  // stops editing, so the lines are measured a single time, against where the
  // triangle is going (see useCornerClearance); the triangle drawn inside
  // catches up through `--leg`.
  width: calc(var(--notch) + var(--rim) * 3.414);
  height: calc(var(--notch) + var(--rim) * 3.414);
  z-index: 2;
  pointer-events: none;

  // The legs as drawn, then the same in whole pixels for the shapes, at every
  // frame (see .day-cell for why whole pixels). Walls, face, shade and symbol
  // all read them, so they move as one. Back to rest: quick and straight.
  --leg: var(--notch);
  --drawn: round(var(--leg), 1px);
  transition: --leg 0.24s cubic-bezier(0.3, 0, 0.2, 1);

  --corner-color: #{$color-border-light}; // The reader's status, read by the face
  --bevel: #{$corner-bevel-width}; // Local copy: a theme token under its own name would be a self-reference
  // Curves of the right-angle vertex, both centred on the same point so the
  // band of the walls keeps its width through the turn: `round` for the
  // outer edge of the walls, `round-in` for the face, a wall narrower. The
  // face takes half the curve of the cell, so the triangle echoes the day;
  // where the triangle sits so close to the edges that the curve of the cell,
  // the rim away, is wider, that one wins and the rim keeps its width along
  // it. In a flat theme without rim nor walls, the face takes the curve of
  // the cell itself.
  --round: max(calc(var(--cell-radius) / 2 + var(--bevel)), calc(var(--cell-radius) - var(--cell-border) - var(--rim)));
  --round-in: calc(var(--round) - var(--bevel));
  // Geometry of the chamfer in the notch's box: a wall is `bevel` wide, and
  // along the bottom or the right edge it meets the diagonal wall
  // bevel × (1 + √2) in from the far end. `turn` is the centre of the curves
  // of the vertex, on its bisector.
  --step: calc(var(--bevel) * 2.41421);
  --far: calc(100% - var(--bevel));
  --turn: calc(100% - var(--bevel) - var(--round-in));

  @each $status, $color in $availability-colors {
    &.availability--#{$status} {
      --corner-color: #{$color};
    }
  }

  @include mobile-lg {
    --bevel: min(#{$corner-bevel-width}, 1px);
  }
}

// The relief wrapper is not clipped: its drop shadow follows the clipped
// shapes inside, which a box-shadow on a clipped box cannot do
.corner-relief {
  position: absolute;
  inset: 0;
  filter: var(--corner-cast);
}

// Editing their availability, a click changes the reader's own corner: it
// grows to twice its legs, its symbol with it, a touch past its size before
// settling; never past most of the width of the day, so a narrow day keeps
// room for its roster
.edit-mode .corner {
  --notch: min(round(calc(#{$corner-size} * 2), 1px), round(60cqi, 1px));
  transition: --leg 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);

  @include mobile-lg {
    --notch: min(round(calc(#{$corner-size} * 4 / 3), 1px), round(60cqi, 1px));
  }
}

// The notch: the triangle inside the rim, whose edges are the outer edges of
// the walls. Its own clip rounds the bottom-right vertex of everything
// inside, walls included, to follow the curve of the cell.
.corner-notch {
  position: absolute;
  bottom: var(--rim);
  right: var(--rim);
  width: var(--drawn);
  height: var(--drawn);
  clip-path: inset(0 round 0 0 var(--round) 0);

  > span {
    position: absolute;
  }
}

// The walls: three trapezoids of the bare surface of the day, along the
// bottom edge, the right edge and the hypotenuse, each under its own
// gradient, lit or shaded by the light. The bottom and right ones meet on the
// bisector of the vertex and run on under the face to the centre of its
// curve, so together they fill the turn around its rounded corner.
.corner-wall {
  inset: 0;
}

.corner-wall--bottom {
  clip-path: polygon(0 100%, 100% 100%, var(--turn) var(--turn), var(--step) var(--far));
  background-image: var(--corner-wall-bottom);
}

.corner-wall--right {
  clip-path: polygon(100% 100%, 100% 0, var(--far) var(--step), var(--turn) var(--turn));
  background-image: var(--corner-wall-right);
}

.corner-wall--diagonal {
  clip-path: polygon(0 100%, 100% 0, var(--far) var(--step), var(--step) var(--far));
  background-image: var(--corner-wall-diagonal);
}

// The face: the reader's colour, under the shadow of the walls when it is
// the floor of a recess, and faded on a day the team cannot use where the
// theme says so. Drawn over the walls, in a box that stops at their inner
// edges so its rounded corner sits inside their turn; its shade keeps the
// geometry of the notch.
.corner-face {
  inset: 0 var(--bevel) var(--bevel) 0;
  border-bottom-right-radius: var(--round-in);
  clip-path: polygon(100% var(--step), 100% 100%, var(--step) 100%);
  background-color: var(--corner-color);
  background-image: var(--corner-face-shade);
  background-size: var(--drawn) var(--drawn);
  filter: var(--corner-face-filter);
  transition: background-color 0.2s ease-out; // A click changes the status: the colour follows
}

.corner-symbol {
  position: absolute;
  // A box centred on the centroid of the face, a third of its leg in from its
  // bottom and right edges: the point that reads as the middle of a triangle.
  // The face is the triangle left inside the notch by the walls. Box and
  // glyph follow the legs of the triangle, so they grow with it.
  --face: calc(var(--drawn) - var(--bevel) * 3.414);
  --inset: calc(var(--rim) + var(--bevel) + var(--face) / 3);
  --symbol: calc(var(--drawn) * 0.32);
  bottom: var(--inset);
  right: var(--inset);
  width: var(--symbol);
  height: var(--symbol);
  transform: translate(50%, 50%);
  // The point the box is moved to, so a scale keeps the glyph on the centroid
  transform-origin: 100% 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  font-size: calc(var(--drawn) * 0.34);
  font-weight: 900;
  line-height: 1;
  color: $corner-symbol-color;

  .svg-icon {
    width: 100%;
    height: 100%;
    display: block;
  }
}

// Bottom left, on the left edge of the rows: the corner holds the bottom
// right. Ours: the mark of a picked day, or our own search (below).
.selected-mark {
  position: absolute;
  bottom: var(--pad);
  left: var(--pad);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--mark);
  height: var(--mark);
  border-radius: 50%;
  background: $color-white;
  color: $color-bg-primary;
  font-size: 0.7rem;
  font-weight: 700;

  @include mobile-lg {
    font-size: 0.6rem;
  }
}

// Our own search: the loupe emoji, drawn exactly in the square of the mark of
// a picked day. The emoji draws it from 2.2 to 29.94 units of its 32, so its
// square is that much larger, and set back by its margins; its centre stays
// that of the square, so the hours beside it sit on the row. The hours stop
// before the corner (see useCornerClearance), at the size of the rows' text.
.own-search-mark {
  --loupe: calc(var(--mark) * 32 / 27.74);
  position: absolute;
  left: calc(var(--pad) - var(--loupe) * 2.2 / 32);
  bottom: calc(var(--pad) - var(--loupe) * 2.06 / 32);
  z-index: 2;
  max-width: calc(100% - var(--pad) + var(--loupe) * 2.2 / 32 - var(--clear, 0px));
  font-size: var(--row-font);
}

// Edit mode: the roster in a column, one player a line, the most available
// first, a dot in the status colour
.roster {
  --roster-font: 0.72rem; // Size of the names
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  position: relative;
  z-index: 1;
  overflow: hidden;

  @include mobile-lg {
    --roster-font: 0.6rem;
  }
}

.roster-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  // A name beside the corner stops before it (see useCornerClearance)
  padding-right: var(--clear, 0px);
  font-size: var(--roster-font);
  line-height: 1.35;
  color: $color-text-primary;
  overflow: hidden;

  @include mobile-lg {
    gap: 0.25rem;
  }
}

// A hollow dot for a player who has not answered, a full one otherwise
.roster-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: transparent;
  border: $border-thin solid $color-text-secondary;
  box-sizing: border-box;

  // Scoped to the player's own row: the cell carries an availability class too
  // (the reader's status in edit mode) and must not colour the teammates' dots
  @each $status, $color in $availability-colors {
    .roster-player.availability--#{$status} > & {
      background: $color;
      border-color: $color;
    }
  }

  @include mobile {
    width: 5px;
    height: 5px;
  }
}

.roster-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

// A new status: its symbol springs in from small, the old one swells and
// fades. `scale` composes with the transform that centres the box.
.symbol-enter-active {
  transition: scale 0.34s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.14s ease-out;
}

.symbol-leave-active {
  transition: scale 0.16s ease-in, opacity 0.16s ease-in;
}

.symbol-enter-from {
  opacity: 0;
  scale: 0.4;
}

.symbol-leave-to {
  opacity: 0;
  scale: 1.3;
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
  .corner,
  .edit-mode .corner,
  .corner-face,
  .symbol-enter-active,
  .symbol-leave-active,
  .reading-enter-active,
  .reading-leave-active {
    transition: none;
  }
}
</style>
