<script setup lang="ts">
/**
 * PlannerRightDrawer - Layout component
 * Simple wrapper for the right drawer position.
 * Contains PlannerNotes functional component.
 */
import Drawer from '@/components/common/Drawer.vue';
import PlannerNotes from '@/components/planner/PlannerNotes.vue';
import type { GamePhase } from '@shared/types';

defineProps<{
  modelValue: boolean;
  editMode: boolean;
  currentPhase: GamePhase;
  selectedAssignmentName: string | null;
  selectedAssignmentColor: string | undefined;
  localGeneralNotes: string;
  localPhaseNotes: string;
  localRoleNotes: string;
  localRolePhaseNotes: string;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
  'update:localGeneralNotes': [value: string];
  'update:localPhaseNotes': [value: string];
  'update:localRoleNotes': [value: string];
  'update:localRolePhaseNotes': [value: string];
  updateGeneralNotes: [];
  updatePhaseNotes: [];
  updateRoleNotes: [];
  updateRolePhaseNotes: [];
}>();
</script>

<template>
  <Drawer
    :model-value="modelValue"
    title="Stratégie"
    icon="notes"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <PlannerNotes
      :edit-mode="editMode"
      :current-phase="currentPhase"
      :selected-assignment-name="selectedAssignmentName"
      :selected-assignment-color="selectedAssignmentColor"
      :local-general-notes="localGeneralNotes"
      :local-phase-notes="localPhaseNotes"
      :local-role-notes="localRoleNotes"
      :local-role-phase-notes="localRolePhaseNotes"
      @update:local-general-notes="$emit('update:localGeneralNotes', $event)"
      @update:local-phase-notes="$emit('update:localPhaseNotes', $event)"
      @update:local-role-notes="$emit('update:localRoleNotes', $event)"
      @update:local-role-phase-notes="$emit('update:localRolePhaseNotes', $event)"
      @update-general-notes="$emit('updateGeneralNotes')"
      @update-phase-notes="$emit('updatePhaseNotes')"
      @update-role-notes="$emit('updateRoleNotes')"
      @update-role-phase-notes="$emit('updateRolePhaseNotes')"
    />
  </Drawer>
</template>
