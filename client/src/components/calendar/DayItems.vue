<script setup lang="ts" generic="T extends DayRowItem">
import { computed } from 'vue';
import type { DayRowItem, ScrimSearch, SubscriptionRenewal, VenueEventView } from '@shared/types';
import { getEventTypeClass, getEventTypeIcon, sortEventsByTime } from '@/utils/calendar';
import { SUBSCRIPTION_TIER_LABELS } from '@/utils/subscription';
import { ownSearchLabel, pendingProposalCount } from '@/utils/scrims';
import magnifierUrl from '@/assets/icons/magnifier.svg';
import SvgIcon from '@/components/common/SvgIcon.vue';
import PendingCount from '@/components/calendar/PendingCount.vue';

// The rows of a day: the other teams looking for an opponent, by the time they
// start, then the events in the order they happen, the events of the team's
// venue it has not added yet, and the players whose subscription renews.
// Whoever shows the day decides what it gives: the other
// teams in matchmaking, what is planned in the team's reading (see DayCell).
// Our own search is the mark of a day (see OwnSearchMark); the list of the day
// gives it its first row (see DayAgendaModal). The day shows as many rows as it
// has room for, the last one
// counting what is left out; the agenda of the day lists them all. A row opens
// what it shows, and its click goes no further. Rows marked
// `data-corner-clear` stay clear of the corner of the day (see
// useCornerClearance); elsewhere the mark does nothing.
const props = withDefaults(defineProps<{
  ownSearch?: ScrimSearch | null; // Ours, first and never left out
  searches: ScrimSearch[]; // The other teams'
  events: T[]; // What is planned: the team's events, or what a venue's calendar shows
  renewals: SubscriptionRenewal[];
  venueEvents?: VenueEventView[]; // The venue's, open to all, the team has not added
  limit?: number; // Rows at most, the one counting the rest included; every row without
}>(), {
  ownSearch: null,
  venueEvents: () => [],
  limit: undefined,
});

const emit = defineEmits<{
  'open-search': [search: ScrimSearch];
  'open-event-viewer': [events: T[], initialIndex: number];
  'open-venue-event': [event: VenueEventView];
  'open-day': []; // From the row counting the rest: the whole day is wanted
}>();

const sortedSearches = computed(() => [...props.searches].sort((a, b) => a.startTime.localeCompare(b.startTime)));
const sortedEvents = computed(() => sortEventsByTime(props.events));
const sortedVenueEvents = computed(() => [...props.venueEvents].sort((a, b) => a.startTime.localeCompare(b.startTime)));

// The renewals of the day share one row. Past the limit, the last row counts
// the rest, from the bottom of the list up; our own search stays.
const ownRows = computed(() => (props.ownSearch ? 1 : 0));
const rowCount = computed(() => props.searches.length + props.events.length + props.venueEvents.length + (props.renewals.length ? 1 : 0));
const hiddenCount = computed(() => {
  if (props.limit === undefined || ownRows.value + rowCount.value <= props.limit) return 0;
  return rowCount.value - (Math.max(1, props.limit - ownRows.value) - 1);
});
const shownRows = computed(() => rowCount.value - hiddenCount.value);
const shownSearches = computed(() => sortedSearches.value.slice(0, shownRows.value));
const shownEvents = computed(() => sortedEvents.value.slice(0, shownRows.value - shownSearches.value.length));
const shownVenueEvents = computed(() => sortedVenueEvents.value.slice(0, shownRows.value - shownSearches.value.length - shownEvents.value.length));
const showsRenewal = computed(() => props.renewals.length > 0
  && shownSearches.value.length + shownEvents.value.length + shownVenueEvents.value.length < shownRows.value);

// What the count stands for: teams, when only teams are left out
const hiddenLabel = computed(() => {
  const teamsOnly = props.searches.length - shownSearches.value.length === hiddenCount.value;
  if (teamsOnly) return hiddenCount.value > 1 ? 'équipes' : 'équipe';
  return hiddenCount.value > 1 ? 'autres' : 'autre';
});

// Subscription renewals, with the tier in the tooltip
const renewalNames = computed(() => props.renewals.map(renewal => renewal.playerName).join(', '));
const renewalTooltip = computed(() => {
  const players = props.renewals.map(renewal =>
    renewal.tier ? `${renewal.playerName} (${SUBSCRIPTION_TIER_LABELS[renewal.tier]})` : renewal.playerName,
  );
  return `Renouvellement d'abonnement : ${players.join(', ')}`;
});

function openSearch(e: MouseEvent, search: ScrimSearch) {
  e.stopPropagation();
  emit('open-search', search);
}

// The viewer gets every event of the day, opened on this one
function openEvent(e: MouseEvent, index: number) {
  e.stopPropagation();
  emit('open-event-viewer', sortedEvents.value, index);
}

function openVenueEvent(e: MouseEvent, venueEvent: VenueEventView) {
  e.stopPropagation();
  emit('open-venue-event', venueEvent);
}

function openDay(e: MouseEvent) {
  e.stopPropagation();
  emit('open-day');
}
</script>

<template>
  <div class="day-items">
    <!-- Our own search: the loupe of the search button, as in the day (see
         OwnSearchMark), its hours, and the teams waiting for our answer -->
    <div
      v-if="ownSearch"
      class="item own-row"
      data-corner-clear
      :title="ownSearchLabel(ownSearch)"
      @click="openSearch($event, ownSearch)"
    >
      <button type="button" class="row-button">
        <img class="item-icon" :src="magnifierUrl" alt="" draggable="false" />
        <span class="item-time">{{ ownSearch.startTime }}</span>
        <span class="item-title">Notre recherche</span>
        <PendingCount v-if="pendingProposalCount(ownSearch)" :count="pendingProposalCount(ownSearch)" />
      </button>
    </div>

    <!-- The other teams looking for an opponent: when, and who. All rows of a
         kind, so no icon. The row takes the click; the button inside gives the
         keyboard a target and fires the same click. -->
    <div
      v-for="search in shownSearches"
      :key="search.id"
      class="item search-row"
      data-corner-clear
      :title="`${search.team.name} · ${search.startTime} – ${search.endTime}`"
      @click="openSearch($event, search)"
    >
      <button type="button" class="row-button">
        <span class="item-time search-time">{{ search.startTime }}</span>
        <span class="item-title search-team">{{ search.team.name }}</span>
      </button>
    </div>

    <!-- Events of the day -->
    <div
      v-for="(event, index) in shownEvents"
      :key="event.id"
      class="item event-badge"
      data-corner-clear
      :class="getEventTypeClass(event.type)"
      :title="`${event.startTime} – ${event.endTime} · ${event.title}`"
      @click="openEvent($event, index)"
    >
      <SvgIcon :name="getEventTypeIcon(event.type)" class="item-icon" />
      <span class="item-time event-time">{{ event.startTime }}</span>
      <span class="item-title event-title">{{ event.title }}</span>
    </div>

    <!-- The events of the team's venue, open to all, the team has not added:
         the event's colour, dashed and quiet, as a thing not taken yet. A
         click shows it, to add it to the team's calendar. -->
    <div
      v-for="venueEvent in shownVenueEvents"
      :key="`venue-${venueEvent.id}`"
      class="item venue-event-row"
      data-corner-clear
      :title="`Événement de la salle, pas encore dans notre calendrier · ${venueEvent.startTime} – ${venueEvent.endTime} · ${venueEvent.title}`"
      @click="openVenueEvent($event, venueEvent)"
    >
      <button type="button" class="row-button">
        <SvgIcon name="flag" class="item-icon" />
        <span class="item-time">{{ venueEvent.startTime }}</span>
        <span class="item-title">{{ venueEvent.title }}</span>
      </button>
    </div>

    <!-- Subscription renewals -->
    <div v-if="showsRenewal" class="item renewal-strip" data-corner-clear :title="renewalTooltip">
      <SvgIcon name="reset" class="item-icon renewal-icon" />
      <span class="item-title renewal-names">{{ renewalNames }}</span>
    </div>

    <!-- What the day holds beyond its rows: a click lists the whole day. The
         count stays when the row is too narrow for the word. -->
    <div v-if="hiddenCount" class="item overflow-row" data-corner-clear title="Voir toute la journée" @click="openDay">
      <button type="button" class="row-button">
        <span class="overflow-count">+{{ hiddenCount }}</span> <span class="item-title">{{ hiddenLabel }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// The rows read their metrics on the box around the list, which sets them:
// the day, whose height is made of them (see DayCell), or the agenda of the
// day (see DayAgendaModal). They are `--row-font`, `--row-pad-y`,
// `--row-pad-x` and `--row-gap`.
.day-items {
  // Its width decides whether the rows show their time (see below): a wide
  // week strip on a phone has room, a month cell on a phone has not
  container: day-items / inline-size;
}

// One line per item, an icon for its kind and the text, on the bare surface
.item {
  // Its own width decides whether a title fits (see the container query below)
  container: day-row / inline-size;
  display: flex;
  align-items: center;
  gap: 0.45em; // Scales with the text, so a small row keeps room for its content
  margin-bottom: var(--row-gap);
  padding: var(--row-pad-y) var(--row-pad-x);
  border: none;
  border-radius: $radius-sm;
  // The colour of the kind of row, on its icon
  --row-color: #{$color-text-secondary};
  background: transparent;
  color: $color-text-primary;
  font: inherit;
  font-size: var(--row-font);
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  overflow: hidden;

  // A row beside the corner of a day stops its content before it (see
  // useCornerClearance) by narrowing its own box, its padding counted in the
  // room: the container query on its title follows a box that changes width,
  // where Firefox leaves it stale when only the padding grows.
  margin-right: max(0px, var(--clear, 0px) - var(--row-pad-x));

  // A touch of light on the row
  &:hover {
    background: with-alpha($color-white, 0.06);
  }
}

// The rows a day leaves out, counted: quiet, a click lists them
.overflow-row {
  color: $color-text-secondary;
}

.overflow-count {
  flex-shrink: 0;
}

// The icon of the row, in the colour of its kind, scaled with the text
.item-icon {
  flex-shrink: 0;
  width: 1.15em;
  height: 1.15em;
  color: var(--row-color);
}

@each $type, $color in $event-type-colors {
  .event-type--#{$type} {
    --row-color: #{$color};
  }
}

// Ours: its count at the end of the row
.own-row .pending-count {
  margin-left: auto;
}

// The button inside a row that opens something, a search or the whole day:
// bare, filling the row, its click bubbling to the row. The row stays the box
// that sizes the content (see the container query on .item-title): a button
// is no reliable size container.
.row-button {
  display: flex;
  align-items: center;
  gap: 0.45em;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item-time {
  flex-shrink: 0;
  font-weight: 600;
  color: $color-text-muted;
}

// The times go when the list is too narrow for a time and a title side by
// side, whatever the screen: the list's width decides, so all the rows of a
// day agree
@container day-items (max-width: 7rem) {
  .item-time {
    display: none;
  }
}

.item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// A row too narrow for a readable title, the first one beside the corner on a
// small screen, keeps its icon, or its count: better than a lone letter and
// an ellipsis. A team's row has nothing else to show, so its name stays.
@container day-row (max-width: 4.5em) {
  .item:has(.item-icon) .item-title,
  .overflow-row .item-title {
    display: none;
  }
}

// A title that shares its row with a count needs the room of the count on top
@container day-row (max-width: 6em) {
  .item:has(.pending-count) .item-title {
    display: none;
  }
}

// An event of the venue the team has not added: dashed and quiet, not taken yet
.venue-event-row {
  --row-color: #{$color-event};
  outline: 1px dashed with-alpha($color-event, 0.55);
  outline-offset: -1px;
  color: $color-text-secondary;
}

.renewal-strip {
  --row-color: #{$color-renewal};
  color: $color-text-secondary;
  cursor: default;

  &:hover {
    background: transparent;
  }
}
</style>
