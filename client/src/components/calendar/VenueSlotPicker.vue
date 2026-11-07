<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue';
import type { SlotTokenType, VenueSlot } from '@shared/types';
import { COMPETITIVE_GAME_ID } from '@shared/constants';
import { useVenueSlots, type VenueSlotsStatus } from '@/composables/useVenueSlots';
import { assessSlotHeadcount, orderRunSlots, slotStreaks } from '@shared/utils';
import { keepWholeMatches } from '@/utils/scrims';
import SvgIcon from '@/components/common/SvgIcon.vue';

// Every slot of the day is shown, so the evening reads as a whole; the ones a
// match cannot take are just not clickable, with the reason next to them.
const props = withDefaults(defineProps<{
  venueId: string | null;
  date: string;
  modelValue: string[]; // Slot ids picked, in order; empty while none is picked
  currentStartTime?: string; // Times of the match, shown when its slots are no longer listed
  currentEndTime?: string;
  disabled?: boolean;
  selection?: 'run' | 'free'; // One run of consecutive slots on one arena (a match), or any set (an offer)
  playableOnly?: boolean; // Only slots a match can be booked on are clickable: our game, competitive mode open, nobody in
  allowedSlotIds?: string[]; // When set, only these are clickable (the slots a search offers)
  excludedSlotIds?: string[]; // Not clickable, with excludedNote next to them
  excludedNote?: string;
  selectAll?: boolean; // Free selection: a button per arena to take or drop every clickable slot
  // The length of a match, in slots: a slot that cannot sit in that many in a
  // row is not clickable, and a click takes them all at once; a run is that
  // long, and a free selection is made of such runs
  runLength?: number;
  label?: string; // What the slots are, above them: the venue's name where several venues are shown
  heading?: boolean; // The label names the block, a venue among others, rather than a field: it reads as a title
  readonly?: boolean; // Shows the slots picked within the day, raised and ringed, the others flat; takes no click
}>(), {
  currentStartTime: '',
  currentEndTime: '',
  disabled: false,
  selection: 'run',
  playableOnly: false,
  allowedSlotIds: undefined,
  excludedSlotIds: () => [],
  excludedNote: 'Déjà proposé',
  selectAll: false,
  runLength: undefined,
  label: '⏱️ Créneaux',
  heading: false,
  readonly: false,
});

const emit = defineEmits<{
  select: [slots: VenueSlot[]];
  status: [status: VenueSlotsStatus];
}>();

const { slots, status } = useVenueSlots({
  venueId: toRef(props, 'venueId'),
  date: toRef(props, 'date'),
  enabled: computed(() => !props.disabled),
});

// The form hides its own time fields while slots can be listed, so it needs to know
watch(status, newStatus => emit('status', newStatus), { immediate: true });

// Why a slot is not for us, or 'playable' when it is
type SlotState = 'playable' | 'otherGame' | 'notCompetitive' | 'taken' | 'quotaReached' | 'excluded' | 'notAllowed' | 'tooShort';

// Keyed by SlotState: the note shown on the row, or null for the headcount
const STATE_NOTES: Record<Exclude<SlotState, 'excluded'>, string | null> = {
  playable: null,
  otherGame: 'Autre jeu',
  notCompetitive: 'Compétitif fermé',
  taken: null,
  quotaReached: 'Quota HP atteint',
  notAllowed: 'Non proposé',
  tooShort: 'Plage trop courte',
};

// What the slot is, before the length of a match is taken into account
function baseStateOf(slot: VenueSlot): Exclude<SlotState, 'tooShort'> {
  if (props.excludedSlotIds.includes(slot.slotId)) return 'excluded';
  if (props.allowedSlotIds && !props.allowedSlotIds.includes(slot.slotId)) return 'notAllowed';
  if (slot.gameId !== COMPETITIVE_GAME_ID) return 'otherGame';
  if (!slot.isCompetitiveAvailable) return 'notCompetitive';
  if (slot.takenSeats > 0) return 'taken';
  // Peak hours the venue no longer opens to EVA Pass holders today: the
  // players, who pay in tokens, cannot open it
  if (slot.passQuotaLeft === 0) return 'quotaReached';
  return 'playable';
}

// A slot another game or another team already holds is never ours to pick;
// one with players in, a closed competitive mode or a spent pass quota, only
// when a match needs it free
function isUsable(slot: VenueSlot): boolean {
  const state = baseStateOf(slot);
  if (state === 'playable') return true;
  if (state === 'taken' || state === 'notCompetitive' || state === 'quotaReached') return !props.playableOnly;
  return false;
}

// Slots grouped by arena, each group in start-time order: a match runs on one arena
const arenas = computed(() => {
  const byArena = new Map<number, VenueSlot[]>();
  for (const slot of orderRunSlots(slots.value)) {
    const group = byArena.get(slot.arenaNumber) ?? [];
    group.push(slot);
    byArena.set(slot.arenaNumber, group);
  }
  return [...byArena.entries()].map(([arenaNumber, arenaSlots]) => ({ arenaNumber, slots: arenaSlots }));
});

// With a match length, the usable slots that sit in a long enough row of
// usable slots: the others cannot hold a match
const coveredIds = computed(() => {
  const length = props.runLength;
  if (!length) return null;
  const streaks = arenas.value.flatMap(arena => slotStreaks(arena.slots, isUsable));
  return new Set(streaks.filter(streak => streak.length >= length).flat().map(slot => slot.slotId));
});

function stateOf(slot: VenueSlot): SlotState {
  if (isUsable(slot) && coveredIds.value && !coveredIds.value.has(slot.slotId)) return 'tooShort';
  return baseStateOf(slot);
}

function isClickable(slot: VenueSlot): boolean {
  return isUsable(slot) && (!coveredIds.value || coveredIds.value.has(slot.slotId));
}

// Raised as a plate: a slot a click can take, or, shown without clicks, a slot picked
function isRaised(slot: VenueSlot): boolean {
  return props.readonly ? isSelected(slot) : isClickable(slot);
}

// What a slot with players in says when a match needs it free
const TAKEN_NOTE = 'Occupé';

// When a match needs the slot free, all that matters is whether it is: a
// playable slot is empty by definition, one with players in is just taken,
// whoever they are. The match form counts them against a full match instead,
// to check the team's own booking.
function noteOf(slot: VenueSlot): string {
  const state = stateOf(slot);
  if (state === 'excluded') return props.excludedNote;
  if (props.playableOnly && state === 'playable') return '';
  if (props.playableOnly && state === 'taken') return TAKEN_NOTE;
  return STATE_NOTES[state] ?? assessSlotHeadcount(slot.takenSeats).label;
}

// Every note a slot of this picker may carry, whatever the slots of the day:
// the widest sets the width of a column, so changing what is picked never
// moves the grid
const rulerNotes = computed(() => {
  const notes = new Set<string>([STATE_NOTES.otherGame!, STATE_NOTES.notCompetitive!, props.excludedNote]);
  if (props.allowedSlotIds) notes.add(STATE_NOTES.notAllowed!);
  if (props.runLength) notes.add(STATE_NOTES.tooShort!);
  if (slots.value.some(slot => slot.passQuotaLeft === 0)) notes.add(STATE_NOTES.quotaReached!);
  if (props.playableOnly) notes.add(TAKEN_NOTE);
  else for (const slot of slots.value) notes.add(assessSlotHeadcount(slot.takenSeats).label);
  return [...notes];
});

// The token an EVA Pass holder spends on a slot, in the words of their app
const TOKEN_LABELS: Record<SlotTokenType, { short: string; title: string }> = {
  peak: { short: 'HP', title: 'Heures pleines : un jeton HP' },
  offPeak: { short: 'HC', title: 'Heures creuses : un jeton HC' },
};

// Whether the slots of the day say their token: the ruler then measures it too
const hasTokens = computed(() => slots.value.some(slot => slot.tokenType !== null));


// The narrowest a slot can be with its time and its widest note shown whole,
// measured in the page: as many columns as fit at that width
const ruler = ref<HTMLElement | null>(null);
const slotMinWidth = ref<number | null>(null);

function measureSlotWidth() {
  const rows = ruler.value?.querySelectorAll<HTMLElement>('.slot-row');
  if (!rows?.length) return;
  // Layout widths, which the window's opening animation, a scale, leaves
  // alone; rounded to the pixel, so one more keeps the widest whole
  const widest = Math.max(...[...rows].map(row => row.offsetWidth));
  if (widest > 0) slotMinWidth.value = widest + 1;
}

// The ruler is as wide as its widest slot: watched, it says when that width
// moves, as the notes change, the fonts land, or the screen crosses a size
// where the slots take another padding
let rulerObserver: ResizeObserver | null = null;

watch(ruler, (element, previous) => {
  if (typeof ResizeObserver === 'undefined') {
    measureSlotWidth();
    return;
  }
  rulerObserver ??= new ResizeObserver(() => measureSlotWidth());
  if (previous) rulerObserver.unobserve(previous);
  if (element) rulerObserver.observe(element);
}, { flush: 'post' });

onBeforeUnmount(() => rulerObserver?.disconnect());

// The match form colours the headcount of a slot of our game only: another
// game's players are not ours to count
function headcountClass(slot: VenueSlot): string | null {
  if (props.playableOnly || stateOf(slot) !== 'taken') return null;
  return `headcount-${assessSlotHeadcount(slot.takenSeats).status}`;
}

const selectedIds = computed(() => new Set(props.modelValue));
const selectedSlots = computed(() => slots.value.filter(slot => selectedIds.value.has(slot.slotId)));

// Slots the match was saved on that eva.gg no longer lists that day: kept until
// the player picks others, so that opening the form never loses them
const areStoredSlotsMissing = computed(
  () => props.modelValue.length > 0 && selectedSlots.value.length === 0 && status.value === 'ready',
);

function isSelected(slot: VenueSlot): boolean {
  return selectedIds.value.has(slot.slotId);
}


/**
 * A match covers consecutive slots of one arena. Clicking next to the current
 * run extends it, clicking one of its ends shortens it, clicking anywhere else
 * starts a new run there.
 */
function toggleInRun(slot: VenueSlot) {
  const run = arenas.value.find(arena => arena.arenaNumber === slot.arenaNumber)?.slots ?? [];
  const selected = run.filter(isSelected);
  const index = run.indexOf(slot);

  let next: VenueSlot[];
  if (selected.length && isSelected(slot)) {
    const first = run.indexOf(selected[0]!);
    const last = run.indexOf(selected[selected.length - 1]!);
    next = index === first ? selected.slice(1) : index === last ? selected.slice(0, -1) : [slot];
  } else if (selected.length && index === run.indexOf(selected[0]!) - 1) {
    next = [slot, ...selected];
  } else if (selected.length && index === run.indexOf(selected[selected.length - 1]!) + 1) {
    next = [...selected, slot];
  } else {
    next = [slot];
  }
  emit('select', next);
}

/**
 * The run of a match of `length` slots around the clicked one: starting there,
 * or shifted back as far as needed when the row runs out, every slot of it
 * clickable and following the previous one. Null when no such run holds it.
 */
function runAround(slot: VenueSlot, length: number): VenueSlot[] | null {
  const arena = arenas.value.find(candidate => candidate.arenaNumber === slot.arenaNumber)?.slots ?? [];
  const index = arena.indexOf(slot);
  for (let start = index; start >= Math.max(0, index - length + 1); start--) {
    const candidate = arena.slice(start, start + length);
    const holds = candidate.length === length
      && candidate.every(isClickable)
      && candidate.every((item, position) => position === 0 || item.startTime === candidate[position - 1]!.endTime);
    if (holds) return candidate;
  }
  return null;
}

/**
 * A match of a set length: clicking a slot selects its run. Clicking inside
 * the current run clears it.
 */
function toggleFixedRun(slot: VenueSlot, length: number) {
  if (isSelected(slot)) {
    emit('select', []);
    return;
  }
  const run = runAround(slot, length);
  if (run) emit('select', run);
}

/**
 * An offer made of matches: clicking a slot adds the run of a match around
 * it; clicking a picked slot drops it, and with it whatever no longer makes a
 * whole match.
 */
function toggleMatchRuns(slot: VenueSlot, length: number) {
  if (isSelected(slot)) {
    const rest = selectedSlots.value.filter(selected => selected.slotId !== slot.slotId);
    emit('select', keepWholeMatches(rest, length));
    return;
  }
  const run = runAround(slot, length);
  if (!run) return;
  const added = run.filter(candidate => !isSelected(candidate));
  emit('select', orderRunSlots([...selectedSlots.value, ...added]));
}

// An offer with no match length takes any set of slots
function toggleFreely(slot: VenueSlot) {
  const next = isSelected(slot)
    ? selectedSlots.value.filter(selected => selected.slotId !== slot.slotId)
    : [...selectedSlots.value, slot];
  emit('select', orderRunSlots(next));
}

// A slot picked can always be dropped, even one no longer open to a match: an
// offer being changed keeps the slots it had, whatever happened to them since
function isToggleable(slot: VenueSlot): boolean {
  return isClickable(slot) || isSelected(slot);
}

function toggle(slot: VenueSlot) {
  if (props.readonly || !isToggleable(slot)) return;
  if (props.selection === 'free') {
    if (props.runLength) toggleMatchRuns(slot, props.runLength);
    else toggleFreely(slot);
  } else if (props.runLength) {
    toggleFixedRun(slot, props.runLength);
  } else {
    toggleInRun(slot);
  }
}

// Free selection: every clickable slot of the arena is in, or none
function isArenaFull(arenaSlots: VenueSlot[]): boolean {
  const clickable = arenaSlots.filter(isClickable);
  return clickable.length > 0 && clickable.every(isSelected);
}

function toggleArena(arenaSlots: VenueSlot[]) {
  const clickable = arenaSlots.filter(isClickable);
  const others = selectedSlots.value.filter(selected => !arenaSlots.includes(selected));
  emit('select', orderRunSlots(isArenaFull(arenaSlots) ? others : [...others, ...clickable]));
}

function timeRange(from: VenueSlot, to: VenueSlot): string {
  return `${from.startTime} – ${to.endTime}`;
}

const selectionSummary = computed(() => {
  const picked = selectedSlots.value;
  if (!picked.length) return null;
  const count = picked.length > 1 ? `${picked.length} créneaux` : '1 créneau';
  if (props.selection === 'free') {
    const byTime = [...picked].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const latest = [...picked].sort((a, b) => b.endTime.localeCompare(a.endTime))[0]!;
    return `${count} ${picked.length > 1 ? 'proposés' : 'proposé'}, entre ${byTime[0]!.startTime} et ${latest.endTime}`;
  }
  return `${count}, ${timeRange(picked[0]!, picked[picked.length - 1]!)}, convocation à ${picked[0]!.convocationTime}`;
});

const emptyHint = computed(() => {
  if (props.selection === 'free' && props.runLength && props.runLength > 1) {
    return `Clique sur un créneau : les ${props.runLength} créneaux d'un match se cochent ensemble. Coche toutes les plages où ton équipe peut jouer.`;
  }
  if (props.selection === 'free') return 'Coche tous les créneaux où ton équipe peut jouer ; l\'adversaire choisira ceux du match.';
  if (props.runLength) return props.runLength > 1 ? `Clique sur le premier créneau du match : les ${props.runLength} créneaux se sélectionnent ensemble.` : 'Clique sur le créneau du match.';
  return 'Un scrim prend en général deux créneaux qui se suivent.';
});
</script>

<template>
  <div
    class="form-group"
    :class="{ 'slot-picker--readonly': readonly }"
    :style="slotMinWidth ? { '--slot-min': `${slotMinWidth}px` } : undefined"
  >
    <span class="form-label" :class="{ 'form-label--heading': heading }">
      <SvgIcon v-if="heading" name="place" class="form-label-icon" />{{ label }}
    </span>

    <p v-if="status === 'loading'" class="form-hint slot-loading" role="status">
      <span class="spinner" aria-hidden="true"></span>
      Chargement des créneaux…
    </p>
    <p v-else-if="status === 'unavailable'" class="form-hint">
      Les créneaux de la salle ne peuvent pas être lus pour le moment : saisis l'horaire à la main.
    </p>
    <p v-else-if="status === 'ready' && !slots.length" class="form-hint">
      Aucun créneau dans cette salle ce jour-là.
    </p>

    <template v-if="status === 'ready' && slots.length">
      <!-- Out of sight: a slot per note it may carry, at its natural width, to be measured -->
      <div ref="ruler" class="slot-ruler" aria-hidden="true">
        <div v-for="note in rulerNotes" :key="note" class="slot-row">
          <span class="slot-start">
            <span class="slot-time">00:00</span>
            <span v-if="hasTokens" class="slot-token">HP</span>
          </span>
          <span class="slot-players">{{ note }}</span>
        </div>
      </div>

      <div v-if="areStoredSlotsMissing" class="slot-row slot-row--stored">
        <span class="slot-time">{{ currentStartTime }} – {{ currentEndTime }}</span>
        <span class="slot-note">Créneaux enregistrés, plus proposés ce jour-là</span>
      </div>

      <div v-for="arena in arenas" :key="arena.arenaNumber" class="slot-arena">
        <div v-if="arenas.length > 1 || (selectAll && selection === 'free')" class="slot-arena-header">
          <span v-if="arenas.length > 1" class="slot-arena-label">Arène {{ arena.arenaNumber }}</span>
          <button
            v-if="selectAll && selection === 'free' && arena.slots.some(isClickable)"
            type="button"
            class="slot-arena-toggle"
            :disabled="disabled"
            @click="toggleArena(arena.slots)"
          >
            {{ isArenaFull(arena.slots) ? 'Tout désélectionner' : 'Tout sélectionner' }}
          </button>
        </div>
        <div class="slot-list" role="group" :aria-label="`Créneaux de l'arène ${arena.arenaNumber}`">
          <button
            v-for="slot in arena.slots"
            :key="slot.slotId"
            type="button"
            class="slot-row"
            :class="[
              `slot-row--${stateOf(slot)}`,
              isRaised(slot) ? 'slot-row--open' : 'slot-row--closed',
              { selected: isSelected(slot) },
              headcountClass(slot),
            ]"
            :aria-pressed="isSelected(slot)"
            :disabled="disabled || readonly || !isToggleable(slot)"
            :title="`${slot.startTime} – ${slot.endTime}`"
            @click="toggle(slot)"
          >
            <!-- The start, like the rows of a day in the calendar: a slot always lasts as long;
                 then the token a pass holder spends on it -->
            <span class="slot-start">
              <span class="slot-time">{{ slot.startTime }}</span>
              <span
                v-if="slot.tokenType"
                class="slot-token"
                :class="`slot-token--${slot.tokenType}`"
                :title="TOKEN_LABELS[slot.tokenType].title"
              >{{ TOKEN_LABELS[slot.tokenType].short }}</span>
            </span>
            <span class="slot-players">{{ noteOf(slot) }}</span>
          </button>
        </div>
      </div>

      <p v-if="selectionSummary || !readonly" class="form-hint">
        <template v-if="selectionSummary"><strong>{{ selectionSummary }}</strong>.</template>
        <template v-else>{{ emptyHint }}</template>
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: $color-text-secondary;

  @include mobile {
    font-size: 0.8rem;
  }

  // The name of a venue among others, behind a pin: in the accent of the
  // theme, the one colour here that is not the white of the titles and the
  // slots, lifted a little so it reads as text
  &--heading {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: 0.3em;
    color: color-mix(in srgb, #{$color-accent} 75%, #{$color-white});
    font-size: 0.95rem;

    @include mobile {
      font-size: 0.9rem;
    }
  }
}

.form-label-icon {
  width: 1.15em;
  height: 1.15em;
}

.slot-arena {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.slot-arena-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;
  min-height: 1.5rem;
}

.slot-arena-label {
  color: $color-text-secondary;
  font-size: 0.8rem;
  font-weight: 600;
}

.slot-arena-toggle {
  margin-left: auto;
  padding: 0.2rem 0.6rem;
  background: none;
  border: $border-thin solid $color-border-light;
  border-radius: 999px;
  color: $color-text-secondary;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: $color-white;
    border-color: $color-accent;
  }
}

// As many slots a row as fit, each column at least the width a slot needs to
// show its time and its widest note whole (--slot-min, measured on the ruler;
// the fallback only holds until then)
.slot-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--slot-min, 10rem), 1fr));
  gap: $spacing-xs;
}

// Out of sight and out of the flow, its slots at their natural width
.slot-ruler {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;

  .slot-row {
    width: max-content;
  }
}

// A slot reads like a day of the calendar: one a match can take stands out as
// a plate, raised where the theme has relief; one it cannot take is the
// ground itself, its reason written on it. A picked slot is ringed in white,
// like a picked day.
.slot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-sm;
  padding: 0.45rem 0.6rem;
  border: $surface-border-width solid $color-bg-tertiary;
  border-radius: $radius-md;
  color: $color-white;
  font-size: 0.9rem;
  font-weight: 500; // Set here, not left to the button's own style: the ruler's slots must measure the same
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, filter 0.15s;

  // Tighter on a phone, so two slots still sit side by side
  @include mobile {
    padding-inline: 0.45rem;
  }

  &--open {
    background-color: $color-bg-tertiary;
    background-image: linear-gradient($surface-raised-tint), $texture-bg;
    border-color: $color-border-light;
    box-shadow: $elevation-raised;
    cursor: pointer;

    &:hover:not(:disabled) {
      filter: brightness(1.12);
    }
  }

  &--closed {
    background-color: $surface-idle-fill;
    background-image: linear-gradient($surface-idle-tint), $texture-bg;
    box-shadow: $elevation-idle;
    color: with-alpha($color-text-muted, 0.55);
    cursor: default;

    .slot-players {
      color: with-alpha($color-text-secondary, 0.8);
    }
  }

  &.selected {
    border-color: with-alpha($color-white, 0.85);
    box-shadow: inset 0 0 0 2px with-alpha($color-white, 0.85), $elevation-raised;
  }

  // The match form: players of our game already in, against a full match.
  // Short of it in yellow, full in green, over, the one that needs sorting
  // out, in red.
  &.headcount-missing .slot-players {
    color: $color-conditional;
  }

  &.headcount-full .slot-players {
    color: $color-success;
  }

  &.headcount-over .slot-players {
    color: $color-danger;
  }

  &--stored {
    border: $border-thin dashed $color-border-light;
    cursor: default;
  }

  // Shown without clicks: nothing to point at
  .slot-picker--readonly & {
    cursor: default;
  }
}

// The start of a slot and the token a pass holder spends on it
.slot-start {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4em;
}

.slot-time {
  flex-shrink: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums; // Every time as wide as the ruler's
  white-space: nowrap;
}

// HP or HC, the token of EVA Pass holders: peak hours in the warm tone,
// off-peak hours in the cool one, like the hours on a power bill
.slot-token {
  flex-shrink: 0;
  padding: 0 0.4em;
  border: $border-thin solid;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.45;

  &--peak {
    color: $color-warning;
    border-color: with-alpha($color-warning, 0.55);
  }

  &--offPeak {
    color: $color-info;
    border-color: with-alpha($color-info, 0.55);
  }

  .slot-row--closed & {
    opacity: 0.6;
  }
}


// The reason gives way to the time when a row runs short
.slot-players,
.slot-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-text-secondary;
  font-size: 0.75rem;
  white-space: nowrap;
}

.form-hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.85rem;
  line-height: 1.5;

  strong {
    color: $color-white;
    font-weight: 600;
  }
}

.slot-loading {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.spinner {
  width: 16px;
  height: 16px;
  border: $border-thick solid $color-border;
  border-top-color: $color-accent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
