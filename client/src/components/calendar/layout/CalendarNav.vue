<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue';
import type { ViewMode } from '@/composables/useCalendarNavigation';

// The way through a calendar: the month or the week in sight, between the
// buttons to the one before and the one after
defineProps<{
  viewMode: ViewMode;
  title: string;
}>();

defineEmits<{
  prev: [];
  next: [];
}>();
</script>

<template>
  <div class="nav-header">
    <button
      class="nav-btn"
      @click="$emit('prev')"
      :title="viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'"
    >
      <SvgIcon name="chevron-right" class="nav-icon nav-icon-left" />
    </button>
    <h2 class="nav-title">{{ title }}</h2>
    <button
      class="nav-btn"
      @click="$emit('next')"
      :title="viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'"
    >
      <SvgIcon name="chevron-right" class="nav-icon" />
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.nav-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-lg;

  @include tablet {
    gap: $spacing-md;
  }

  @include mobile-lg {
    gap: 0.75rem;
  }

  @include mobile {
    gap: $spacing-sm;
  }
}

.nav-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: $color-accent;
  }

  @include mobile-lg {
    width: 36px;
    height: 36px;
  }

  @include mobile {
    width: 32px;
    height: 32px;
  }
}

.nav-icon {
  width: 20px;
  height: 20px;
  fill: $color-text-secondary;

  &.nav-icon-left {
    transform: rotate(180deg);
  }

  .nav-btn:hover & {
    fill: $color-white;
  }

  @include mobile {
    width: 16px;
    height: 16px;
  }
}

.nav-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: $color-white;
  text-align: center;
  min-width: 200px;

  @include tablet {
    font-size: 1.15rem;
    min-width: 180px;
  }

  @include mobile-lg {
    font-size: 1rem;
    min-width: 150px;
  }

  @include mobile {
    font-size: 0.9rem;
    min-width: 130px;
  }
}
</style>
