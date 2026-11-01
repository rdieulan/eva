<script setup lang="ts">
import { computed, toRef, watch } from 'vue';
import type { VenueSlot } from '@shared/types';
import { useVenueSlots, type VenueSlotsStatus } from '@/composables/useVenueSlots';

const props = defineProps<{
  venueId: string | null;
  date: string;
  modelValue: string[]; // Slot ids of the match, in order; empty while none is picked
  currentStartTime: string; // Times of the match, shown when its slots are no longer listed
  currentEndTime: string;
  disabled?: boolean;
}>();

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

// Slots grouped by arena, each group in start-time order: a match runs on one arena
const arenas = computed(() => {
  const byArena = new Map<number, VenueSlot[]>();
  for (const slot of slots.value) {
    const group = byArena.get(slot.arenaNumber) ?? [];
    group.push(slot);
    byArena.set(slot.arenaNumber, group);
  }
  return [...byArena.entries()].map(([arenaNumber, arenaSlots]) => ({ arenaNumber, slots: arenaSlots }));
});

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
function toggle(slot: VenueSlot) {
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

function timeRange(from: VenueSlot, to: VenueSlot): string {
  return `${from.startTime} – ${to.endTime}`;
}

const selectionSummary = computed(() => {
  const picked = selectedSlots.value;
  if (!picked.length) return null;
  const count = picked.length > 1 ? `${picked.length} créneaux` : '1 créneau';
  return `${count}, ${timeRange(picked[0]!, picked[picked.length - 1]!)}, convocation à ${picked[0]!.convocationTime}`;
});
</script>

<template>
  <div class="form-group">
    <span class="form-label">⏱️ Créneaux</span>

    <p v-if="status === 'loading'" class="form-hint">Chargement des créneaux…</p>
    <p v-else-if="status === 'unavailable'" class="form-hint">
      Les créneaux de la salle ne peuvent pas être lus pour le moment : saisis l'horaire à la main.
    </p>
    <p v-else-if="status === 'ready' && !slots.length" class="form-hint">
      Aucun créneau dans cette salle ce jour-là.
    </p>

    <template v-if="status === 'ready' && slots.length">
      <div v-if="areStoredSlotsMissing" class="slot-row slot-row--stored">
        <span class="slot-time">{{ currentStartTime }} – {{ currentEndTime }}</span>
        <span class="slot-note">Créneaux enregistrés, plus proposés ce jour-là</span>
      </div>

      <div v-for="arena in arenas" :key="arena.arenaNumber" class="slot-arena">
        <span v-if="arenas.length > 1" class="slot-arena-label">Arène {{ arena.arenaNumber }}</span>
        <div class="slot-list" role="group" :aria-label="`Créneaux de l'arène ${arena.arenaNumber}`">
          <button
            v-for="slot in arena.slots"
            :key="slot.slotId"
            type="button"
            class="slot-row"
            :class="{ selected: isSelected(slot), full: slot.takenSeats >= slot.totalSeats }"
            :aria-pressed="isSelected(slot)"
            :disabled="disabled"
            @click="toggle(slot)"
          >
            <span class="slot-time">{{ slot.startTime }} – {{ slot.endTime }}</span>
            <span class="slot-players">{{ slot.takenSeats }}/{{ slot.totalSeats }} joueurs</span>
          </button>
        </div>
      </div>

      <p class="form-hint">
        <template v-if="selectionSummary"><strong>{{ selectionSummary }}</strong>.</template>
        <template v-else>Un scrim prend en général deux créneaux qui se suivent.</template>
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
}

.slot-arena {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.slot-arena-label {
  color: $color-text-secondary;
  font-size: 0.8rem;
  font-weight: 600;
}

.slot-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-xs;

  @include mobile {
    grid-template-columns: minmax(0, 1fr);
  }
}

.slot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-sm;
  padding: 0.6rem 0.75rem;
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: 6px;
  color: $color-white;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;

  &:hover:not(:disabled) {
    border-color: $color-accent;
  }

  &.selected {
    background: rgba($color-accent, 0.2);
    border-color: $color-accent;
  }

  &.full .slot-players {
    color: $color-danger;
  }

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }

  &--stored {
    border-style: dashed;
    cursor: default;
  }
}

.slot-time {
  font-weight: 600;
  white-space: nowrap;
}

.slot-players,
.slot-note {
  color: $color-text-secondary;
  font-size: 0.8rem;
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
</style>
