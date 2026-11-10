<script setup lang="ts">
// The space of a venue manager: the venue they manage, and the divisions of
// its local league, which tell each team the days of its division
import { computed, onMounted, ref } from 'vue';
import type { ManagedVenue } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchManagedVenues } from '@/api';
import { useErrors } from '@/composables/useErrors';
import SubjectIcon from '@/components/common/SubjectIcon.vue';
import DivisionBoard from '@/components/manager/DivisionBoard.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const { errors, setErrorFromException } = useErrors();
const venues = ref<ManagedVenue[]>([]);
const isLoading = ref(true);
const venueId = ref<string | null>(null);

const venue = computed(() => venues.value.find(candidate => candidate.id === venueId.value) ?? null);

onMounted(async () => {
  try {
    venues.value = await fetchManagedVenues();
    venueId.value = venues.value[0]?.id ?? null;
  } catch (error) {
    setErrorFromException(error, ERROR.managedVenuesFetchFailed);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="manager-page">
    <div class="manager-column">
      <p v-if="isLoading" class="manager-note">Chargement…</p>
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
              :class="{ current: candidate.id === venueId }"
              :aria-selected="candidate.id === venueId"
              @click="venueId = candidate.id"
            >{{ candidate.name }}</button>
          </div>
        </header>

        <section class="manager-section">
          <h2><SubjectIcon subject="competition" size="22px" />Divisions de la ligue</h2>
          <p class="manager-intro">
            Place chaque équipe de ta ligue dans sa division. C'est d'après ces divisions que les équipes recevront les
            journées de la leur. Le site de la ligue ne dit les divisions d'un mois qu'au tirage : pars du dernier mois
            tiré, déplace les équipes qui sont montées ou descendues, puis enregistre.
          </p>
          <DivisionBoard :key="venue.id" :venue-id="venue.id" />
        </section>

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

.manager-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: with-alpha($color-bg-secondary, 0.6);
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;

  h2 {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin: 0;
    font-size: $font-size-xl;
    color: $color-text-primary;
  }
}

.manager-intro {
  margin: 0;
  max-width: 70ch;
  color: $color-text-secondary;
}
</style>
