<script setup lang="ts">
// The symbol of a subject in its colour (docs/PRODUIT.md, *Code couleur*):
// what a reminder of the home or a notification of the bell is about. Gone
// wrong, it takes the colour of what it came to: red refused, grey come to nothing.
import type { Subject, SubjectTone } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';

withDefaults(defineProps<{
  subject: Subject;
  tone?: SubjectTone;
  size?: string;
}>(), { tone: 'subject', size: '24px' });

// One symbol per subject, the one the app already shows for it where it has one
const SYMBOLS = {
  match: 'sword',        // The matches of the calendar
  dispos: 'edit',        // The Dispos button of the calendar
  matchmaking: 'search', // Looking for an opponent
  competition: 'trophy', // The competitions of the calendar
  team: 'users',         // The team's tab
} as const satisfies Record<Subject, string>;
</script>

<template>
  <SvgIcon
    :name="SYMBOLS[subject]"
    :size="size"
    class="subject-icon"
    :class="`subject-icon--${tone === 'subject' ? subject : tone}`"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

@each $subject, $color in $subject-colors {
  .subject-icon--#{$subject} {
    color: $color;
  }
}

.subject-icon--refused {
  color: $color-danger;
}

.subject-icon--fell-through {
  color: $color-text-secondary;
}
</style>
