<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import MapViewer from '@/components/planner/MapViewer.vue';
import Toolbar from '@/components/planner/Toolbar.vue';
import Sidebar from '@/components/planner/Sidebar.vue';
import Drawer from '@/components/common/Drawer.vue';
import PlannerNotesPanel from '@/components/planner/PlannerNotesPanel.vue';
import { fetchAllMaps, fetchPlayers, saveGamePlan } from '@/api';
import { getPlayerAssignments } from '@/utils/balance';
import { getAssignmentColor } from '@/utils/colors';
import { useAuth } from '@/composables/useAuth';
import { usePlannerPlans } from '@/composables/usePlannerPlans';
import { usePlannerNotes } from '@/composables/usePlannerNotes';
import type { MapConfig, Player, GamePhase } from '@shared/types';

const { permissions } = useAuth();
const canEdit = computed(() => permissions.value.canEdit);

// Core state
const selectedMapId = ref<string | null>(null);
const selectedPlayerId = ref<string | null>(null);
const activeAssignments = ref<number[]>([]);
const editMode = ref(false);
const isLoading = ref(true);
const currentPhase = ref<GamePhase>('START');
const showNotesDrawer = ref(false);

const maps = ref<MapConfig[]>([]);
const editableMaps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);
const mapViewerRef = ref<InstanceType<typeof MapViewer> | null>(null);

// Use plans composable
const {
  selectedPlanId,
  currentMapPlans,
  selectPlan,
  createPlan,
  duplicatePlan,
  deletePlan,
  renamePlan,
} = usePlannerPlans({
  maps,
  editableMaps,
  selectedMapId,
  editMode,
});

// Selected assignment computed
const selectedAssignmentId = computed<number | null>(() => {
  return activeAssignments.value.length > 0 ? activeAssignments.value[0] ?? null : null;
});

// Use notes composable
const {
  localGeneralNotes,
  localPhaseNotes,
  localRoleNotes,
  localRolePhaseNotes,
  updateGeneralNotes,
  updatePhaseNotes,
  updateRoleNotes,
  updateRolePhaseNotes,
} = usePlannerNotes({
  maps,
  editableMaps,
  selectedMapId,
  editMode,
  currentPhase,
  selectedAssignmentId,
});

// Computed
const currentMap = computed(() => {
  const source = editMode.value ? editableMaps.value : maps.value;
  return source.find(m => m.id === selectedMapId.value) || null;
});

const selectedAssignmentName = computed(() => {
  if (!currentMap.value || activeAssignments.value.length === 0) return null;
  const assignment = currentMap.value.assignments.find(a => a.id === activeAssignments.value[0]);
  return assignment?.name || null;
});

const selectedAssignmentColor = computed(() => {
  const assignmentId = selectedAssignmentId.value;
  if (assignmentId === null) return undefined;
  return getAssignmentColor(assignmentId);
});

// Load initial data
onMounted(async () => {
  try {
    const [loadedPlayers, loadedMaps] = await Promise.all([
      fetchPlayers(),
      fetchAllMaps()
    ]);

    players.value = loadedPlayers;
    maps.value = loadedMaps;
    editableMaps.value = JSON.parse(JSON.stringify(loadedMaps));

    const firstMap = maps.value[0];
    if (firstMap) {
      selectedMapId.value = firstMap.id;
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    isLoading.value = false;
  }
});

// Reset assignments when map changes
watch(selectedMapId, () => {
  activeAssignments.value = [];
});

// Selection handlers
function selectMap(mapId: string) {
  selectedMapId.value = mapId;
}

function selectPlayer(playerId: string | null) {
  const newPlayerId = selectedPlayerId.value === playerId ? null : playerId;
  selectedPlayerId.value = newPlayerId;

  const currentAssignment = activeAssignments.value[0];
  if (currentAssignment && newPlayerId && currentMap.value) {
    const playerAssignmentIds = getPlayerAssignments(currentMap.value, newPlayerId);
    if (!playerAssignmentIds.includes(currentAssignment)) {
      activeAssignments.value = [];
    }
  }
}

function toggleAssignment(assignmentId: number) {
  if (activeAssignments.value.includes(assignmentId)) {
    activeAssignments.value = [];
  } else {
    activeAssignments.value = [assignmentId];
  }
}

// Edit mode handlers
function toggleEditMode() {
  if (!editMode.value) {
    editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  }
  editMode.value = !editMode.value;
}

function cancelEdit() {
  editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  editMode.value = false;
}

function handleMapUpdate(updatedMap: MapConfig) {
  const index = editableMaps.value.findIndex(m => m.id === updatedMap.id);
  if (index !== -1) {
    editableMaps.value[index] = updatedMap;
  }
}

function handlePlayerAssignmentChanged(playerId: string, assignmentId: number, associated: boolean) {
  if (!associated && activeAssignments.value.includes(assignmentId) && selectedPlayerId.value === playerId) {
    activeAssignments.value = [];
  }
}

function handleMainAssignmentChanged(playerId: string, assignmentId: number | null) {
  const map = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (!map) return;
  const playerAssignment = map.players.find(p => p.userId === playerId);
  if (playerAssignment) {
    playerAssignment.mainAssignmentId = assignmentId ?? undefined;
  }
}

async function saveChanges() {
  const mapToSave = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (!mapToSave) return;

  const token = localStorage.getItem('token');
  if (!token) {
    alert('❌ Non authentifié');
    return;
  }

  const gamePlanId = selectedPlanId.value;
  if (!gamePlanId) {
    alert('❌ Aucun plan de jeu sélectionné');
    return;
  }

  try {
    await saveGamePlan(gamePlanId, {
      assignments: mapToSave.assignments,
      players: mapToSave.players,
      notes: mapToSave.notes,
    }, token);

    const index = maps.value.findIndex(m => m.id === mapToSave.id);
    if (index !== -1) {
      maps.value[index] = JSON.parse(JSON.stringify(mapToSave));
    }

    alert(`✅ Map "${mapToSave.name}" sauvegardée !`);
  } catch (error) {
    console.error('Save error:', error);
    alert(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

function handleAddMarker() {
  if (mapViewerRef.value && activeAssignments.value.length > 0) {
    mapViewerRef.value.addMarkerFromToolbar(activeAssignments.value[0] as number);
  }
}

function handleAddZone() {
  if (mapViewerRef.value && activeAssignments.value.length > 0) {
    mapViewerRef.value.addZoneFromToolbar(activeAssignments.value[0] as number);
  }
}
</script>

<template>
  <div class="planner-page">
    <!-- Toolbar injected into TopBar -->
    <Teleport to="#topbar-dynamic-content">
      <Toolbar
        :players="players"
        :selectedPlayerId="selectedPlayerId"
        :map="currentMap"
        :maps="maps"
        :activeAssignments="activeAssignments"
        :editMode="editMode"
        :isLoading="isLoading"
        :canEdit="canEdit"
        :currentPhase="currentPhase"
        :plans="currentMapPlans"
        :selectedPlanId="selectedPlanId"
        @select-player="selectPlayer"
        @toggle-assignment="toggleAssignment"
        @update:currentPhase="currentPhase = $event"
        @select-plan="selectPlan"
        @create-plan="createPlan"
        @duplicate-plan="duplicatePlan"
        @delete-plan="deletePlan"
        @rename-plan="renamePlan"
      />
    </Teleport>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading">
      Chargement des maps...
    </div>

    <template v-else>
      <div class="main-content">
        <Sidebar
          :maps="maps"
          :selectedMapId="selectedMapId"
          :editMode="editMode"
          :canEdit="canEdit"
          :hasActiveAssignment="activeAssignments.length > 0"
          @select-map="selectMap"
          @toggle-edit="toggleEditMode"
          @add-marker="handleAddMarker"
          @add-zone="handleAddZone"
          @save="saveChanges"
          @cancel="cancelEdit"
        />

        <MapViewer
          v-if="currentMap"
          ref="mapViewerRef"
          :map="currentMap"
          :players="players"
          :selectedPlayerId="selectedPlayerId"
          :activeAssignments="activeAssignments"
          :editMode="editMode"
          :currentPhase="currentPhase"
          :drawerOpen="showNotesDrawer"
          @update:map="handleMapUpdate"
          @player-assignment-changed="handlePlayerAssignmentChanged"
          @main-assignment-changed="handleMainAssignmentChanged"
        />

        <div v-else class="no-map">
          Sélectionnez une map
        </div>

        <!-- Notes Drawer -->
        <Drawer v-model="showNotesDrawer" title="Stratégie" icon="notes">
          <PlannerNotesPanel
            :editMode="editMode"
            :currentPhase="currentPhase"
            :selectedAssignmentName="selectedAssignmentName"
            :selectedAssignmentColor="selectedAssignmentColor"
            :localGeneralNotes="localGeneralNotes"
            :localPhaseNotes="localPhaseNotes"
            :localRoleNotes="localRoleNotes"
            :localRolePhaseNotes="localRolePhaseNotes"
            @update:localGeneralNotes="localGeneralNotes = $event"
            @update:localPhaseNotes="localPhaseNotes = $event"
            @update:localRoleNotes="localRoleNotes = $event"
            @update:localRolePhaseNotes="localRolePhaseNotes = $event"
            @updateGeneralNotes="updateGeneralNotes"
            @updatePhaseNotes="updatePhaseNotes"
            @updateRoleNotes="updateRoleNotes"
            @updateRolePhaseNotes="updateRolePhaseNotes"
          />
        </Drawer>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.planner-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  background: $color-bg-primary;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;

  @include mobile-lg {
    flex-direction: column;
  }
}


.no-map,
.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  font-size: 1.5rem;

  @include mobile-lg {
    font-size: 1.2rem;
  }

  @include mobile {
    font-size: 1rem;
  }
}
</style>
