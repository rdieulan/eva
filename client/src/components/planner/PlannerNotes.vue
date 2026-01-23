<script setup lang="ts">
import { ref, computed } from 'vue';
import SvgIcon from '@/components/common/SvgIcon.vue';
import { PHASE_DISPLAY_DATA } from '@/constants';
import { PHASE_LABELS } from '@shared/constants';
import type { GamePhase } from '@shared/types';

const props = defineProps<{
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
  'update:localGeneralNotes': [value: string];
  'update:localPhaseNotes': [value: string];
  'update:localRoleNotes': [value: string];
  'update:localRolePhaseNotes': [value: string];
  updateGeneralNotes: [];
  updatePhaseNotes: [];
  updateRoleNotes: [];
  updateRolePhaseNotes: [];
}>();

const activeTab = ref<'general' | 'phase'>('general');

const currentPhaseLabel = computed(() => PHASE_LABELS[props.currentPhase]);
const currentPhaseData = computed(() => PHASE_DISPLAY_DATA[props.currentPhase]);
</script>

<template>
  <!-- Tabs -->
  <div class="notes-tabs">
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'general' }"
      @click="activeTab = 'general'"
    >
      Général
    </button>
    <button
      class="tab-btn"
      :class="{ active: activeTab === 'phase' }"
      :style="{ '--tab-color': currentPhaseData.color }"
      @click="activeTab = 'phase'"
    >
      <SvgIcon :name="currentPhaseData.icon" class="tab-icon" />
      {{ currentPhaseLabel }}
    </button>
  </div>

  <!-- Tab Content -->
  <div class="notes-content">
    <!-- GÉNÉRAL TAB -->
    <template v-if="activeTab === 'general'">
      <div class="notes-section">
        <label class="section-label">Plan global</label>
        <textarea
          v-if="editMode"
          :value="localGeneralNotes"
          class="notes-textarea"
          placeholder="Explications générales du plan de jeu..."
          @input="$emit('update:localGeneralNotes', ($event.target as HTMLTextAreaElement).value)"
          @blur="$emit('updateGeneralNotes')"
        ></textarea>
        <p v-else class="notes-text">{{ localGeneralNotes || '—' }}</p>
      </div>

      <div
        v-if="selectedAssignmentName"
        class="notes-section"
        :style="{ '--section-color': selectedAssignmentColor }"
      >
        <label class="section-label colored">
          Rôle : {{ selectedAssignmentName }}
        </label>
        <textarea
          v-if="editMode"
          :value="localRoleNotes"
          class="notes-textarea"
          :placeholder="`Notes générales pour le rôle ${selectedAssignmentName}...`"
          @input="$emit('update:localRoleNotes', ($event.target as HTMLTextAreaElement).value)"
          @blur="$emit('updateRoleNotes')"
        ></textarea>
        <p v-else class="notes-text">{{ localRoleNotes || '—' }}</p>
      </div>
    </template>

    <!-- PHASE TAB -->
    <template v-if="activeTab === 'phase'">
      <div class="notes-section">
        <label class="section-label">Stratégie de phase</label>
        <textarea
          v-if="editMode"
          :value="localPhaseNotes"
          class="notes-textarea"
          :placeholder="`Explications pour la phase ${currentPhaseLabel}...`"
          @input="$emit('update:localPhaseNotes', ($event.target as HTMLTextAreaElement).value)"
          @blur="$emit('updatePhaseNotes')"
        ></textarea>
        <p v-else class="notes-text">{{ localPhaseNotes || '—' }}</p>
      </div>

      <div
        v-if="selectedAssignmentName"
        class="notes-section"
        :style="{ '--section-color': selectedAssignmentColor }"
      >
        <label class="section-label colored">
          Rôle : {{ selectedAssignmentName }}
        </label>
        <textarea
          v-if="editMode"
          :value="localRolePhaseNotes"
          class="notes-textarea"
          :placeholder="`Notes pour ${selectedAssignmentName} en phase ${currentPhaseLabel}...`"
          @input="$emit('update:localRolePhaseNotes', ($event.target as HTMLTextAreaElement).value)"
          @blur="$emit('updateRolePhaseNotes')"
        ></textarea>
        <p v-else class="notes-text">{{ localRolePhaseNotes || '—' }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.notes-tabs {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-md;
  border-bottom: 1px solid $color-border;
  padding-bottom: $spacing-xs;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: transparent;
  border: none;
  border-radius: $radius-sm $radius-sm 0 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;

  &:hover {
    color: $color-text-primary;
    background: rgba($color-white, 0.05);
  }

  &.active {
    color: var(--tab-color, $color-accent);
    background: rgba($color-white, 0.05)er;

    &::after {
      content: '';
      position: absolute;
      bottom: calc(-#{$spacing-xs} - 1px);
      left: 0;
      right: 0;
      height: 2px;
      background: var(--tab-color, $color-accent);
    }
  }
}

.tab-icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.notes-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.notes-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.section-label {
  font-size: $font-size-xs;
  font-weight: 600;
  color: $color-text-secondary;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.colored {
    color: var(--section-color, $color-text-secondary);
    font-weight: 700;
  }
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
</style>
