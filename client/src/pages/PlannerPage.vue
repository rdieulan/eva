<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import type { RouteLocationNormalized } from 'vue-router';
import PlannerTopBar from '@/components/planner/layout/PlannerTopBar.vue';
import PlannerLeftBar from '@/components/planner/layout/PlannerLeftBar.vue';
import PlannerRightDrawer from '@/components/planner/layout/PlannerRightDrawer.vue';
import PlannerBody from '@/components/planner/layout/PlannerBody.vue';
import Modal from '@/components/common/Modal.vue';
import BalanceRulesModal from '@/components/planner/BalanceRulesModal.vue';
import NoTeamMessage from '@/components/common/NoTeamMessage.vue';
import ErrorModal from '@/components/common/error/ErrorModal.vue';
import { fetchAllMaps, fetchPlayers, saveGamePlan } from '@/api';
import { getPlayerAssignments } from '@/utils/balance';
import { getAssignmentColor } from '@/utils/colors';
import { useAuth } from '@/composables/useAuth';
import { usePlannerPlans } from '@/composables/usePlannerPlans';
import { usePlannerNotes } from '@/composables/usePlannerNotes';
import { useErrors } from '@/composables/useErrors';
import { ERROR } from '@shared/constants';
import type { MapConfig, Player, GamePhase } from '@shared/types';

const { permissions, user } = useAuth();
const router = useRouter();
const noTeam = computed(() => !user.value?.teamId);
const canCreate = computed(() => permissions.value.planner.canCreate);
const canEdit = computed(() => permissions.value.planner.canEdit);
const canDelete = computed(() => permissions.value.planner.canDelete);
const canManageBalanceRules = computed(() => permissions.value.planner.canManageBalanceRules);

// Core state
const selectedMapId = ref<string | null>(null);
const selectedPlayerId = ref<string | null>(null);
const activeAssignments = ref<number[]>([]);
const editMode = ref(false);
const isLoading = ref(true);
const currentPhase = ref<GamePhase>('START');
const showNotesDrawer = ref(false);
const showBalanceRulesModal = ref(false);
const saveState = ref<'idle' | 'saving' | 'success' | 'error'>('idle');
const { errors, setError } = useErrors();
const showErrorModal = ref(false);

const maps = ref<MapConfig[]>([]);
const editableMaps = ref<MapConfig[]>([]);
const players = ref<Player[]>([]);
const plannerBodyRef = ref<InstanceType<typeof PlannerBody> | null>(null);

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

// Detect if there are unsaved changes
const hasChanges = computed(() => {
  if (!selectedMapId.value || !editMode.value) return false;

  const originalMap = maps.value.find(m => m.id === selectedMapId.value);
  const editableMap = editableMaps.value.find(m => m.id === selectedMapId.value);

  if (!originalMap || !editableMap) return false;

  return JSON.stringify(originalMap) !== JSON.stringify(editableMap);
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
  // If switching from edit mode to maps mode with unsaved changes
  if (editMode.value && hasChanges.value) {
    pendingAction.value = 'switch-mode';
    showUnsavedChangesModal.value = true;
    return;
  }

  if (!editMode.value) {
    editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  }
  editMode.value = !editMode.value;
}

function cancelEdit() {
  editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  editMode.value = false;
}

// Handle plan selection with unsaved changes check
function handleSelectPlan(planId: string) {
  // If in edit mode with unsaved changes, show confirmation
  if (editMode.value && hasChanges.value) {
    pendingPlanId.value = planId;
    pendingAction.value = 'switch-plan';
    showUnsavedChangesModal.value = true;
    return;
  }

  // Otherwise, just select the plan
  selectPlan(planId);
}

// Handle create plan with unsaved changes check
function handleCreatePlan() {
  if (editMode.value && hasChanges.value) {
    pendingAction.value = 'create-plan';
    showUnsavedChangesModal.value = true;
    return;
  }
  createPlan();
}

// Handle duplicate plan with unsaved changes check
function handleDuplicatePlan(planId: string) {
  if (editMode.value && hasChanges.value) {
    pendingPlanId.value = planId;
    pendingAction.value = 'duplicate-plan';
    showUnsavedChangesModal.value = true;
    return;
  }
  duplicatePlan(planId);
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

// Factorized save logic
async function performSave(): Promise<{ success: boolean; error?: string }> {
  const mapToSave = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (!mapToSave) {
    return { success: false, error: ERROR.mapNotFound };
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return { success: false, error: ERROR.tokenMissing };
  }

  const gamePlanId = selectedPlanId.value;
  if (!gamePlanId) {
    return { success: false, error: ERROR.planNotFound };
  }

  try {
    await saveGamePlan(gamePlanId, {
      assignments: mapToSave.assignments,
      players: mapToSave.players,
      notes: mapToSave.notes,
    });

    const index = maps.value.findIndex(m => m.id === mapToSave.id);
    if (index !== -1) {
      maps.value[index] = JSON.parse(JSON.stringify(mapToSave));
    }

return { success: true };
  } catch (error) {
    console.error('Save error:', error);
    const errorMessage = error instanceof Error ? error.message : ERROR.serverError;
    return { success: false, error: errorMessage };
  }
}

async function saveChanges() {
  saveState.value = 'saving';

  const result = await performSave();

  if (result.success) {
    saveState.value = 'success';
    setTimeout(() => { saveState.value = 'idle'; }, 1500);
  } else {
    setError(result.error || ERROR.serverError);
    showErrorModal.value = true;
    saveState.value = 'error';
    setTimeout(() => { saveState.value = 'idle'; }, 2000);
  }
}

function handleAddMarker() {
  if (plannerBodyRef.value && activeAssignments.value.length > 0) {
    plannerBodyRef.value.addMarkerFromToolbar(activeAssignments.value[0] as number);
  }
}

function handleAddZone() {
  if (plannerBodyRef.value && activeAssignments.value.length > 0) {
    plannerBodyRef.value.addZoneFromToolbar(activeAssignments.value[0] as number);
  }
}

// Unsaved changes confirmation
const showUnsavedChangesModal = ref(false);
const pendingDestination = ref<RouteLocationNormalized | null>(null);
const pendingAction = ref<'navigate' | 'switch-mode' | 'switch-plan' | 'create-plan' | 'duplicate-plan' | null>(null);
const pendingPlanId = ref<string | null>(null);
const modalSaveState = ref<'idle' | 'saving' | 'success' | 'error'>('idle');

// Dynamic modal texts based on pending action
const modalTexts = computed(() => {
  switch (pendingAction.value) {
    case 'navigate':
      return {
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications en cours. Que souhaitez-vous faire ?',
        btnStay: 'Rester sur la page',
        btnLeave: 'Quitter sans sauvegarder',
        btnSave: 'Sauvegarder et quitter',
      };
    case 'switch-mode':
      return {
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications en cours. Que souhaitez-vous faire ?',
        btnStay: 'Continuer l\'édition',
        btnLeave: 'Annuler les modifications',
        btnSave: 'Sauvegarder',
      };
    case 'switch-plan':
      return {
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications en cours sur ce plan. Que souhaitez-vous faire ?',
        btnStay: 'Rester sur ce plan',
        btnLeave: 'Changer sans sauvegarder',
        btnSave: 'Sauvegarder et changer',
      };
    case 'create-plan':
      return {
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications en cours. Que souhaitez-vous faire avant de créer un nouveau plan ?',
        btnStay: 'Rester sur ce plan',
        btnLeave: 'Créer sans sauvegarder',
        btnSave: 'Sauvegarder et créer',
      };
    case 'duplicate-plan':
      return {
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications en cours. Que souhaitez-vous faire avant de dupliquer ?',
        btnStay: 'Rester sur ce plan',
        btnLeave: 'Dupliquer sans sauvegarder',
        btnSave: 'Sauvegarder et dupliquer',
      };
    default:
      return {
        title: 'Modifications non sauvegardées',
        message: 'Vous avez des modifications en cours. Que souhaitez-vous faire ?',
        btnStay: 'Continuer',
        btnLeave: 'Annuler',
        btnSave: 'Sauvegarder',
      };
  }
});

// Handle browser/tab close
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasChanges.value && editMode.value) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

// Handle Vue Router navigation
onBeforeRouteLeave((to, _from, next) => {
  if (hasChanges.value && editMode.value) {
    pendingDestination.value = to;
    pendingAction.value = 'navigate';
    showUnsavedChangesModal.value = true;
    next(false);
  } else {
    next();
  }
});

async function handleSaveAndLeave() {
  modalSaveState.value = 'saving';

  const result = await performSave();

  if (result.success) {
    // Sync editable maps to prevent hasChanges from being true
    editableMaps.value = JSON.parse(JSON.stringify(maps.value));

    modalSaveState.value = 'success';

    // Execute pending action after a short delay to show success state
    setTimeout(() => {
      showUnsavedChangesModal.value = false;
      modalSaveState.value = 'idle';

      if (pendingAction.value === 'navigate' && pendingDestination.value) {
        editMode.value = false;
        router.push(pendingDestination.value.fullPath);
        pendingDestination.value = null;
      } else if (pendingAction.value === 'switch-mode') {
        editMode.value = false;
      } else if (pendingAction.value === 'switch-plan' && pendingPlanId.value) {
        editableMaps.value = JSON.parse(JSON.stringify(maps.value));
        selectPlan(pendingPlanId.value);
        pendingPlanId.value = null;
      } else if (pendingAction.value === 'create-plan') {
        editableMaps.value = JSON.parse(JSON.stringify(maps.value));
        createPlan();
      } else if (pendingAction.value === 'duplicate-plan' && pendingPlanId.value) {
        editableMaps.value = JSON.parse(JSON.stringify(maps.value));
        duplicatePlan(pendingPlanId.value);
        pendingPlanId.value = null;
      }

      pendingAction.value = null;
    }, 800);
  } else {
    setError(result.error || ERROR.serverError);
    showErrorModal.value = true;
    modalSaveState.value = 'error';
    setTimeout(() => { modalSaveState.value = 'idle'; }, 2000);
  }
}

function handleLeaveWithoutSaving() {
  // Reset changes to allow navigation
  editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  showUnsavedChangesModal.value = false;

  if (pendingAction.value === 'navigate' && pendingDestination.value) {
    editMode.value = false;
    router.push(pendingDestination.value.fullPath);
    pendingDestination.value = null;
  } else if (pendingAction.value === 'switch-mode') {
    editMode.value = false;
  } else if (pendingAction.value === 'switch-plan' && pendingPlanId.value) {
    selectPlan(pendingPlanId.value);
    pendingPlanId.value = null;
  } else if (pendingAction.value === 'create-plan') {
    createPlan();
  } else if (pendingAction.value === 'duplicate-plan' && pendingPlanId.value) {
    duplicatePlan(pendingPlanId.value);
    pendingPlanId.value = null;
  }

  pendingAction.value = null;
}

function handleCancelLeave() {
  showUnsavedChangesModal.value = false;
  pendingDestination.value = null;
  pendingPlanId.value = null;
  pendingAction.value = null;
  modalSaveState.value = 'idle';
}
</script>

<template>
  <div class="planner-page">
    <!-- Toolbar injected into TopBar -->
    <Teleport to="#topbar-dynamic-content">
      <PlannerTopBar
        :players="players"
        :selectedPlayerId="selectedPlayerId"
        :map="currentMap"
        :maps="maps"
        :activeAssignments="activeAssignments"
        :editMode="editMode"
        :isLoading="isLoading"
        :canCreate="canCreate"
        :canEdit="canEdit"
        :canDelete="canDelete"
        :canManageBalanceRules="canManageBalanceRules"
        :currentPhase="currentPhase"
        :plans="currentMapPlans"
        :selectedPlanId="selectedPlanId"
        @select-player="selectPlayer"
        @toggle-assignment="toggleAssignment"
        @update:currentPhase="currentPhase = $event"
        @select-plan="handleSelectPlan"
        @create-plan="handleCreatePlan"
        @duplicate-plan="handleDuplicatePlan"
        @delete-plan="deletePlan"
        @rename-plan="renamePlan"
        @open-balance-rules="showBalanceRulesModal = true"
      />
    </Teleport>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading">
      Chargement des maps...
    </div>

    <!-- No team state -->
    <NoTeamMessage v-else-if="noTeam" />

    <template v-else>
      <div class="main-content">
        <PlannerLeftBar
          :maps="maps"
          :selectedMapId="selectedMapId"
          :editMode="editMode"
          :canEdit="canEdit"
          :hasActiveAssignment="activeAssignments.length > 0"
          :saveState="saveState"
          :hasChanges="hasChanges"
          @select-map="selectMap"
          @toggle-edit="toggleEditMode"
          @add-marker="handleAddMarker"
          @add-zone="handleAddZone"
          @save="saveChanges"
          @cancel="cancelEdit"
        />

        <PlannerBody
          ref="plannerBodyRef"
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


        <!-- Notes Drawer -->
        <PlannerRightDrawer
          v-model="showNotesDrawer"
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
      </div>
    </template>

    <!-- Unsaved changes confirmation modal -->
    <Modal :open="showUnsavedChangesModal" :show-close-button="false" @close="handleCancelLeave">
      <template #header>
        <h3>{{ modalTexts.title }}</h3>
      </template>

      <p class="modal-message">{{ modalTexts.message }}</p>

      <template #footer>
        <div class="modal-actions">
          <button class="btn-stay" @click="handleCancelLeave">
            <span class="btn-emoji">✏️</span>
            {{ modalTexts.btnStay }}
          </button>
          <button class="btn-leave" @click="handleLeaveWithoutSaving">
            <span class="btn-emoji">✕</span>
            {{ modalTexts.btnLeave }}
          </button>
          <button
            class="btn-save-leave"
            :class="{
              'is-saving': modalSaveState === 'saving',
              'is-success': modalSaveState === 'success',
              'is-error': modalSaveState === 'error'
            }"
            :disabled="modalSaveState === 'saving'"
            @click="handleSaveAndLeave"
          >
            <span v-if="modalSaveState === 'saving'" class="btn-spinner"></span>
            <span v-else-if="modalSaveState === 'success'" class="btn-check">✓</span>
            <span v-else-if="modalSaveState === 'error'" class="btn-error">✕</span>
            <template v-else>
              <span class="btn-emoji">💾</span>
              {{ modalTexts.btnSave }}
            </template>
          </button>
        </div>
      </template>
    </Modal>

    <!-- Balance Rules Modal -->
    <BalanceRulesModal
      v-if="showBalanceRulesModal"
      @close="showBalanceRulesModal = false"
    />

    <!-- Error Modal -->
    <ErrorModal
      :open="showErrorModal"
      :errors="errors"
      @close="showErrorModal = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;
@use 'sass:color';

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

.btn-stay {
  @include btn-base($color-edit);
}

.modal-message {
  color: $color-text-secondary;
  line-height: 1.5;
  margin: 0;
  padding: $spacing-md 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  width: 100%;
}

.btn-leave {
  @include btn-base($color-danger);
}

.btn-save-leave {
  @include btn-base($color-accent);
  min-width: 160px;

  &.is-saving {
    background: rgba($color-accent, 0.15);
    border-color: rgba($color-accent, 0.4);
  }

  &.is-success {
    background: rgba($color-success, 0.15) !important;
    border-color: rgba($color-success, 0.4) !important;
    animation: pulse-success 0.3s ease-out;
  }

  &.is-error {
    background: rgba($color-danger, 0.15) !important;
    border-color: rgba($color-danger, 0.4) !important;
    animation: shake 0.3s ease-out;
  }
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba($color-white, 0.3);
  border-top-color: $color-white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-check {
  font-size: 1.2em;
  animation: fade-in 0.2s ease-out;
}

.btn-error {
  font-size: 1.2em;
  animation: fade-in 0.2s ease-out;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-success {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

@keyframes fade-in {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
</style>
