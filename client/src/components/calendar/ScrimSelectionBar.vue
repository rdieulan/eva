<script setup lang="ts">
// Floats over the calendar while days are picked for a scrim search
defineProps<{
  count: number;
}>();

defineEmits<{
  search: [];
  clear: [];
}>();
</script>

<template>
  <Transition name="bar">
    <div v-if="count > 0" class="selection-bar" role="toolbar" aria-label="Jours sélectionnés">
      <span class="selection-count">{{ count > 1 ? `${count} jours sélectionnés` : '1 jour sélectionné' }}</span>
      <button type="button" class="btn btn-clear" @click="$emit('clear')">Annuler</button>
      <button type="button" class="btn btn-search" @click="$emit('search')">🔎 Chercher un adversaire</button>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.selection-bar {
  position: fixed;
  left: 50%;
  bottom: $spacing-lg;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-lg;
  background: $color-bg-secondary;
  border: 1px solid $color-accent;
  border-radius: 999px;
  box-shadow: 0 8px 24px $color-shadow;

  @include mobile-lg {
    left: $spacing-sm;
    right: $spacing-sm;
    transform: none;
    justify-content: space-between;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-lg;
  }
}

.selection-count {
  color: $color-white;
  font-weight: 600;
  white-space: nowrap;

  @include mobile-lg {
    font-size: 0.85rem;
  }
}

.btn-clear {
  @include btn-base($color-text-secondary);
  padding: $spacing-xs $spacing-md;
}

.btn-search {
  @include btn-base($color-accent);
  padding: $spacing-xs $spacing-md;
  white-space: nowrap;
}

.bar-enter-active,
.bar-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.bar-enter-from,
.bar-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);

  @include mobile-lg {
    transform: translateY(12px);
  }
}
</style>
