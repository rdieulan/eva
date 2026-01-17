/**
 * Composable for game plan notes management
 * Handles notes for general, phase, role, and role+phase contexts
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { DEFAULT_GAME_PLAN_NOTES, DEFAULT_ROLE_PHASE_NOTES } from '@shared/types';
import type { MapConfig, GamePhase, GamePlanNotes } from '@shared/types';

export interface UsePlannerNotesOptions {
  maps: Ref<MapConfig[]>;
  editableMaps: Ref<MapConfig[]>;
  selectedMapId: Ref<string | null>;
  editMode: Ref<boolean>;
  currentPhase: Ref<GamePhase>;
  selectedAssignmentId: ComputedRef<number | null>;
}

export interface UsePlannerNotesReturn {
  // Local notes state
  localGeneralNotes: Ref<string>;
  localPhaseNotes: Ref<string>;
  localRoleNotes: Ref<string>;
  localRolePhaseNotes: Ref<string>;

  // Computed
  currentNotes: ComputedRef<GamePlanNotes>;

  // Update methods
  updateGeneralNotes: () => void;
  updatePhaseNotes: () => void;
  updateRoleNotes: () => void;
  updateRolePhaseNotes: () => void;
}

export function usePlannerNotes(options: UsePlannerNotesOptions): UsePlannerNotesReturn {
  const {
    maps,
    editableMaps,
    selectedMapId,
    editMode,
    currentPhase,
    selectedAssignmentId,
  } = options;

  // Local notes state for inline editing
  const localGeneralNotes = ref('');
  const localPhaseNotes = ref('');
  const localRoleNotes = ref('');
  const localRolePhaseNotes = ref('');

  // Current map notes
  const currentNotes = computed<GamePlanNotes>(() => {
    const source = editMode.value ? editableMaps.value : maps.value;
    const map = source.find(m => m.id === selectedMapId.value);
    return map?.notes || { ...DEFAULT_GAME_PLAN_NOTES };
  });

  // Sync local notes when context changes
  watch(
    [currentNotes, currentPhase, selectedAssignmentId],
    ([notes, phase, assignmentId]) => {
      localGeneralNotes.value = notes.general;
      localPhaseNotes.value = notes.phases[phase];

      // Role notes
      if (assignmentId !== null && assignmentId !== undefined) {
        localRoleNotes.value = notes.roles?.[assignmentId] || '';
        localRolePhaseNotes.value = notes.rolePhases?.[phase]?.[assignmentId] || '';
      } else {
        localRoleNotes.value = '';
        localRolePhaseNotes.value = '';
      }
    },
    { immediate: true }
  );

  function updateGeneralNotes(): void {
    if (!editMode.value || !selectedMapId.value) return;
    const map = editableMaps.value.find(m => m.id === selectedMapId.value);
    if (map) {
      map.notes = {
        ...(map.notes || { ...DEFAULT_GAME_PLAN_NOTES }),
        general: localGeneralNotes.value,
      };
    }
  }

  function updatePhaseNotes(): void {
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

  function updateRoleNotes(): void {
    const assignmentId = selectedAssignmentId.value;
    if (!editMode.value || !selectedMapId.value || assignmentId === null) return;
    const map = editableMaps.value.find(m => m.id === selectedMapId.value);
    if (map) {
      const existingNotes = map.notes || { ...DEFAULT_GAME_PLAN_NOTES };
      const existingRoles = existingNotes.roles || {};
      map.notes = {
        ...existingNotes,
        roles: {
          ...existingRoles,
          [assignmentId]: localRoleNotes.value,
        },
      };
    }
  }

  function updateRolePhaseNotes(): void {
    const assignmentId = selectedAssignmentId.value;
    if (!editMode.value || !selectedMapId.value || assignmentId === null) return;
    const map = editableMaps.value.find(m => m.id === selectedMapId.value);
    if (map) {
      const existingNotes = map.notes || { ...DEFAULT_GAME_PLAN_NOTES };
      const existingRolePhases = existingNotes.rolePhases || { ...DEFAULT_ROLE_PHASE_NOTES };
      const existingPhaseRoles = existingRolePhases[currentPhase.value] || {};
      map.notes = {
        ...existingNotes,
        rolePhases: {
          ...existingRolePhases,
          [currentPhase.value]: {
            ...existingPhaseRoles,
            [assignmentId]: localRolePhaseNotes.value,
          },
        },
      };
    }
  }

  return {
    localGeneralNotes,
    localPhaseNotes,
    localRoleNotes,
    localRolePhaseNotes,
    currentNotes,
    updateGeneralNotes,
    updatePhaseNotes,
    updateRoleNotes,
    updateRolePhaseNotes,
  };
}
