<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import SegmentedControl, { type SegmentedOption } from '@/components/common/SegmentedControl.vue';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import PlannedEventsNote from '@/components/calendar/PlannedEventsNote.vue';
import TeamLineupNote from '@/components/calendar/TeamLineupNote.vue';
import { createScrimSearch, updateScrimSearch } from '@/api';
import { ApiError } from '@/api/error';
import type { DayData, ScrimSearch, Venue, VenueSlot } from '@shared/types';
import {
  ERROR,
  SCRIM_MATCH_SLOTS_DEFAULT,
  SCRIM_MATCH_SLOTS_MIN,
  SCRIM_MATCH_SLOTS_MAX,
  SCRIM_MATCH_COUNT_DEFAULT,
  SCRIM_MATCH_COUNT_MIN,
  SCRIM_MATCH_COUNT_MAX,
} from '@shared/constants';
import { formatMatchCount, formatSlotsDuration, keepWholeMatches, searchOverlap, type ClockStretch } from '@/utils/scrims';
import { countMatches, orderRunSlots, runSpan } from '@shared/utils';
import { formatLongDate } from '@/utils/calendar';
import { formatVenueLabel } from '@/utils/venues';
import { countOutsideLineup, teamLineupOf, type TeamLineup } from '@/utils/availability';

// One search per picked day, across the ticked venues: the captain says how
// long a match is and how many the team wants that day, then ticks the slots
// where it can play, in one venue or several, a match at a time, and sees
// whether the team can line up that day, what it already planned, and which
// teams already search at those hours. An opponent will pick the run of a
// match among them, in one of the venues.
// Given a search of ours, the window changes it instead: its day alone, its
// slots, length and number of matches to start from; the matches it already
// made stay, the slots at their time out of the offer.
const props = withDefaults(defineProps<{
  open: boolean;
  venues: Venue[]; // The ticked venues, in the order of the menu; the search's own first when one is changed
  dates: string[]; // The days picked in the calendar
  days: Record<string, DayData>; // To tell whether the team can line up each day
  searches: Record<string, ScrimSearch[]>; // The open searches of each day: ours, and the other teams' in the ticked venues
  editing?: ScrimSearch | null; // A search of ours to change, in place of opening searches on the picked days
  canPropose?: boolean; // The reader may propose a match to the teams already searching
}>(), {
  editing: null,
  canPropose: false,
});

const emit = defineEmits<{
  close: [];
  opened: []; // At least one search was opened; the calendar reloads
  saved: []; // The search changed; the calendar reloads
  'open-search': [search: ScrimSearch]; // Another team's search, to answer rather than wait for an answer
}>();

// A slot as the window keeps it: enough to count matches and send its id
type PickedSlot = Pick<VenueSlot, 'slotId' | 'arenaNumber' | 'startTime' | 'endTime'>;

// The days still waiting for a search: a day whose search opened leaves the list
const pendingDates = ref<string[]>([]);
const picks = ref<Record<string, Record<string, PickedSlot[]>>>({}); // By day, then by venue
const errorsByDate = ref<Record<string, string>>({});
const isSubmitting = ref(false);

// How long a match is, in slots, and how many the team wants: one setting
// each for every search opened here
const slotCount = ref(SCRIM_MATCH_SLOTS_DEFAULT);
const matchCount = ref(SCRIM_MATCH_COUNT_DEFAULT);

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

// A match length reads in time first, then in slots
const LENGTH_OPTIONS: SegmentedOption<number>[] = range(SCRIM_MATCH_SLOTS_MIN, SCRIM_MATCH_SLOTS_MAX).map(count => ({
  value: count,
  label: formatSlotsDuration(count),
  hint: count > 1 ? `${count} créneaux` : '1 créneau',
}));

const COUNT_OPTIONS: SegmentedOption<number>[] = range(SCRIM_MATCH_COUNT_MIN, SCRIM_MATCH_COUNT_MAX).map(count => ({
  value: count,
  label: formatMatchCount(count),
}));

// The matches the search being changed already made: they count in the
// number of matches, which goes one past them at least
const matchesMade = computed(() => props.editing?.matchedCount ?? 0);
const countOptions = computed(() => COUNT_OPTIONS.filter(option => option.value > matchesMade.value));

// The slots of the search being changed at the time of its matches made: out
// of the offer, and no other match can fall then
const takenSlots = computed(() => props.editing?.slots.filter(slot => props.editing!.takenSlotIds.includes(slot.slotId)) ?? []);
const busy = computed(() => takenSlots.value.map(runSpan));

// The offer of the search being changed, venue by venue, without the slots at the time of its matches made
function offeredPicks(search: ScrimSearch): Record<string, PickedSlot[]> {
  const byVenue: Record<string, PickedSlot[]> = {};
  for (const slot of search.slots) {
    if (search.takenSlotIds.includes(slot.slotId)) continue;
    (byVenue[slot.venueId] ??= []).push(slot);
  }
  return byVenue;
}

watch(() => props.open, isOpen => {
  if (!isOpen) return;
  const editing = props.editing;
  pendingDates.value = editing ? [editing.date] : [...props.dates].sort();
  picks.value = editing ? { [editing.date]: offeredPicks(editing) } : {};
  errorsByDate.value = {};
  isSubmitting.value = false;
  slotCount.value = editing?.slotCount ?? SCRIM_MATCH_SLOTS_DEFAULT;
  matchCount.value = editing?.matchCount ?? SCRIM_MATCH_COUNT_DEFAULT;
}, { immediate: true });

// Another length: each venue of each day keeps what still makes whole matches
watch(slotCount, length => {
  picks.value = Object.fromEntries(
    Object.entries(picks.value).map(([date, byVenue]) => [
      date,
      Object.fromEntries(Object.entries(byVenue).map(([venueId, slots]) => [venueId, keepWholeMatches(slots, length)])),
    ]),
  );
});

// What the team can do that day, from its players' answers, against the slots
// picked: a full lineup covers a slot all day long on a day it is ready, inside
// the hours it meets on a day it only meets on part of, and nowhere on a day it
// does not meet at all. The slots it does not cover are the conflict, and the
// day says so loud; without one, the lineup is a quiet line.
function lineup(date: string): (TeamLineup & { uncovered: number }) | null {
  const team = teamLineupOf(props.days[date]?.playerAvailabilities ?? []);
  return team && { ...team, uncovered: countOutsideLineup(team, dayPicks(date)) };
}

// One search per team and day: its matches are counted together. The search
// being changed is that one.
function isAlreadySearched(date: string): boolean {
  return (props.searches[date] ?? []).some(search => search.isMine && search.id !== props.editing?.id);
}

function pickedIds(date: string, venueId: string): string[] {
  return (picks.value[date]?.[venueId] ?? []).map(slot => slot.slotId);
}

function setPick(date: string, venueId: string, slots: PickedSlot[]) {
  picks.value = { ...picks.value, [date]: { ...picks.value[date], [venueId]: slots } };
}

// The day's picked slots in every ticked venue, each with its venue
function dayPicks(date: string) {
  return props.venues.flatMap(venue => (picks.value[date]?.[venue.id] ?? []).map(slot => ({ ...slot, venueId: venue.id })));
}

// How many matches the day's slots hold, wherever they are, the team playing
// one at a time, none at the time of a match made
function matchesHeld(date: string): number {
  return countMatches(orderRunSlots(dayPicks(date)), slotCount.value, busy.value);
}

// The matches still to set: those asked for, but those made
const matchesWanted = computed(() => matchCount.value - matchesMade.value);

// A day goes once its slots hold every match still wanted
function isReady(date: string): boolean {
  return !isAlreadySearched(date) && matchesHeld(date) >= matchesWanted.value;
}

// A day with slots that do not hold every match yet: what is missing
function shortfall(date: string): string | null {
  if (!dayPicks(date).length || isReady(date)) return null;
  const wanted = matchesMade.value ? `les ${matchesWanted.value} qui restent à caler` : `les ${matchCount.value} demandés`;
  return `De quoi jouer ${formatMatchCount(matchesHeld(date))} sur ${wanted} : ajoute une plage à une autre heure, deux matchs ne tombent jamais en même temps.`;
}

// Another team searching that day, at hours the team picked, in the same
// venue: answering their search makes the match without waiting for an answer
// to ours. A hint only: the day still goes.
interface Rival {
  search: ScrimSearch;
  offer: string;     // Where and when they search, and what for
  proposed: boolean; // The team already proposed them a match, waiting for their answer
}

function venueName(venueId: string): string {
  const venue = props.venues.find(candidate => candidate.id === venueId);
  return venue ? formatVenueLabel(venue) : 'Salle inconnue';
}

// "19:20 – 22:00", "14:00 – 14:40 et 20:00 – 21:20"
function stretchesLabel(stretches: ClockStretch[]): string {
  const labels = stretches.map(stretch => `${stretch.startTime} – ${stretch.endTime}`);
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}` : labels.join('');
}

function rivalsOn(date: string): Rival[] {
  const picked = dayPicks(date);
  if (!picked.length) return [];
  return (props.searches[date] ?? []).filter(search => !search.isMine).flatMap(search => {
    const overlap = searchOverlap(search, picked);
    if (!overlap.length) return [];
    const where = overlap.map(({ venueId, stretches }) => `${venueName(venueId)}, ${stretchesLabel(stretches)}`).join(' · ');
    const wanted = `${formatMatchCount(search.matchCount - search.matchedCount)} de ${formatSlotsDuration(search.slotCount)}`;
    return [{
      search,
      offer: `${where} · ${wanted}`,
      proposed: search.proposals.some(proposal => proposal.isMine && proposal.status === 'PENDING'),
    }];
  });
}

const readyCount = computed(() => pendingDates.value.filter(isReady).length);

const submitLabel = computed(() => {
  if (props.editing) return isSubmitting.value ? 'Enregistrement…' : 'Enregistrer';
  if (isSubmitting.value) return 'Ouverture…';
  if (readyCount.value <= 1) return 'Ouvrir la recherche';
  return `Ouvrir ${readyCount.value} recherches`;
});

// The day's offer, venue by venue in the order of the window
function dayOffer(date: string) {
  return props.venues
    .map(venue => ({ venueId: venue.id, evaSlotIds: pickedIds(date, venue.id) }))
    .filter(offer => offer.evaSlotIds.length);
}

function failureOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.errors[0] ?? fallback : fallback;
}

// The search being changed goes as one request; refused, it keeps its slots and says why
async function saveChange(search: ScrimSearch) {
  isSubmitting.value = true;
  try {
    await updateScrimSearch(search.id, {
      venues: dayOffer(search.date),
      slotCount: slotCount.value,
      matchCount: matchCount.value,
    });
    emit('saved');
    emit('close');
  } catch (error) {
    errorsByDate.value = { [search.date]: failureOf(error, ERROR.scrimSearchUpdateFailed) };
  } finally {
    isSubmitting.value = false;
  }
}

/**
 * One request per day that holds every match. A day that fails keeps its
 * slots and shows why; the others leave the list, so the captain can retry
 * what is left.
 */
async function submit() {
  if (!props.venues.length || isSubmitting.value || readyCount.value === 0) return;
  if (props.editing) {
    await saveChange(props.editing);
    return;
  }
  isSubmitting.value = true;
  let openedAny = false;

  for (const date of [...pendingDates.value]) {
    if (!isReady(date)) continue;
    const venues = dayOffer(date);
    try {
      await createScrimSearch({
        date,
        venues,
        slotCount: slotCount.value,
        matchCount: matchCount.value,
      });
      openedAny = true;
      pendingDates.value = pendingDates.value.filter(pending => pending !== date);
      const { [date]: _dropped, ...rest } = errorsByDate.value;
      errorsByDate.value = rest;
    } catch (error) {
      errorsByDate.value = { ...errorsByDate.value, [date]: failureOf(error, ERROR.scrimSearchCreateFailed) };
    }
  }

  isSubmitting.value = false;
  if (openedAny) emit('opened');
  if (Object.keys(errorsByDate.value).length === 0) emit('close');
}
</script>

<template>
  <Modal :open="open" size="lg" :close-on-backdrop="!isSubmitting" @close="emit('close')">
    <template #header>
      <h2 class="modal-title">🔎 {{ editing ? 'Modifier la recherche' : 'Chercher un adversaire' }}</h2>
    </template>

    <div class="settings">
      <div class="setting">
        <span class="setting-label">Durée d'un match</span>
        <SegmentedControl v-model="slotCount" class="setting-control" fill label="Durée d'un match" :options="LENGTH_OPTIONS" :disabled="isSubmitting" />
      </div>
      <div class="setting">
        <span class="setting-label">Nombre de matchs</span>
        <SegmentedControl v-model="matchCount" class="setting-control" fill label="Nombre de matchs" :options="countOptions" :disabled="isSubmitting" />
      </div>
      <p v-if="matchesMade" class="settings-note">
        {{ matchesMade > 1 ? `${matchesMade} matchs déjà calés comptent` : '1 match déjà calé compte' }} dans le nombre de matchs ; leurs heures restent prises.
      </p>
    </div>

    <div class="days">
      <section v-for="date in pendingDates" :key="date" class="day" :class="{ 'day--conflict': lineup(date)?.uncovered }">
        <header class="day-header">
          <h3 class="day-title">{{ formatLongDate(date) }}</h3>
          <TeamLineupNote v-if="lineup(date) && !lineup(date)!.uncovered" :lineup="lineup(date)!" :uncovered="0" />
        </header>
        <TeamLineupNote v-if="lineup(date)?.uncovered" :lineup="lineup(date)!" :uncovered="lineup(date)!.uncovered" />

        <p v-if="isAlreadySearched(date)" class="day-searched">
          Ton équipe cherche déjà un adversaire ce jour-là : retire cette recherche pour en ouvrir une autre.
        </p>
        <template v-else>
          <PlannedEventsNote :events="days[date]?.events ?? []" />
          <div v-for="venue in venues" :key="venue.id" class="day-venue">
            <VenueSlotPicker
              :venue-id="venue.id"
              :date="date"
              :label="formatVenueLabel(venue)"
              heading
              :model-value="pickedIds(date, venue.id)"
              selection="free"
              :run-length="slotCount"
              playable-only
              select-all
              :team-hours="lineup(date) ? lineup(date)!.hours : undefined"
              :disabled="isSubmitting"
              @select="slots => setPick(date, venue.id, slots)"
            />
          </div>
        </template>

        <!-- Teams already searching at the hours picked: one click to answer them -->
        <div v-if="rivalsOn(date).length" class="day-rivals">
          <p class="day-rivals-title">Déjà en recherche aux mêmes heures</p>
          <ul class="rival-list">
            <li v-for="rival in rivalsOn(date)" :key="rival.search.id" class="rival">
              <img v-if="rival.search.team.logoUrl" class="rival-logo" :src="rival.search.team.logoUrl" alt="" />
              <span class="rival-team">{{ rival.search.team.name }}</span>
              <span class="rival-offer">{{ rival.offer }}</span>
              <button type="button" class="btn btn-rival" :disabled="isSubmitting" @click="emit('open-search', rival.search)">
                {{ rival.proposed ? 'Voir notre proposition' : canPropose ? 'Leur proposer un match' : 'Voir leur recherche' }}
              </button>
            </li>
          </ul>
        </div>

        <p v-if="shortfall(date)" class="day-shortfall">{{ shortfall(date) }}</p>
        <p v-if="errorsByDate[date]" class="day-error" role="alert">{{ errorsByDate[date] }}</p>
      </section>
    </div>

    <template #footer>
      <div class="footer-actions">
        <button type="button" class="btn btn-secondary" :disabled="isSubmitting" @click="emit('close')">Fermer</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="isSubmitting || readyCount === 0"
          @click="submit"
        >
          {{ submitLabel }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.modal-title {
  margin: 0;
  font-size: $font-size-xl;
  color: $color-white;
}

.settings {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
}

// The label beside its choices, or above them when the row is narrow; the
// choices of both settings line up and share the same width
.setting {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-xs $spacing-md;
}

.setting-label {
  flex: 0 0 10rem;
  color: $color-white;
  font-weight: 600;
}

.setting-control {
  flex: 1 1 18rem;
  min-width: 0;
}

.settings-note {
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.8rem;
}

.days {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.day {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;

  // On a phone, the room goes to the slots
  @include mobile {
    padding: $spacing-sm;
  }
}

.day-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-sm;
}

.day-title {
  margin: 0;
  font-size: $font-size-base;
  color: $color-white;
  text-transform: capitalize;
}

// Slots picked where no full lineup is guaranteed: the whole day says it,
// framed in the yellow of a partial lineup (see TeamLineupNote)
.day--conflict {
  border: $border-thick solid $color-conditional;
  background: linear-gradient(with-alpha($color-conditional, 0.1), with-alpha($color-conditional, 0.04)), $color-bg-secondary;
  box-shadow: 0 0 0 3px with-alpha($color-conditional, 0.18);
}

// Each venue of the day, its name above its slots (see VenueSlotPicker)
.day-venue + .day-venue {
  margin-top: $spacing-sm;
}

.day-searched {
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.85rem;
}

// The teams already searching at the hours picked, in the colour of matchmaking
.day-rivals {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  border-left: 3px solid $color-success;
  border-radius: $radius-sm;
  background: with-alpha($color-success, 0.08);
}

.day-rivals-title {
  margin: 0;
  color: $color-success;
  font-size: 0.8rem;
  font-weight: 600;
}

.rival-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  margin: 0;
  padding: 0;
  list-style: none;
}

// The team, what it searches, and the button; the button goes under the rest
// when the row is narrow
.rival {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-xs $spacing-sm;
  font-size: 0.85rem;
}

.rival-logo {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: $radius-sm;
  object-fit: cover;
}

.rival-team {
  color: $color-white;
  font-weight: 600;
}

.rival-offer {
  flex: 1 1 12rem;
  min-width: 0;
  color: $color-text-secondary;
}

.btn-rival {
  @include btn-base($color-success);
  padding: $spacing-xs $spacing-md;
}

.day-shortfall {
  margin: 0;
  color: $color-conditional;
  font-size: 0.85rem;
}

.day-error {
  margin: 0;
  color: $color-danger;
  font-size: 0.85rem;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.btn-secondary {
  @include btn-base($color-text-secondary);
}

.btn-primary {
  @include btn-base($color-accent);
}
</style>
