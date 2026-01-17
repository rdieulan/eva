<script setup lang="ts">
import { ref } from 'vue';
import { getPlayerName } from '@/api';
import GamePlanTable from '@/components/common/GamePlanTable.vue';
import PhaseSelector from '@/components/planner/PhaseSelector.vue';
import type { GamePhase, MatchGamePlan } from '@shared/types';

defineProps<{
  selectedAbsentPlayerId: string;
  currentPhase: GamePhase;
  exportHeaders: { id: string; name: string }[];
  previewGamePlan: MatchGamePlan | null;
  mode: 'standalone' | 'associate';
}>();

const emit = defineEmits<{
  'update:currentPhase': [phase: GamePhase];
  exportClipboard: [];
  exportPng: [element: HTMLElement];
  associate: [];
}>();

const exportContentRef = ref<HTMLDivElement | null>(null);

function handleExportPng() {
  if (exportContentRef.value) {
    emit('exportPng', exportContentRef.value);
  }
}
</script>

<template>
  <div class="export-section">
    <div class="export-section-header">
      <h3>Générer le plan de jeu</h3>
      <PhaseSelector
        :modelValue="currentPhase"
        @update:modelValue="$emit('update:currentPhase', $event)"
        compact
      />
    </div>

    <!-- Table preview -->
    <div ref="exportContentRef" class="export-preview">
      <div class="export-header">
        <span class="export-title">PLAN DE JEU</span>
        <span class="export-subtitle">{{ getPlayerName(selectedAbsentPlayerId) }} absent(e)</span>
      </div>

      <GamePlanTable
        v-if="previewGamePlan"
        :headers="exportHeaders"
        :gamePlan="previewGamePlan"
      />
    </div>

    <!-- Export buttons -->
    <div class="export-buttons">
      <button class="btn-export btn-clipboard" @click="$emit('exportClipboard')">
        📋 Copier (texte)
      </button>
      <button class="btn-export btn-png" @click="handleExportPng">
        🖼️ Télécharger (PNG)
      </button>
      <button
        v-if="mode === 'associate'"
        class="btn-export btn-associate"
        @click="$emit('associate')"
      >
        ✓ Associer au match
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.export-section {
  border-top: 1px solid $color-border;
  padding-top: $spacing-lg;
  margin-top: $spacing-md;

  h3 {
    margin: 0;
    font-size: 1rem;
    color: #fff;
  }
}

.export-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
  gap: $spacing-md;
}

.export-preview {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
}

.export-header {
  text-align: center;
  margin-bottom: $spacing-md;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid $color-border;
}

.export-title {
  display: block;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.1em;
}

.export-subtitle {
  display: block;
  font-size: 0.85rem;
  color: $color-danger;
  margin-top: $spacing-xs;
}

.export-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.btn-export {
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-clipboard {
  background: #4a4a8a;
  color: #fff;

  &:hover {
    background: #5a5a9a;
  }
}

.btn-png {
  background: $color-success;
  color: $color-bg-secondary;

  &:hover {
    background: #6ee7a0;
  }
}

.btn-associate {
  background: $color-warning;
  color: $color-bg-secondary;

  &:hover {
    background: #fdba74;
  }
}
</style>
