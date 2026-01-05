<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import MapList from '../components/MapList.vue';
import MapViewer from '../components/MapViewer.vue';
import PlannerToolbar from '../components/planner/PlannerToolbar.vue';
import { loadAllMaps, loadPlayers, getPlayerAssignments } from '../data/config';
import { useAuth } from '../composables/useAuth';
import type { MapConfig, Player } from '../types';

const { permissions, user } = useAuth();

// Debug: check permissions
const canEdit = computed(() => {
  console.log('User:', user.value);
  console.log('Permissions:', permissions.value);
  return permissions.value.canEdit;
});

const selectedMapId = ref<string | null>(null);
const selectedPlayerId = ref<string | null>(null);
const activeAssignments = ref<number[]>([]);
const editMode = ref(false);
const isLoading = ref(true);

const maps = ref<MapConfig[]>([]);
const editableMaps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);

onMounted(async () => {
  try {
    // Load players and maps in parallel
    const [loadedPlayers, loadedMaps] = await Promise.all([
      loadPlayers(),
      loadAllMaps()
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

const currentMap = computed(() => {
  const source = editMode.value ? editableMaps.value : maps.value;
  return source.find(m => m.id === selectedMapId.value) || null;
});

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

function resetSelection() {
  selectedPlayerId.value = null;
  activeAssignments.value = [];
}

watch(selectedMapId, () => {
  activeAssignments.value = [];
});

function toggleEditMode() {
  if (!editMode.value) {
    editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  }
  editMode.value = !editMode.value;
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

async function saveChanges() {
  console.log('[PLANNER] Save triggered');

  const mapToSave = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (!mapToSave) {
    console.error('[PLANNER] No map to save');
    return;
  }
  console.log('[PLANNER] Saving map:', mapToSave.id, mapToSave.name);

  const token = localStorage.getItem('token');
  if (!token) {
    console.error('[PLANNER] No auth token');
    alert('❌ Non authentifié');
    return;
  }
  console.log('[PLANNER] Auth token present');

  try {
    // Get the first game plan ID for this map
    const gamePlanId = mapToSave.gamePlans?.[0]?.id;
    console.log('[PLANNER] Game plan ID:', gamePlanId);

    if (!gamePlanId) {
      console.error('[PLANNER] No game plan found');
      alert('❌ Aucun plan de jeu trouvé pour cette map');
      return;
    }

    const payload = {
      assignments: mapToSave.assignments,
      players: mapToSave.players
    };
    console.log('[PLANNER] Sending payload:', payload);

    const response = await fetch(`/api/plans/${gamePlanId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    });

    console.log('[PLANNER] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PLANNER] Server error response:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText };
      }
      throw new Error(error.error || `Erreur serveur (${response.status})`);
    }

    const result = await response.json();
    console.log('[PLANNER] Save success, result:', result);

    // Update local maps with saved data
    const index = maps.value.findIndex(m => m.id === mapToSave.id);
    if (index !== -1) {
      maps.value[index] = JSON.parse(JSON.stringify(mapToSave));
    }

    console.log('[PLANNER] Map saved successfully:', mapToSave.id);
    alert(`✅ Map "${mapToSave.name}" sauvegardée !`);
  } catch (error) {
    console.error('[PLANNER] Save error:', error);
    alert(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

function cancelEdit() {
  editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  editMode.value = false;
}
</script>

<template>
  <div class="planner-page">
    <!-- Toolbar injected into TopBar dynamic section -->
    <Teleport to="#topbar-dynamic-content">
      <PlannerToolbar
        :players="players"
        :selectedPlayerId="selectedPlayerId"
        :map="currentMap"
        :maps="maps"
        :activeAssignments="activeAssignments"
        :editMode="editMode"
        :isLoading="isLoading"
        :canEdit="canEdit"
        @select-player="selectPlayer"
        @toggle-assignment="toggleAssignment"
        @toggle-edit="toggleEditMode"
        @save="saveChanges"
        @cancel="cancelEdit"
        @reset="resetSelection"
      />
    </Teleport>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading">
      Chargement des maps...
    </div>

    <template v-else>
      <div class="main-content">
        <MapList
          :maps="maps"
          :selectedMapId="selectedMapId"
          @select="selectMap"
        />

        <MapViewer
          v-if="currentMap"
          :map="currentMap"
          :players="players"
          :selectedPlayerId="selectedPlayerId"
          :activeAssignments="activeAssignments"
          :editMode="editMode"
          @update:map="handleMapUpdate"
          @player-assignment-changed="handlePlayerAssignmentChanged"
        />

        <div v-else class="no-map">
          Sélectionnez une map
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.planner-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  background: #0f0f1a;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.no-map {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1.5rem;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 1.5rem;
}
</style>
