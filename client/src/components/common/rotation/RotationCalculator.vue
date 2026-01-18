﻿<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useRotationCalculator } from '@/composables/useRotationCalculator';
import RotationResults from './RotationResults.vue';
import RotationExport from './RotationExport.vue';
import type { MapConfig, Player, MatchGamePlan } from '@shared/types';

const props = withDefaults(
  defineProps<{
    maps: MapConfig[];
    players: Player[];
    mode?: 'standalone' | 'associate';
  }>(),
  {
    mode: 'standalone',
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
  canExport,
  exportHeaders,
  previewGamePlan,
  selectAllMaps,
  deselectAllMaps,
  toggleMap,
  selectPlan,
  selectConfiguration,
  exportToClipboard,
  exportToPng,
  buildMatchGamePlan,
} = useRotationCalculator({
  maps: toRef(props, 'maps'),
  players: toRef(props, 'players'),
});

// Handle "Associer" button click
function handleAssociate() {
  const gamePlan = buildMatchGamePlan();
  if (gamePlan) {
    emit('associate', gamePlan);
  }
}

// Wrap exportToPng to handle the element ref
function handleExportPng(element: HTMLElement) {
  exportToPng(element);
}

const showResults = computed(() => hasCalculated.value && results.value);
const showExport = computed(() => hasCalculated.value && results.value && canExport.value);
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Calculateur de rotation</h2>
        <button class="btn-close" @click="$emit('close')">✕</button>
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

        <!-- Export Section -->
        <RotationExport
          v-if="showExport && selectedAbsentPlayer"
          :selectedAbsentPlayerId="selectedAbsentPlayer"
          :exportHeaders="exportHeaders"
          :previewGamePlan="previewGamePlan"
          :mode="mode"
          @exportClipboard="exportToClipboard"
          @exportPng="handleExportPng"
          @associate="handleAssociate"
        />
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
  background: rgba(0, 0, 0, 0.7);
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
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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
    color: #fff;
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
    color: #fff;
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
    color: #aaa;
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
    border: 2px solid #666;
    background: transparent;
    color: #ccc;
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
      color: #fff;
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
  border: 1px solid #444;
  color: #aaa;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    color: #fff;
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
  border: 1px solid #444;
  border-radius: $radius-sm;
  color: #aaa;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: #666;
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
</style>
