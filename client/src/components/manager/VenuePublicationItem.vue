<script setup lang="ts">
// What a venue's manager published, in the list of its tab: the symbol of its
// subject, its title and kind, its day and hours, what came of it, the word on
// it, and the ways to change it or withdraw it
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
  edit: [];
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
    <div class="publication-actions">
      <button type="button" class="btn-edit" @click="$emit('edit')">Modifier</button>
      <button type="button" class="btn-withdraw" @click="$emit('withdraw')">Retirer</button>
    </div>
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

  // On a phone the buttons go under the text, which keeps the width
  @include mobile-lg {
    flex-wrap: wrap;
  }
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

.publication-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: $spacing-xs;
  flex-shrink: 0;

  @include mobile-lg {
    width: 100%;
  }
}

// Changing, in the colour of every Modifier of the app
.btn-edit {
  @include btn-base($color-edit);
  padding: $spacing-xs $spacing-md;
}

.btn-withdraw {
  @include btn-base($color-danger);
  padding: $spacing-xs $spacing-md;
}
</style>
