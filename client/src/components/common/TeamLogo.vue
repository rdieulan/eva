<script setup lang="ts">
import { computed } from 'vue';

// A team's logo, square, or the first letters of its name when it has none
const props = withDefaults(defineProps<{
  name: string;
  logoUrl: string | null;
  size?: number; // px
}>(), {
  size: 40,
});

// The first letter of its first two words: "Les Faucons" reads "LF"
const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join(''),
);

const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px`, fontSize: `${props.size / 3}px` }));
</script>

<template>
  <img v-if="logoUrl" class="team-logo-mark" :src="logoUrl" :alt="`Logo de ${name}`" :style="box" />
  <span v-else class="team-logo-mark team-logo-mark--initials" aria-hidden="true" :style="box">{{ initials }}</span>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.team-logo-mark {
  flex-shrink: 0;
  border-radius: $radius-md;
  border: $border-thin solid $color-border-light;
  background: $color-bg-secondary;
  object-fit: cover;
}

.team-logo-mark--initials {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: with-alpha($color-accent, 0.15);
  color: $color-accent;
  font-weight: 700;
}
</style>
