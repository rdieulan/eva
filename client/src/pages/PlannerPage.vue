<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import MapList from '@/components/MapList.vue';
import MapViewer from '@/components/MapViewer.vue';
import PlannerToolbar from '@/components/planner/PlannerToolbar.vue';
import Drawer from '@/components/common/Drawer.vue';
import { fetchAllMaps, fetchPlayers, fetchGamePlan, createGamePlan, deleteGamePlan, saveGamePlan } from '@/api';
import { getPlayerAssignments } from '@/services';
import { useAuth } from '@/composables/useAuth';
import { DEFAULT_GAME_PLAN_NOTES, PHASE_LABELS } from '@shared/types';
import type { MapConfig, Player, GamePhase, GamePlanNotes, GamePlanSummary } from '@/types';

const { permissions } = useAuth();

const canEdit = computed(() => permissions.value.canEdit);

const selectedMapId = ref<string | null>(null);
const selectedPlanId = ref<string | null>(null);
const selectedPlayerId = ref<string | null>(null);
const activeAssignments = ref<number[]>([]);
const editMode = ref(false);
const isLoading = ref(true);
const currentPhase = ref<GamePhase>('START');
const showNotesDrawer = ref(false);

const maps = ref<MapConfig[]>([]);
const editableMaps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);

onMounted(async () => {
  try {
    // Load players and maps in parallel
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

const currentMap = computed(() => {
  const source = editMode.value ? editableMaps.value : maps.value;
  return source.find(m => m.id === selectedMapId.value) || null;
});

// Available plans for current map
const currentMapPlans = computed<GamePlanSummary[]>(() => {
  return currentMap.value?.gamePlans || [];
});

// Current map notes (from editable map in edit mode)
const currentNotes = computed<GamePlanNotes>(() => {
  const map = editMode.value
    ? editableMaps.value.find(m => m.id === selectedMapId.value)
    : maps.value.find(m => m.id === selectedMapId.value);
  return map?.notes || { ...DEFAULT_GAME_PLAN_NOTES };
});

// Local notes for inline editing
const localGeneralNotes = ref('');
const localPhaseNotes = ref('');

// Sync local notes when currentNotes or currentPhase changes
watch([currentNotes, currentPhase], ([notes, phase]) => {
  localGeneralNotes.value = notes.general;
  localPhaseNotes.value = notes.phases[phase];
}, { immediate: true });

// Current phase label
const currentPhaseLabel = computed(() => PHASE_LABELS[currentPhase.value]);

function updateGeneralNotes() {
  if (!editMode.value || !selectedMapId.value) return;
  const map = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (map) {
    map.notes = {
      ...map.notes || { ...DEFAULT_GAME_PLAN_NOTES },
      general: localGeneralNotes.value,
    };
  }
}

function updatePhaseNotes() {
  if (!editMode.value || !selectedMapId.value) return;
  const map = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (map) {
    const existingNotes = map.notes || { ...DEFAULT_GAME_PLAN_NOTES };
    map.notes = {
      ...existingNotes,
      phases: {
        ...existingNotes.phases,
        [currentPhase.value]: localPhaseNotes.value,
      },
    };
  }
}

// Update selectedPlanId and reset activeAssignments when map changes
watch(selectedMapId, () => {
  // Reset active assignments
  activeAssignments.value = [];

  // Select first plan of new map
  const map = maps.value.find(m => m.id === selectedMapId.value);
  const firstPlan = map?.gamePlans?.[0];
  if (firstPlan) {
    selectedPlanId.value = firstPlan.id;
  } else {
    selectedPlanId.value = null;
  }
});

// Load plan data when selected plan changes
async function handleSelectPlan(planId: string) {
  if (!selectedMapId.value || planId === selectedPlanId.value) return;

  try {
    const planData = await fetchGamePlan(planId);
    if (planData) {
      // Update the map data with the selected plan's data
      const mapIndex = maps.value.findIndex(m => m.id === selectedMapId.value);
      const existingMap = maps.value[mapIndex];
      if (mapIndex !== -1 && existingMap) {
        maps.value[mapIndex] = {
          ...existingMap,
          assignments: planData.assignments,
          players: planData.players,
          notes: planData.notes,
        };
        // Also update editable if in edit mode
        if (editMode.value) {
          editableMaps.value[mapIndex] = JSON.parse(JSON.stringify(maps.value[mapIndex]));
        }
      }
      selectedPlanId.value = planId;
    }
  } catch (error) {
    console.error('Error loading plan:', error);
  }
}

async function handleCreatePlan() {
  if (!selectedMapId.value) return;

  const name = prompt('Nom du nouveau plan :');
  if (!name?.trim()) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const newPlan = await createGamePlan(selectedMapId.value, name.trim(), token);
    if (newPlan) {
      // Add to current map's plans list
      const map = maps.value.find(m => m.id === selectedMapId.value);
      if (map) {
        map.gamePlans = [...(map.gamePlans || []), { id: newPlan.id, name: newPlan.name }];
      }
      // Select the new plan
      await handleSelectPlan(newPlan.id);
    }
  } catch (error) {
    console.error('Error creating plan:', error);
    alert('Erreur lors de la création du plan');
  }
}

async function handleDuplicatePlan(planId: string) {
  if (!selectedMapId.value) return;

  const sourcePlan = currentMapPlans.value.find(p => p.id === planId);
  const name = prompt('Nom du plan dupliqué :', `${sourcePlan?.name || 'Plan'} (copie)`);
  if (!name?.trim()) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    // Create new plan then copy data from source
    const newPlan = await createGamePlan(selectedMapId.value, name.trim(), token);
    if (newPlan && currentMap.value) {
      // Save current data to new plan
      await saveGamePlan(newPlan.id, {
        assignments: currentMap.value.assignments,
        players: currentMap.value.players,
        notes: currentMap.value.notes,
      }, token);

      // Add to plans list
      const map = maps.value.find(m => m.id === selectedMapId.value);
      if (map) {
        map.gamePlans = [...(map.gamePlans || []), { id: newPlan.id, name: newPlan.name }];
      }
      await handleSelectPlan(newPlan.id);
    }
  } catch (error) {
    console.error('Error duplicating plan:', error);
    alert('Erreur lors de la duplication du plan');
  }
}

async function handleDeletePlan(planId: string) {
  if (!selectedMapId.value) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await deleteGamePlan(planId, token);

    // Remove from list
    const map = maps.value.find(m => m.id === selectedMapId.value);
    if (map) {
      map.gamePlans = map.gamePlans?.filter(p => p.id !== planId) || [];

      // Select another plan if available
      if (map.gamePlans.length > 0 && map.gamePlans[0]) {
        await handleSelectPlan(map.gamePlans[0].id);
      } else {
        selectedPlanId.value = null;
      }
    }
  } catch (error) {
    console.error('Error deleting plan:', error);
    alert('Erreur lors de la suppression du plan');
  }
}

async function handleRenamePlan(planId: string, newName: string) {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await saveGamePlan(planId, { name: newName }, token);

    // Update in local list
    const map = maps.value.find(m => m.id === selectedMapId.value);
    if (map) {
      const plan = map.gamePlans?.find(p => p.id === planId);
      if (plan) {
        plan.name = newName;
      }
    }
  } catch (error) {
    console.error('Error renaming plan:', error);
  }
}

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

function handleMainAssignmentChanged(playerId: string, assignmentId: number | null) {
  // Update the main assignment for this player in the current map
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

    // Update local maps with saved data
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
        :currentPhase="currentPhase"
        :plans="currentMapPlans"
        :selectedPlanId="selectedPlanId"
        @select-player="selectPlayer"
        @toggle-assignment="toggleAssignment"
        @toggle-edit="toggleEditMode"
        @save="saveChanges"
        @cancel="cancelEdit"
        @update:currentPhase="currentPhase = $event"
        @select-plan="handleSelectPlan"
        @create-plan="handleCreatePlan"
        @duplicate-plan="handleDuplicatePlan"
        @delete-plan="handleDeletePlan"
        @rename-plan="handleRenamePlan"
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
          :currentPhase="currentPhase"
          :drawerOpen="showNotesDrawer"
          @update:map="handleMapUpdate"
          @player-assignment-changed="handlePlayerAssignmentChanged"
          @main-assignment-changed="handleMainAssignmentChanged"
        />

        <div v-else class="no-map">
          Sélectionnez une map
        </div>

        <!-- Notes Panel -->
        <Drawer v-model="showNotesDrawer" title="Notes du plan" icon="notes">
          <div class="notes-sections">
            <div class="notes-section">
              <label class="section-label">Notes générales</label>
              <textarea
                v-if="editMode"
                v-model="localGeneralNotes"
                class="notes-textarea"
                placeholder="Explications générales du plan de jeu..."
                @blur="updateGeneralNotes"
              ></textarea>
              <p v-else class="notes-text">{{ localGeneralNotes || '—' }}</p>
            </div>
            <div class="notes-section">
              <label class="section-label">Notes - Phase {{ currentPhaseLabel }}</label>
              <textarea
                v-if="editMode"
                v-model="localPhaseNotes"
                class="notes-textarea"
                :placeholder="`Explications pour la phase ${currentPhaseLabel}...`"
                @blur="updatePhaseNotes"
              ></textarea>
              <p v-else class="notes-text">{{ localPhaseNotes || '—' }}</p>
            </div>
          </div>
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

// Notes content styles
.notes-sections {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.notes-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding-bottom: $spacing-lg;
  border-bottom: 1px solid $color-border;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.section-label {
  font-size: $font-size-xs;
  font-weight: 600;
  color: $color-text-secondary;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.notes-textarea {
  width: 100%;
  min-height: 100px;
  padding: $spacing-sm;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text-primary;
  font-family: inherit;
  font-size: $font-size-sm;
  line-height: 1.4;
  resize: vertical;
  transition: border-color 0.15s;

  &::placeholder {
    color: $color-text-secondary;
    opacity: 0.6;
  }

  &:focus {
    outline: none;
    border-color: $color-accent;
  }

  @include mobile-lg {
    min-height: 80px;
  }
}

.notes-text {
  margin: 0;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-tertiary;
  border-radius: $radius-sm;
  color: $color-text-primary;
  font-size: $font-size-sm;
  line-height: 1.6;
  white-space: pre-wrap;
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
