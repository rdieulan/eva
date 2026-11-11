<script setup lang="ts">
// A page of the manager's space: the venue in sight under the space's name, a
// switch between the venues when the manager has several, and the page's
// sections for that venue
import { onMounted } from 'vue';
import { useManagedVenues } from '@/composables/useManagedVenues';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const { venues, venue, isLoading, errors, load, select } = useManagedVenues();

onMounted(load);
</script>

<template>
  <div class="manager-page">
    <div class="manager-column">
      <p v-if="isLoading && !venue" class="manager-note">Chargement…</p>
      <ErrorDisplay v-else-if="errors.length" :errors="errors" />
      <p v-else-if="!venues.length" class="manager-note">Aucune salle ne t'est confiée pour l'instant.</p>

      <template v-else-if="venue">
        <header class="manager-head">
          <div>
            <p class="manager-kicker">Espace gérant</p>
            <h1>{{ venue.name }}</h1>
          </div>
          <div v-if="venues.length > 1" class="manager-venues" role="tablist" aria-label="Tes salles">
            <button
              v-for="candidate in venues"
              :key="candidate.id"
              type="button"
              role="tab"
              class="manager-venue"
              :class="{ current: candidate.id === venue.id }"
              :aria-selected="candidate.id === venue.id"
              @click="select(candidate.id)"
            >{{ candidate.name }}</button>
          </div>
        </header>

        <slot :venue="venue" />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.manager-page {
  min-height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: $spacing-xl;
  @include surface-gradient;

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
  }
}

.manager-column {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  max-width: 1200px;
  margin: 0 auto;
}

.manager-note {
  margin: 0;
  color: $color-text-secondary;
}

.manager-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-md;

  h1 {
    margin: 0;
    font-size: $font-size-3xl;
    color: $color-text-primary;
  }
}

.manager-kicker {
  margin: 0;
  color: $color-accent;
  font-size: $font-size-sm;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.manager-venues {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.manager-venue {
  padding: $spacing-xs $spacing-md;
  background: transparent;
  border: $border-thin solid $color-border-light;
  border-radius: 999px;
  color: $color-text-secondary;
  font: inherit;
  cursor: pointer;

  &.current {
    border-color: $color-accent;
    color: $color-accent;
  }
}
</style>
