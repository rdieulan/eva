/**
 * Composable for game plan management (CRUD operations)
 * Handles plan selection, creation, duplication, deletion, renaming
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { fetchGamePlan, createGamePlan, deleteGamePlan, saveGamePlan } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { ERROR_MESSAGES } from '@shared/constants';
import type { MapConfig, GamePlanSummary } from '@shared/types';

export interface UsePlannerPlansOptions {
  maps: Ref<MapConfig[]>;
  editableMaps: Ref<MapConfig[]>;
  selectedMapId: Ref<string | null>;
  editMode: Ref<boolean>;
  onError?: (errors: string[]) => void;
}

export interface UsePlannerPlansReturn {
  // State
  selectedPlanId: Ref<string | null>;

  // Computed
  currentMapPlans: ComputedRef<GamePlanSummary[]>;

  // Methods
  selectPlan: (planId: string) => Promise<void>;
  createPlan: () => Promise<void>;
  duplicatePlan: (planId: string) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  renamePlan: (planId: string, newName: string) => Promise<void>;
}

export function usePlannerPlans(options: UsePlannerPlansOptions): UsePlannerPlansReturn {
  const { maps, editableMaps, selectedMapId, editMode, onError } = options;

  // Error handling
  const { errors, setErrorFromException } = useErrors();

  const selectedPlanId = ref<string | null>(null);

  // Available plans for current map
  const currentMapPlans = computed<GamePlanSummary[]>(() => {
    const map = maps.value.find(m => m.id === selectedMapId.value);
    return map?.gamePlans || [];
  });

  // Auto-select first plan when map changes
  watch(selectedMapId, () => {
    const map = maps.value.find(m => m.id === selectedMapId.value);
    const firstPlan = map?.gamePlans?.[0];
    selectedPlanId.value = firstPlan?.id ?? null;
  });

  // Load plan data when selected plan changes
  async function selectPlan(planId: string): Promise<void> {
    if (!selectedMapId.value || planId === selectedPlanId.value) return;

    try {
      const planData = await fetchGamePlan(planId);
      if (planData) {
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
      setErrorFromException(error, ERROR_MESSAGES.planLoadFailed);
      onError?.(errors.value);
    }
  }

  async function createPlan(): Promise<void> {
    if (!selectedMapId.value) return;

    const name = prompt('Nom du nouveau plan :');
    if (!name?.trim()) return;

    try {
      const newPlan = await createGamePlan(selectedMapId.value, name.trim());
      if (newPlan) {
        // Add to current map's plans list with full data
        const map = maps.value.find(m => m.id === selectedMapId.value);
        if (map) {
          map.gamePlans = [...(map.gamePlans || []), {
            id: newPlan.id,
            name: newPlan.name,
            assignments: [], // New plan starts empty
            players: [],
          }];
        }
        // Select the new plan
        await selectPlan(newPlan.id);
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      setErrorFromException(error, ERROR_MESSAGES.planCreationFailed);
      onError?.(errors.value);
    }
  }

  async function duplicatePlan(planId: string): Promise<void> {
    if (!selectedMapId.value) return;

    const sourcePlan = currentMapPlans.value.find(p => p.id === planId);
    const name = prompt('Nom du plan dupliqué :', `${sourcePlan?.name || 'Plan'} (copie)`);
    if (!name?.trim()) return;

    try {
      const currentMap = maps.value.find(m => m.id === selectedMapId.value);
      const newPlan = await createGamePlan(selectedMapId.value, name.trim());
      if (newPlan && currentMap) {
        // Save current data to new plan
        await saveGamePlan(newPlan.id, {
          assignments: currentMap.assignments,
          players: currentMap.players,
          notes: currentMap.notes,
        });

        // Add to plans list with full data
        const map = maps.value.find(m => m.id === selectedMapId.value);
        if (map) {
          map.gamePlans = [...(map.gamePlans || []), {
            id: newPlan.id,
            name: newPlan.name,
            assignments: currentMap.assignments,
            players: currentMap.players,
            notes: currentMap.notes,
          }];
        }
        await selectPlan(newPlan.id);
      }
    } catch (error) {
      console.error('Error duplicating plan:', error);
      setErrorFromException(error, ERROR_MESSAGES.planDuplicationFailed);
      onError?.(errors.value);
    }
  }

  async function deletePlan(planId: string): Promise<void> {
    if (!selectedMapId.value) return;

    try {
      await deleteGamePlan(planId);

      // Remove from list
      const map = maps.value.find(m => m.id === selectedMapId.value);
      if (map) {
        map.gamePlans = map.gamePlans?.filter(p => p.id !== planId) || [];

        // Select another plan if available
        if (map.gamePlans.length > 0 && map.gamePlans[0]) {
          await selectPlan(map.gamePlans[0].id);
        } else {
          selectedPlanId.value = null;
        }
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      setErrorFromException(error, ERROR_MESSAGES.planDeletionFailed);
      onError?.(errors.value);
    }
  }

  async function renamePlan(planId: string, newName: string): Promise<void> {
    try {
      await saveGamePlan(planId, { name: newName });

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
      setErrorFromException(error, ERROR_MESSAGES.planRenameFailed);
      onError?.(errors.value);
    }
  }

  return {
    selectedPlanId,
    currentMapPlans,
    selectPlan,
    createPlan,
    duplicatePlan,
    deletePlan,
    renamePlan,
  };
}
