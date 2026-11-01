<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import VenueSlotPicker from '@/components/calendar/VenueSlotPicker.vue';
import { createScrimSearch } from '@/api';
import { ApiError } from '@/api/error';
import type { DayData, ScrimSearch, Venue, VenueSlot } from '@shared/types';
import { ERROR } from '@shared/constants';
import { assessTeamAvailability } from '@shared/utils';
import { formatLongDate } from '@/utils/calendar';
import { formatVenueLabel } from '@/utils/venues';
import { getTeamAvailabilityDisplay } from '@/utils/availability';

// One search per picked day: the captain picks the slots of the venue to put
// up for an opponent, and sees whether the team can line up that day.
const props = defineProps<{
  open: boolean;
  venue: Venue | null;
  dates: string[]; // The days picked in the calendar
  days: Record<string, DayData>; // To tell whether the team can line up each day
  ownSearches: ScrimSearch[]; // Slots already up for an opponent are not offered again
}>();

const emit = defineEmits<{
  close: [];
  opened: []; // At least one search was opened; the calendar reloads
}>();

// The days still waiting for a search: a day whose search opened leaves the list
const pendingDates = ref<string[]>([]);
const picks = ref<Record<string, VenueSlot[]>>({});
const errorsByDate = ref<Record<string, string>>({});
const isSubmitting = ref(false);

watch(() => props.open, isOpen => {
  if (!isOpen) return;
  pendingDates.value = [...props.dates].sort();
  picks.value = {};
  errorsByDate.value = {};
  isSubmitting.value = false;
}, { immediate: true });

// What the day's colour said in the calendar, in words
function lineupNote(date: string): { tone: 'warning' | 'note'; text: string } | null {
  const players = props.days[date]?.playerAvailabilities ?? [];
  const { status } = assessTeamAvailability(players.map(player => player.status));
  if (status === 'ready') return null;
  return { tone: status === 'shaky' ? 'note' : 'warning', text: getTeamAvailabilityDisplay(status).title };
}

// The slots the team already put up for an opponent that day
function excludedSlotIds(date: string): string[] {
  return props.ownSearches.filter(search => search.date === date).flatMap(search => search.evaSlotIds);
}

function pickedIds(date: string): string[] {
  return (picks.value[date] ?? []).map(slot => slot.slotId);
}

function setPick(date: string, slots: VenueSlot[]) {
  picks.value = { ...picks.value, [date]: slots };
}

const readyCount = computed(() => pendingDates.value.filter(date => (picks.value[date]?.length ?? 0) > 0).length);

const submitLabel = computed(() => {
  if (isSubmitting.value) return 'Ouverture…';
  if (readyCount.value <= 1) return 'Ouvrir la recherche';
  return `Ouvrir ${readyCount.value} recherches`;
});

/**
 * One request per day with slots. A day that fails keeps its slots and shows
 * why; the others leave the list, so the captain can retry what is left.
 */
async function submit() {
  if (!props.venue || isSubmitting.value || readyCount.value === 0) return;
  isSubmitting.value = true;
  let openedAny = false;

  for (const date of [...pendingDates.value]) {
    const slots = picks.value[date] ?? [];
    if (!slots.length) continue;
    try {
      await createScrimSearch({ venueId: props.venue.id, date, evaSlotIds: slots.map(slot => slot.slotId) });
      openedAny = true;
      pendingDates.value = pendingDates.value.filter(pending => pending !== date);
      const { [date]: _dropped, ...rest } = errorsByDate.value;
      errorsByDate.value = rest;
    } catch (error) {
      const message = error instanceof ApiError ? error.errors[0] ?? ERROR.scrimSearchCreateFailed : ERROR.scrimSearchCreateFailed;
      errorsByDate.value = { ...errorsByDate.value, [date]: message };
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
      <h2 class="modal-title">🔎 Chercher un adversaire</h2>
    </template>

    <p v-if="venue" class="intro">
      Choisis les créneaux de <strong>{{ formatVenueLabel(venue) }}</strong> à proposer aux autres équipes.
      Seuls les créneaux libres et ouverts au mode compétitif sont listés.
    </p>

    <div class="days">
      <section v-for="date in pendingDates" :key="date" class="day">
        <header class="day-header">
          <h3 class="day-title">{{ formatLongDate(date) }}</h3>
          <span v-if="lineupNote(date)" class="lineup-note" :class="`lineup-note--${lineupNote(date)!.tone}`">
            {{ lineupNote(date)!.tone === 'warning' ? '⚠️' : 'ℹ️' }} {{ lineupNote(date)!.text }}
          </span>
        </header>

        <VenueSlotPicker
          :venue-id="venue?.id ?? null"
          :date="date"
          :model-value="pickedIds(date)"
          :excluded-slot-ids="excludedSlotIds(date)"
          only-playable
          :disabled="isSubmitting"
          @select="slots => setPick(date, slots)"
        />

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

.intro {
  margin: 0 0 $spacing-md;
  color: $color-text-secondary;
  line-height: 1.5;

  strong {
    color: $color-white;
  }
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
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
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

.lineup-note {
  font-size: 0.8rem;
  font-weight: 600;

  &--warning {
    color: $color-danger;
  }

  &--note {
    color: $color-conditional;
  }
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
