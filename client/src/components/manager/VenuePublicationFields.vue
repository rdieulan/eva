<script setup lang="ts">
// The fields of what a venue's manager publishes, a competition or an event:
// its title, its day, its hours and a word on it, in the colour of the
// subject of the form they are in (--subject-color)
import { VENUE_PUBLICATION_DESCRIPTION_MAX, VENUE_PUBLICATION_TITLE_MAX } from '@shared/constants';

defineProps<{
  minDate: string; // The first day it can be on: today
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
}>();

const title = defineModel<string>('title', { required: true });
const date = defineModel<string>('date', { required: true });
const startTime = defineModel<string>('startTime', { required: true });
const endTime = defineModel<string>('endTime', { required: true });
const description = defineModel<string>('description', { required: true });
</script>

<template>
  <label class="form-field">
    <span>Titre</span>
    <input v-model="title" type="text" :maxlength="VENUE_PUBLICATION_TITLE_MAX" :placeholder="titlePlaceholder ?? ''" />
  </label>

  <div class="form-row">
    <label class="form-field">
      <span>Jour</span>
      <input v-model="date" type="date" :min="minDate" />
    </label>
    <label class="form-field">
      <span>Début</span>
      <input v-model="startTime" type="time" />
    </label>
    <label class="form-field">
      <span>Fin</span>
      <input v-model="endTime" type="time" />
    </label>
  </div>

  <label class="form-field">
    <span>Description (facultatif)</span>
    <textarea
      v-model="description"
      rows="2"
      :maxlength="VENUE_PUBLICATION_DESCRIPTION_MAX"
      :placeholder="descriptionPlaceholder ?? ''"
    ></textarea>
  </label>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/forms' as *;

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
}

.form-field {
  @include labelled-field(var(--subject-color, #{$color-accent}));
}
</style>
