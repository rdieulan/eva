<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';

const { theme, themes, setTheme } = useTheme();
</script>

<template>
  <section class="profile-section theme-section">
    <h2>Apparence</h2>
    <p class="section-hint">Le thème change l'habillage de toute l'application, sur cet appareil.</p>

    <div class="theme-list" role="radiogroup" aria-label="Thème">
      <button
        v-for="option in themes"
        :key="option.id"
        type="button"
        role="radio"
        class="theme-option"
        :class="{ active: option.id === theme.id }"
        :aria-checked="option.id === theme.id"
        @click="setTheme(option.id)"
      >
        <span class="theme-name">{{ option.label }}</span>
        <span class="theme-description">{{ option.description }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.section-hint {
  margin: 0 0 $spacing-md;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.theme-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thick solid $color-border;
  border-radius: $radius-md;
  color: $color-text-primary;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: $color-border-light;
  }

  &.active {
    border-color: $color-accent;
    background: with-alpha($color-accent, 0.12);
  }
}

.theme-name {
  font-weight: 600;
}

.theme-description {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}
</style>
