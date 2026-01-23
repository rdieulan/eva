<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useRotationCalculator } from '@/composables/useRotationCalculator';
import RotationResults from './RotationResults.vue';
import GamePlanViewer from '@/components/common/GamePlanViewer.vue';
import type { MapConfig, Player, MatchGamePlan } from '@shared/types';

const props = withDefaults(
  defineProps<{
    maps: MapConfig[];
    players: Player[];
    mode?: 'standalone' | 'associate';
    initialGamePlan?: MatchGamePlan | null;
  }>(),
  {
    mode: 'standalone',
    initialGamePlan: null,
  }
);

const emit = defineEmits<{
  close: [];
  associate: [gamePlan: MatchGamePlan];
}>();

// Use the rotation calculator composable
const {
  selectedAbsentPlayer,
  selectedMaps,
  results,
  hasCalculated,
  selectedConfigurations,
  selectedPlans,
  loadedPlans,
  isLoading,
  previewGamePlan,
  selectAllMaps,
  deselectAllMaps,
  toggleMap,
  selectPlan,
  selectConfiguration,
  buildMatchGamePlan,
} = useRotationCalculator({
  maps: toRef(props, 'maps'),
  players: toRef(props, 'players'),
  initialGamePlan: toRef(props, 'initialGamePlan'),
});

// Handle "Associer" button click
function handleAssociate() {
  const gamePlan = buildMatchGamePlan();
  if (gamePlan) {
    emit('associate', gamePlan);
  }
}

const showResults = computed(() => hasCalculated.value && results.value);
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Calculateur de rotation</h2>
        <button class="btn-close" @click="$emit('close')">?</button>
      </div>

      <div class="modal-body">
        <!-- Absent player selection -->
        <div class="form-group">
          <label>Joueur(se) absent(e) :</label>
          <div class="player-selector">
            <button
              v-for="player in players"
              :key="player.id"
              :class="{ active: selectedAbsentPlayer === player.id }"
              @click="selectedAbsentPlayer = player.id"
            >
              {{ player.name }}
            </button>
          </div>
        </div>

        <!-- Map selection -->
        <div class="form-group">
          <div class="maps-header">
            <label>Maps à analyser :</label>
            <div class="maps-actions">
              <button class="btn-small" @click="selectAllMaps">Tout</button>
              <button class="btn-small" @click="deselectAllMaps">Aucun</button>
            </div>
          </div>
          <div class="maps-selector">
            <label
              v-for="map in maps"
              :key="map.id"
              class="map-checkbox"
              :class="{ checked: selectedMaps.includes(map.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedMaps.includes(map.id)"
                @change="toggleMap(map.id)"
              />
              {{ map.name }}
            </label>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="loading-indicator">
          Chargement des plans...
        </div>

        <!-- Results -->
        <RotationResults
          v-if="showResults && !isLoading"
          :results="results!"
          :maps="maps"
          :selectedConfigurations="selectedConfigurations"
          :selectedPlans="selectedPlans"
          :loadedPlans="loadedPlans"
          @selectConfiguration="selectConfiguration"
          @selectPlan="selectPlan"
        />

        <!-- Game Plan Viewer with export -->
        <div v-if="previewGamePlan" class="export-section">
          <GamePlanViewer :gamePlan="previewGamePlan" />

          <!-- Associate button (only in associate mode) -->
          <button
            v-if="mode === 'associate'"
            class="btn-associate"
            @click="handleAssociate"
          >
            ? Associer au match
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $color-overlay;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 80px;
  z-index: 1000;
}

.modal-content {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  width: 90%;
  max-width: 600px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  box-shadow: 0 10px 40px $color-shadow;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid $color-border;

  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: $color-white;
  }
}

.btn-close {
  background: transparent;
  border: none;
  color: $color-text-secondary;
  font-size: 1.2rem;
  cursor: pointer;
  padding: $spacing-xs $spacing-sm;
  transition: color 0.2s;

  &:hover {
    color: $color-white;
  }
}

.modal-body {
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  label {
    color: $color-text-secondary;
    font-size: 0.9rem;
    font-weight: 600;
  }
}

.player-selector {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;

  button {
    padding: 0.4rem 0.8rem;
    border: 2px solid $color-text-secondary;
    background: transparent;
    color: $color-text-muted;
    border-radius: $radius-sm;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: $color-border-light;
      border-color: $color-text-secondary;
    }

    &.active {
      background: $color-danger;
      border-color: $color-danger;
      color: $color-white;
    }
  }
}

.maps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.maps-actions {
  display: flex;
  gap: $spacing-sm;
}

.btn-small {
  padding: 0.2rem $spacing-sm;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  color: $color-text-secondary;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    color: $color-white;
  }
}

.maps-selector {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.map-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text-secondary;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: $color-text-secondary;
  }

  &.checked {
    background: rgba($color-success, 0.2);
    border-color: $color-success;
    color: $color-success;
  }

  input {
    display: none;
  }
}

.loading-indicator {
  text-align: center;
  padding: $spacing-lg;
  color: $color-text-secondary;
  font-style: italic;
}

.export-section {
  border-top: 1px solid $color-border;
  padding-top: $spacing-lg;
  margin-top: $spacing-md;
}

.btn-associate {
  width: 100%;
  margin-top: $spacing-md;
  padding: 0.75rem;
  background: rgba($color-success, 0.2);
  border: 1px solid $color-success;
  border-radius: $radius-md;
  color: $color-success;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba($color-success, 0.3);
  }
}
</style>
