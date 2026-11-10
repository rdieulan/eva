<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import SegmentedControl, { type SegmentedOption } from '@/components/common/SegmentedControl.vue';
import type { AvailabilityHours } from '@shared/types';
import { describeAvailabilityHours, isValidAvailabilityHours } from '@shared/utils';
import { formatLongDate } from '@/utils/calendar';

// The hours of a partial availability, from the hub of the wheel of answers:
// from when, until when, or both
type Shape = 'between' | 'from' | 'until';

// An evening of play, where the fields start when no hours are given yet
const DEFAULT_START = '20:00';
const DEFAULT_END = '23:00';

const SHAPES: SegmentedOption<Shape>[] = [
  { value: 'between', label: 'De … à …' },
  { value: 'from', label: 'Dès …' },
  { value: 'until', label: 'Jusqu\'à …' },
];

const props = defineProps<{
  open: boolean;
  date: string | null; // The day the hours are for
  hours: AvailabilityHours | null; // The hours already given that day, if any
}>();

const emit = defineEmits<{
  save: [hours: AvailabilityHours];
  close: [];
}>();

const shape = ref<Shape>('between');
const startTime = ref(DEFAULT_START);
const endTime = ref(DEFAULT_END);

// Opened on the hours already given, or on an evening
watch(() => props.open, open => {
  if (!open) return;
  const given = props.hours;
  shape.value = !given || (given.startTime && given.endTime) ? 'between' : given.startTime ? 'from' : 'until';
  startTime.value = given?.startTime ?? DEFAULT_START;
  endTime.value = given?.endTime ?? DEFAULT_END;
}, { immediate: true });

const hours = computed<AvailabilityHours>(() => ({
  startTime: shape.value === 'until' ? null : startTime.value || null,
  endTime: shape.value === 'from' ? null : endTime.value || null,
}));

const isValid = computed(() => isValidAvailabilityHours(hours.value));
const summary = computed(() => (isValid.value ? `Dispo pour jouer ${describeAvailabilityHours(hours.value)}` : null));
const isBackwards = computed(() => shape.value === 'between' && !!startTime.value && !!endTime.value && endTime.value <= startTime.value);

function save() {
  if (isValid.value) emit('save', hours.value);
}
</script>

<template>
  <Modal :open="open" title="Mes horaires" size="sm" @close="emit('close')">
    <form class="hours-form" @submit.prevent="save">
      <p v-if="date" class="hours-day">{{ formatLongDate(date) }}</p>
      <p class="hours-intro">
        Dispo pour jouer sur une partie de la journée seulement&nbsp;: ta case passe en jaune, et l'équipe voit tes horaires.
      </p>

      <SegmentedControl v-model="shape" :options="SHAPES" label="Horaires" fill />

      <div class="hours-fields">
        <div v-if="shape !== 'until'" class="field">
          <label class="field-label" for="hours-start">À partir de</label>
          <input id="hours-start" v-model="startTime" type="time" step="300" class="field-input" required />
        </div>
        <div v-if="shape !== 'from'" class="field">
          <label class="field-label" for="hours-end">Jusqu'à</label>
          <input id="hours-end" v-model="endTime" type="time" step="300" class="field-input" required />
        </div>
      </div>

      <p v-if="isBackwards" class="hours-error" role="alert">La fin doit venir après le début.</p>
      <p v-else-if="summary" class="hours-summary">{{ summary }}</p>
    </form>

    <template #footer>
      <div class="footer-actions">
        <button type="button" class="btn-cancel" @click="emit('close')">Annuler</button>
        <button type="button" class="btn-confirm" :disabled="!isValid" @click="save">Enregistrer</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;
@use '@/styles/forms' as *;

.hours-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.hours-day {
  margin: 0;
  color: $color-white;
  font-weight: 600;
}

.hours-intro {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.45;
}

.hours-fields {
  display: flex;
  gap: $spacing-md;

  .field {
    flex: 1;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.field-label {
  @include form-label;
}

.field-input {
  @include form-input;
}

.hours-summary {
  margin: 0;
  color: $color-conditional;
  font-size: $font-size-sm;
  font-weight: 600;
}

.hours-error {
  margin: 0;
  color: $color-danger;
  font-size: $font-size-sm;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  width: 100%;
}

// The same pair as a confirmation (see ConfirmModal)
.btn-cancel {
  @include btn-base($color-text-secondary);
}

.btn-confirm {
  @include btn-base($color-success);
}
</style>
