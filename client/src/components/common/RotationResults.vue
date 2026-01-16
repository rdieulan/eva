<script setup lang="ts">
import { getPlayerName } from '@/api';
import { getAssignmentName } from '@/utils/balance';
import { getAssignmentColor } from '@/utils/colors';
import type { MapConfig } from '@shared/types';
import type { MapResult } from '@/composables/useRotationCalculator';

const props = defineProps<{
  results: MapResult[];
  maps: MapConfig[];
  selectedConfigurations: Record<string, number>;
}>();

defineEmits<{
  selectConfiguration: [mapId: string, configIndex: number];
}>();

function isConfigSelected(mapId: string, configIndex: number): boolean {
  return props.selectedConfigurations[mapId] === configIndex;
}

function isMainRoleForPlayer(mapId: string, playerId: string, assignmentId: number): boolean {
  const map = props.maps.find(m => m.id === mapId);
  if (!map) return false;
  const playerAssignment = map.players.find(p => p.userId === playerId);
  return playerAssignment?.mainAssignmentId === assignmentId;
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
      <h3>{{ result.mapName }}</h3>

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
              {{ getAssignmentName(maps, result.mapId, Number(assignmentId)) }}
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
  background: #252540;
  border: 1px solid $color-border;
  border-radius: 6px;
  padding: $spacing-md;

  &.has-errors {
    border-color: rgba($color-danger, 0.5);
  }

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: #fff;
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
    background: #252545;
    border-color: #444;
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
  color: #666;
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
  color: #fff;
  font-size: 0.85rem;
}

.more-configs {
  color: $color-text-secondary;
  font-size: 0.8rem;
  font-style: italic;
  padding-top: $spacing-xs;
}
</style>
