<script setup lang="ts">
import type { TeamLineup } from '@/utils/availability';

// What a full lineup of the team allows on the day of a match, where its slots
// are picked: a quiet line while the slots picked agree with it, a loud one in
// the yellow of a partial lineup once some fall outside. A warning only: the
// slots still go.
defineProps<{
  lineup: TeamLineup;
  uncovered: number; // The slots picked no full lineup covers
}>();

function conflictText(uncovered: number): string {
  return uncovered > 1
    ? `${uncovered} créneaux choisis tombent hors des dispos de l'équipe`
    : '1 créneau choisi tombe hors des dispos de l\'équipe';
}
</script>

<template>
  <p v-if="uncovered" class="lineup-conflict" role="status">
    <strong>{{ conflictText(uncovered) }}.</strong>
    {{ lineup.text }}.
  </p>
  <p v-else class="lineup-note">{{ lineup.text }}</p>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.lineup-note {
  margin: 0;
  font-size: 0.8rem;
  color: $color-text-secondary;
}

.lineup-conflict {
  margin: 0;
  padding: $spacing-sm 0.75rem;
  border-radius: $radius-sm;
  background: with-alpha($color-conditional, 0.16);
  color: $color-white;
  font-size: $font-size-sm;
  line-height: 1.4;

  strong {
    color: $color-conditional;
  }
}
</style>
