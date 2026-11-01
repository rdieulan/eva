<script setup lang="ts">
import { computed, toRef, watch } from 'vue';
import type { VenueSlot } from '@shared/types';
import { useVenueSlots, type VenueSlotsStatus } from '@/composables/useVenueSlots';

const props = defineProps<{
  venueId: string | null;
  date: string;
  modelValue: string | null; // Slot id of the match, null while none is picked
  currentStartTime: string; // Start time of the match, shown when its slot is no longer listed
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [slot: VenueSlot];
  status: [status: VenueSlotsStatus];
}>();

const { slots, status } = useVenueSlots({
  venueId: toRef(props, 'venueId'),
  date: toRef(props, 'date'),
  enabled: computed(() => !props.disabled),
});

// The form hides its own time fields while slots can be listed, so it needs to know
watch(status, newStatus => emit('status', newStatus), { immediate: true });

const selectedSlot = computed(() => slots.value.find(slot => slot.slotId === props.modelValue) ?? null);

// A slot the match was saved on that eva.gg no longer lists that day: kept until
// the player picks another one, so that opening the form never loses it
const isStoredSlotMissing = computed(() => props.modelValue !== null && !selectedSlot.value && status.value === 'ready');

// Several arenas can run the same start time, so the arena is part of the label
const hasSeveralArenas = computed(() => new Set(slots.value.map(slot => slot.arenaNumber)).size > 1);

function slotLabel(slot: VenueSlot): string {
  const arena = hasSeveralArenas.value ? ` · arène ${slot.arenaNumber}` : '';
  return `${slot.startTime} – ${slot.endTime}${arena} · ${slot.availableSeats}/${slot.totalSeats} places`;
}

function handleChange(event: Event) {
  const slotId = (event.target as HTMLSelectElement).value;
  const slot = slots.value.find(candidate => candidate.slotId === slotId);
  if (slot) emit('select', slot);
}
</script>

<template>
  <div class="form-group">
    <label class="form-label" for="event-slot">⏱️ Créneau</label>
    <select
      v-if="status !== 'unavailable'"
      id="event-slot"
      class="form-input form-select"
      :value="modelValue ?? ''"
      :disabled="disabled || status === 'loading'"
      @change="handleChange"
    >
      <option value="" disabled>Choisir un créneau</option>
      <option v-if="isStoredSlotMissing" :value="modelValue">Créneau enregistré ({{ currentStartTime }})</option>
      <option v-for="slot in slots" :key="slot.slotId" :value="slot.slotId">
        {{ slotLabel(slot) }}
      </option>
    </select>

    <p v-if="status === 'loading'" class="form-hint">Chargement des créneaux…</p>
    <p v-else-if="status === 'unavailable'" class="form-hint">
      Les créneaux de la salle ne peuvent pas être lus pour le moment : saisis l'horaire à la main.
    </p>
    <p v-else-if="status === 'ready' && !slots.length" class="form-hint">
      Aucun créneau dans cette salle ce jour-là.
    </p>
    <p v-else-if="isStoredSlotMissing" class="form-hint">
      Ce créneau n'est plus proposé ce jour-là.
    </p>
    <p v-else-if="selectedSlot" class="form-hint">
      Convocation à <strong>{{ selectedSlot.convocationTime }}</strong>.
    </p>
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

.form-input {
  padding: 0.75rem;
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: 6px;
  color: $color-white;
  font-size: 0.95rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: $color-accent;
  }

  &:disabled {
    opacity: 0.7;
  }

  @include mobile-lg {
    font-size: 16px; // Prevents zoom on iOS
  }
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
