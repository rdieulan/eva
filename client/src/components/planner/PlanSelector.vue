<script setup lang="ts">
import { ref, computed } from 'vue';
import type { GamePlanSummary } from '@/types';
import SvgIcon from '@/components/common/SvgIcon.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const props = withDefaults(defineProps<{
  plans: GamePlanSummary[];
  selectedPlanId: string | null;
  disabled?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}>(), {
  disabled: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
});

const emit = defineEmits<{
  'select': [planId: string];
  'create': [];
  'duplicate': [planId: string];
  'delete': [planId: string];
  'rename': [planId: string, newName: string];
}>();

const showDropdown = ref(false);
const editingPlanId = ref<string | null>(null);
const editingName = ref('');
const showDeleteModal = ref(false);
const planToDelete = ref<string | null>(null);

const selectedPlan = computed(() =>
  props.plans.find(p => p.id === props.selectedPlanId)
);

const planToDeleteName = computed(() =>
  props.plans.find(p => p.id === planToDelete.value)?.name || ''
);

function toggleDropdown() {
  if (!props.disabled) {
    showDropdown.value = !showDropdown.value;
  }
}

function selectPlan(planId: string) {
  emit('select', planId);
  showDropdown.value = false;
}

function startRename(plan: GamePlanSummary, event: Event) {
  event.stopPropagation();
  editingPlanId.value = plan.id;
  editingName.value = plan.name;
}

function confirmRename() {
  if (editingPlanId.value && editingName.value.trim()) {
    emit('rename', editingPlanId.value, editingName.value.trim());
  }
  editingPlanId.value = null;
}

function cancelRename() {
  editingPlanId.value = null;
}

function handleDuplicate(planId: string, event: Event) {
  event.stopPropagation();
  emit('duplicate', planId);
}

function handleDelete(planId: string, event: Event) {
  event.stopPropagation();
  planToDelete.value = planId;
  showDeleteModal.value = true;
}

function confirmDelete() {
  if (planToDelete.value) {
    emit('delete', planToDelete.value);
    showDeleteModal.value = false;
    planToDelete.value = null;
  }
}

function handleCreate() {
  emit('create');
  showDropdown.value = false;
}

function closeDropdown() {
  showDropdown.value = false;
  editingPlanId.value = null;
}
</script>

<template>
  <div class="plan-selector" :class="{ disabled }">
    <button class="selected-plan" @click="toggleDropdown">
      <span class="plan-name">{{ selectedPlan?.name || 'Aucun plan' }}</span>
      <SvgIcon name="chevron-right" class="chevron" :class="{ open: showDropdown }" />
    </button>

    <Transition name="dropdown">
      <div v-if="showDropdown" class="dropdown">
        <div class="dropdown-content">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="plan-item"
            :class="{ active: plan.id === selectedPlanId }"
            @click="selectPlan(plan.id)"
          >
            <!-- Edit mode (admin only) -->
            <template v-if="canEdit && editingPlanId === plan.id">
              <input
                v-model="editingName"
                class="plan-name-input"
                @click.stop
                @keyup.enter="confirmRename"
                @keyup.escape="cancelRename"
                @blur="confirmRename"
                autofocus
              />
            </template>
            <!-- Display mode -->
            <template v-else>
              <span class="plan-item-name">{{ plan.name }}</span>
              <div v-if="canEdit || canDelete" class="plan-actions">
                <button v-if="canEdit" class="action-btn" title="Renommer" @click="startRename(plan, $event)">✏️</button>
                <button v-if="canCreate" class="action-btn" title="Dupliquer" @click="handleDuplicate(plan.id, $event)">📋</button>
                <button
                  v-if="canDelete && plans.length > 1"
                  class="action-btn delete"
                  title="Supprimer"
                  @click="handleDelete(plan.id, $event)"
                >🗑️</button>
              </div>
            </template>
          </div>
        </div>

        <div v-if="canCreate" class="dropdown-footer">
          <button class="btn-create" @click="handleCreate">
            + Nouveau plan
          </button>
        </div>
      </div>
    </Transition>

    <!-- Backdrop to close dropdown -->
    <div v-if="showDropdown" class="dropdown-backdrop" @click="closeDropdown"></div>

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :open="showDeleteModal"
      title="Supprimer le plan"
      :message="`Êtes-vous sûr de vouloir supprimer le plan « ${planToDeleteName} » ?`"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false; planToDelete = null"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.plan-selector {
  position: relative;

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.selected-plan {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  color: $color-text-primary;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 150px;

  &:hover {
    background: $color-bg-tertiary;
    border-color: $color-border-light;
  }



  .plan-name {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chevron {
    width: 16px;
    height: 16px;
    fill: $color-text-secondary;
    transition: transform 0.2s;
    flex-shrink: 0;
    transform: rotate(90deg);

    &.open {
      transform: rotate(270deg);
    }
  }
}

.dropdown-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 250px;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: 0 4px 20px $color-shadow;
  z-index: 100;
  overflow: hidden;
}

.dropdown-content {
  max-height: 300px;
  overflow-y: auto;
}

.plan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-md;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: $color-bg-tertiary;

    .plan-actions {
      opacity: 1;
    }
  }

  &.active {
    background: rgba($color-accent, 0.2);

    .plan-item-name {
      color: $color-accent;
      font-weight: 600;
    }
  }
}

.plan-item-name {
  flex: 1;
  color: $color-text-primary;
  font-size: $font-size-sm;
}

.plan-name-input {
  flex: 1;
  padding: 4px 8px;
  background: $color-bg-tertiary;
  border: 1px solid $color-accent;
  border-radius: $radius-sm;
  color: $color-text-primary;
  font-size: $font-size-sm;
  outline: none;
}

.plan-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.action-btn {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;

  &:hover {
    background: $color-bg-primary;
  }

  &.delete:hover {
    background: rgba($color-danger, 0.2);
  }
}

.dropdown-footer {
  border-top: 1px solid $color-border;
  padding: $spacing-sm;
}

.btn-create {
  width: 100%;
  padding: $spacing-sm;
  background: transparent;
  border: 1px dashed $color-border;
  border-radius: $radius-sm;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: $color-bg-tertiary;
    border-color: $color-accent;
    color: $color-accent;
  }
}

// Transition
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@include mobile-lg {
  .selected-plan {
    min-width: 120px;
    padding: $spacing-xs $spacing-sm;
  }

  .dropdown {
    min-width: 200px;
  }

  .plan-actions {
    opacity: 1;
  }
}
</style>

