<script setup lang="ts">
import { getPlayerName } from '@/api';
import { getAssignmentColor } from '@/utils/colors';
import type { MapConfig } from '@shared/types';
import type { MapResult } from '@/composables/useRotationCalculator';

const props = defineProps<{
  results: MapResult[];
  maps: MapConfig[];
  selectedConfigurations: Record<string, number>;
  selectedPlans: Record<string, string>;
  loadedPlans: Record<string, MapConfig>;
}>();

defineEmits<{
  selectConfiguration: [mapId: string, configIndex: number];
  selectPlan: [mapId: string, planId: string];
}>();

function isConfigSelected(mapId: string, configIndex: number): boolean {
  return props.selectedConfigurations[mapId] === configIndex;
}

function isMainRoleForPlayer(mapId: string, playerId: string, assignmentId: number): boolean {
  // Use loaded plan if available
  const planId = props.selectedPlans[mapId];
  const effectiveMap = (planId && props.loadedPlans[planId])
    ? props.loadedPlans[planId]
    : props.maps.find(m => m.id === mapId);
  if (!effectiveMap) return false;
  const playerAssignment = effectiveMap.players.find(p => p.playerId === playerId);
  return playerAssignment?.mainAssignmentId === assignmentId;
}

function getMapPlans(mapId: string) {
  const map = props.maps.find(m => m.id === mapId);
  return map?.gamePlans || [];
}

// Get assignment name from loaded plan or fallback to base map
function getAssignmentName(mapId: string, assignmentId: number): string {
  const planId = props.selectedPlans[mapId];
  const effectiveMap = (planId && props.loadedPlans[planId])
    ? props.loadedPlans[planId]
    : props.maps.find(m => m.id === mapId);
  if (!effectiveMap) return `Assignment #${assignmentId}`;
  const assignment = effectiveMap.assignments.find(a => a.id === assignmentId);
  return assignment?.name || `Assignment #${assignmentId}`;
}
</script>

<template>
  <div class="results">
    <div
      v-for="result in results"
      :key="result.mapId"
      class="result-card"
      :class="{ 'has-errors': result.errors.length > 0 }"
    >
      <div class="result-header">
        <h3>{{ result.mapName }}</h3>
        <select
          v-if="getMapPlans(result.mapId).length > 1"
          class="plan-select"
          :value="selectedPlans[result.mapId] || ''"
          @change="$emit('selectPlan', result.mapId, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="plan in getMapPlans(result.mapId)"
            :key="plan.id"
            :value="plan.id"
          >
            {{ plan.name }}
          </option>
        </select>
        <span v-else-if="result.planName" class="plan-name">{{ result.planName }}</span>
      </div>

      <div v-if="result.errors.length > 0" class="result-errors">
        <div v-for="(error, i) in result.errors" :key="i" class="error-row">
          <span class="error-icon">⚠</span>
          <span>{{ error }}</span>
        </div>
      </div>

      <div v-else class="result-configurations">
        <div class="config-count">
          {{ result.configurations.length }} configuration(s) possible(s)
        </div>

        <div
          v-for="(config, i) in result.configurations.slice(0, 10)"
          :key="i"
          class="configuration"
          :class="{ selected: isConfigSelected(result.mapId, i) }"
          @click="$emit('selectConfiguration', result.mapId, i)"
        >
          <span class="config-selector">
            {{ isConfigSelected(result.mapId, i) ? '●' : '○' }}
          </span>
          <span
            v-for="(playerId, assignmentId) in config.assignments"
            :key="assignmentId"
            class="assignment"
          >
            <span
              class="assignment-tag"
              :style="{
                borderColor: getAssignmentColor(Number(assignmentId)),
                color: getAssignmentColor(Number(assignmentId))
              }"
            >
              <span v-if="isMainRoleForPlayer(result.mapId, playerId, Number(assignmentId))" class="main-star">★</span>
              {{ getAssignmentName(result.mapId, Number(assignmentId)) }}
            </span>
            <span class="player-name">{{ getPlayerName(playerId) }}</span>
          </span>
        </div>

        <div v-if="result.configurations.length > 10" class="more-configs">
          ... et {{ result.configurations.length - 10 }} autre(s) configuration(s)
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.results {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  border-top: 1px solid $color-border;
  padding-top: $spacing-lg;
}

.result-card {
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: 6px;
  padding: $spacing-md;

  &.has-errors {
    border-color: rgba($color-danger, 0.5);
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    color: $color-white;
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.plan-name {
  font-size: 0.75rem;
  color: $color-text-secondary;
  background: $color-bg-tertiary;
  padding: 0.2rem 0.5rem;
  border-radius: $radius-sm;
}

.plan-select {
  padding: 0.25rem 0.5rem;
  background: $color-bg-secondary;
  border: 1px solid $color-text-secondary;
  border-radius: $radius-sm;
  color: $color-text-muted;
  font-size: 0.8rem;
  cursor: pointer;

  option {
    background: $color-bg-secondary;
  }
}

.result-errors {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.error-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  color: $color-danger;
  font-size: 0.85rem;
}

.error-icon {
  flex-shrink: 0;
}

.result-configurations {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.config-count {
  color: $color-success;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: $spacing-xs;
}

.configuration {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: $spacing-sm;
  background: $color-bg-secondary;
  border-radius: $radius-sm;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  align-items: center;

  &:hover {
    background: $color-bg-tertiary;
    border-color: $color-border;
  }

  &.selected {
    background: rgba($color-success, 0.1);
    border-color: $color-success;

    .config-selector {
      color: $color-success;
    }
  }
}

.config-selector {
  color: $color-text-secondary;
  font-size: 0.9rem;
  margin-right: $spacing-xs;
}

.assignment {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.assignment-tag {
  padding: 0.15rem 0.4rem;
  border: 1px solid;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;

  .main-star {
    margin-right: 0.15rem;
    font-size: 0.9em;
    color: $color-star;
  }
}

.player-name {
  color: $color-white;
  font-size: 0.85rem;
}

.more-configs {
  color: $color-text-secondary;
  font-size: 0.8rem;
  font-style: italic;
  padding-top: $spacing-xs;
}
</style>
