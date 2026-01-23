<script setup lang="ts">
/**
 * PlannerBody - Layout component
 * Wrapper for the main planner content area.
 * Contains MapViewer functional component.
 */
import { ref } from 'vue';
import MapViewer from '@/components/planner/MapViewer.vue';
import type { MapConfig, Player, GamePhase } from '@shared/types';

defineProps<{
  map: MapConfig | null;
  players: Player[];
  selectedPlayerId: string | null;
  activeAssignments: number[];
  editMode: boolean;
  currentPhase: GamePhase;
  drawerOpen: boolean;
}>();

defineEmits<{
  'update:map': [map: MapConfig];
  'player-assignment-changed': [playerId: string, assignmentId: number, associated: boolean];
  'main-assignment-changed': [playerId: string, assignmentId: number | null];
}>();

const mapViewerRef = ref<InstanceType<typeof MapViewer> | null>(null);

// Expose methods that delegate to MapViewer
function addMarkerFromToolbar(assignmentId: number) {
  mapViewerRef.value?.addMarkerFromToolbar(assignmentId);
}

function addZoneFromToolbar(assignmentId: number) {
  mapViewerRef.value?.addZoneFromToolbar(assignmentId);
}

defineExpose({
  addMarkerFromToolbar,
  addZoneFromToolbar,
});
</script>

<template>
  <div class="planner-body">
    <MapViewer
      v-if="map"
      ref="mapViewerRef"
      :map="map"
      :players="players"
      :selected-player-id="selectedPlayerId"
      :active-assignments="activeAssignments"
      :edit-mode="editMode"
      :current-phase="currentPhase"
      :drawer-open="drawerOpen"
      @update:map="$emit('update:map', $event)"
      @player-assignment-changed="(playerId, assignmentId, associated) => $emit('player-assignment-changed', playerId, assignmentId, associated)"
      @main-assignment-changed="(playerId, assignmentId) => $emit('main-assignment-changed', playerId, assignmentId)"
    />

    <div v-else class="no-map">
      Sélectionnez une map
    </div>
  </div>
</template>

<style scoped lang="scss">
.planner-body {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.no-map {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 1.1rem;
}
</style>
