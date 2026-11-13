<script setup lang="ts">
import GamePlanViewer from '@/components/common/GamePlanViewer.vue';
import type { MatchGamePlan } from '@shared/types';

// The game plan of a match, in its form: shown with a button to change it in
// the rotation calculator, or, while there is none, a button to set one
defineProps<{
  gamePlan: MatchGamePlan | null; // The plan to show; null while there is none
}>();

const emit = defineEmits<{
  edit: []; // Open the rotation calculator
  error: [message: string];
}>();
</script>

<template>
  <div v-if="gamePlan" class="game-plan-edit">
    <button type="button" class="btn-change-plan" @click="emit('edit')">
      Modifier le plan
    </button>
    <GamePlanViewer :gamePlan="gamePlan" @error="emit('error', $event)" />
  </div>
  <button v-else type="button" class="btn-set-gameplan" @click="emit('edit')">
    Définir le plan de jeu
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.game-plan-edit {
  border: $border-thin solid $color-border-light;
}

.btn-change-plan {
  padding: 0.4rem 0.75rem;
  background: $color-border-light;
  border: $border-thin solid $color-bg-tertiary;
  border-radius: $radius-sm;
  color: $color-text-muted;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-bg-tertiary;
    color: $color-white;
  }

  @include mobile {
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
  }
}

.btn-set-gameplan {
  width: 100%;
  padding: 0.75rem;
  background: with-alpha($color-accent, 0.2);
  border: 2px dashed $color-accent;
  border-radius: $radius-md;
  color: $color-accent;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: with-alpha($color-accent, 0.3);
    border-style: solid;
  }

  @include mobile-lg {
    padding: 0.625rem;
    font-size: 0.85rem;
  }
}
</style>
