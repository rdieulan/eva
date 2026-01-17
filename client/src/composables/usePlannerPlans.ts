/**
 * Composable for game plan management (CRUD operations)
 * Handles plan selection, creation, duplication, deletion, renaming
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { fetchGamePlan, createGamePlan, deleteGamePlan, saveGamePlan } from '@/api';
import type { MapConfig, GamePlanSummary } from '@shared/types';

export interface UsePlannerPlansOptions {
  maps: Ref<MapConfig[]>;
  editableMaps: Ref<MapConfig[]>;
  selectedMapId: Ref<string | null>;
  editMode: Ref<boolean>;
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
  const { maps, editableMaps, selectedMapId, editMode } = options;

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
    }
  }

  async function createPlan(): Promise<void> {
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
        await selectPlan(newPlan.id);
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('Erreur lors de la création du plan');
    }
  }

  async function duplicatePlan(planId: string): Promise<void> {
    if (!selectedMapId.value) return;

    const sourcePlan = currentMapPlans.value.find(p => p.id === planId);
    const name = prompt('Nom du plan dupliqué :', `${sourcePlan?.name || 'Plan'} (copie)`);
    if (!name?.trim()) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const currentMap = maps.value.find(m => m.id === selectedMapId.value);
      const newPlan = await createGamePlan(selectedMapId.value, name.trim(), token);
      if (newPlan && currentMap) {
        // Save current data to new plan
        await saveGamePlan(newPlan.id, {
          assignments: currentMap.assignments,
          players: currentMap.players,
          notes: currentMap.notes,
        }, token);

        // Add to plans list
        const map = maps.value.find(m => m.id === selectedMapId.value);
        if (map) {
          map.gamePlans = [...(map.gamePlans || []), { id: newPlan.id, name: newPlan.name }];
        }
        await selectPlan(newPlan.id);
      }
    } catch (error) {
      console.error('Error duplicating plan:', error);
      alert('Erreur lors de la duplication du plan');
    }
  }

  async function deletePlan(planId: string): Promise<void> {
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
          await selectPlan(map.gamePlans[0].id);
        } else {
          selectedPlanId.value = null;
        }
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Erreur lors de la suppression du plan');
    }
  }

  async function renamePlan(planId: string, newName: string): Promise<void> {
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
