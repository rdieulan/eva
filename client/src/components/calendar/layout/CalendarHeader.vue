<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue';
import type { ViewMode } from '@/composables/useCalendar';

defineProps<{
  viewMode: ViewMode;
  navigationTitle: string;
}>();

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode];
  prev: [];
  next: [];
}>();

const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
</script>

<template>
  <div class="calendar-controls">
    <!-- View mode switch -->
    <div class="view-switch">
      <button
        class="view-btn"
        :class="{ active: viewMode === 'month' }"
        @click="$emit('update:viewMode', 'month')"
      >
        📅 Mois
      </button>
      <button
        class="view-btn"
        :class="{ active: viewMode === 'week' }"
        @click="$emit('update:viewMode', 'week')"
      >
        📆 Semaine
      </button>
    </div>

    <!-- Navigation header -->
    <div class="nav-header">
      <button
        class="nav-btn"
        @click="$emit('prev')"
        :title="viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'"
      >
        <SvgIcon name="chevron-right" class="nav-icon nav-icon-left" />
      </button>
      <h2 class="nav-title">{{ navigationTitle }}</h2>
      <button
        class="nav-btn"
        @click="$emit('next')"
        :title="viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'"
      >
        <SvgIcon name="chevron-right" class="nav-icon" />
      </button>
    </div>

    <!-- Weekdays header (only for month view) -->
    <div v-if="viewMode === 'month'" class="weekdays-header">
      <div v-for="dayName in weekdays" :key="dayName" class="weekday-name">
        {{ dayName }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.calendar-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-sm $spacing-xl;
  background: linear-gradient(135deg, $color-bg-secondary 0%, #16213e 100%);
  flex-shrink: 0;

  @include tablet {
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
  }

  @include mobile-lg {
    gap: $spacing-xs;
    padding: $spacing-sm $spacing-md;
  }

  @include mobile {
    padding: $spacing-xs $spacing-sm;
  }
}

.view-switch {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-xs;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: 10px;

  @include mobile {
    padding: 0.2rem;
    border-radius: $radius-md;
  }
}

.view-btn {
  padding: 0.6rem 1.25rem;
  background: transparent;
  border: none;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: #ccc;
    background: rgba($color-border-light, 0.5);
  }

  &.active {
    background: $color-accent;
    color: #fff;
  }

  @include mobile-lg {
    padding: $spacing-sm $spacing-md;
    font-size: 0.85rem;
  }

  @include mobile {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
    border-radius: 6px;
  }
}

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
  border: 1px solid $color-border;
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
    fill: #fff;
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
  color: #fff;
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

.weekdays-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: $spacing-sm;
  width: 100%;
  max-width: 1200px;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
  }

  @include mobile {
    gap: 0.15rem;
  }
}

.weekday-name {
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: $color-accent;
  padding: $spacing-xs;

  @include mobile-lg {
    font-size: 0.7rem;
    padding: 0.15rem;
  }

  @include mobile {
    font-size: 0.65rem;
    padding: 0.1rem;
  }
}
</style>
