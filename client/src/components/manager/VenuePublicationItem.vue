<script setup lang="ts">
// What a venue's manager published, in the list of its tab: the symbol of its
// subject, its title and kind, its day and hours, what came of it, the word on
// it, and the way to withdraw it
import type { Subject } from '@shared/types';
import { formatShortDay } from '@shared/utils';
import SubjectIcon from '@/components/common/SubjectIcon.vue';

defineProps<{
  subject: Subject;
  title: string;
  kind?: string;   // What it is, beside its title: a division's day, a tournament
  date: string;    // YYYY-MM-DD
  startTime: string;
  endTime: string;
  outcome: string; // What came of it among the teams
  description: string | null;
}>();

defineEmits<{
  withdraw: [];
}>();
</script>

<template>
  <li class="publication" :class="`subject--${subject}`">
    <SubjectIcon :subject="subject" size="24px" />
    <div class="publication-text">
      <div class="publication-head">
        <strong>{{ title }}</strong>
        <span v-if="kind" class="publication-kind">{{ kind }}</span>
      </div>
      <span class="publication-when">{{ formatShortDay(date) }} · {{ startTime }} – {{ endTime }}</span>
      <span class="publication-outcome">{{ outcome }}</span>
      <span v-if="description" class="publication-description">{{ description }}</span>
    </div>
    <!-- //TODO(salle : modifier une publication) une publication ne se modifie pas : on la retire et on la republie pour l'instant -->
    <button type="button" class="btn-withdraw" @click="$emit('withdraw')">Retirer</button>
  </li>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

@include subject-color-classes;

.publication {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-left: 4px solid var(--subject-color);
  border-radius: $radius-lg;
}

.publication-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.publication-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: $spacing-xs $spacing-sm;

  strong {
    color: $color-text-primary;
    overflow-wrap: anywhere;
  }
}

.publication-kind {
  color: var(--subject-color);
  font-size: $font-size-sm;
  font-weight: 600;
}

.publication-when {
  color: $color-text-primary;
}

.publication-outcome,
.publication-description {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.btn-withdraw {
  @include btn-base($color-danger);
  padding: $spacing-xs $spacing-md;
  flex-shrink: 0;
}
</style>
