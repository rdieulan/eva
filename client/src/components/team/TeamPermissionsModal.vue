<script setup lang="ts">
import type { UserPermissions } from '@shared/types';
import Modal from '@/components/common/Modal.vue';

const props = defineProps<{
  open: boolean;
  memberName: string;
  permissions: UserPermissions;
}>();

const emit = defineEmits<{
  close: [];
  save: [permissions: UserPermissions];
}>();

// Local copy of permissions for editing
const editingPermissions = defineModel<UserPermissions>('permissions', { required: true });

// Toggle permission
function togglePermission(category: keyof UserPermissions, perm: string) {
  const cat = editingPermissions.value[category] as unknown as Record<string, boolean>;
  cat[perm] = !cat[perm];
}

// Save and close
function handleSave() {
  emit('save', editingPermissions.value);
}
</script>

<template>
  <Modal :open="open" @close="$emit('close')">
    <template #header>
      <h3>Permissions de {{ memberName }}</h3>
    </template>

    <div class="permissions-editor">
      <!-- Planner permissions -->
      <div class="perm-category">
        <h4>Planificateur</h4>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.planner.canCreate"
            @change="togglePermission('planner', 'canCreate')"
          />
          Créer des plans
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.planner.canEdit"
            @change="togglePermission('planner', 'canEdit')"
          />
          Modifier les plans
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.planner.canDelete"
            @change="togglePermission('planner', 'canDelete')"
          />
          Supprimer des plans
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.planner.canManageBalanceRules"
            @change="togglePermission('planner', 'canManageBalanceRules')"
          />
          Gérer les règles d'équilibre
        </label>
      </div>

      <!-- Calendar permissions -->
      <div class="perm-category">
        <h4>Calendrier</h4>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.calendar.canCreateEvents"
            @change="togglePermission('calendar', 'canCreateEvents')"
          />
          Créer des événements
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.calendar.canEditEvents"
            @change="togglePermission('calendar', 'canEditEvents')"
          />
          Modifier des événements
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.calendar.canDeleteEvents"
            @change="togglePermission('calendar', 'canDeleteEvents')"
          />
          Supprimer des événements
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.calendar.canAttachGamePlan"
            @change="togglePermission('calendar', 'canAttachGamePlan')"
          />
          Associer un plan de jeu
        </label>
      </div>

      <!-- Team permissions -->
      <div class="perm-category">
        <h4>Équipe</h4>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.team.canManageTeam"
            @change="togglePermission('team', 'canManageTeam')"
          />
          Gérer les infos d'équipe
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.team.canInviteMembers"
            @change="togglePermission('team', 'canInviteMembers')"
          />
          Inviter des membres
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.team.canRemoveMembers"
            @change="togglePermission('team', 'canRemoveMembers')"
          />
          Retirer des membres
        </label>
        <label class="perm-item">
          <input
            type="checkbox"
            :checked="editingPermissions.team.canManagePermissions"
            @change="togglePermission('team', 'canManagePermissions')"
          />
          Gérer les permissions
        </label>
      </div>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="$emit('close')">Annuler</button>
      <button class="btn-save" @click="handleSave">Enregistrer</button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.permissions-editor {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  max-height: 60vh;
  overflow-y: auto;
}

.perm-category {
  h4 {
    margin: 0 0 $spacing-sm;
    font-size: $font-size-base;
    color: $color-accent;
    border-bottom: 1px solid $color-border-light;
    padding-bottom: $spacing-xs;
  }
}

.perm-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs 0;
  cursor: pointer;
  color: $color-text-primary;
  font-size: $font-size-sm;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: $color-accent;
  }

  &:hover {
    color: $color-white;
  }
}

.btn-cancel {
  @include btn-base($color-danger);
}

.btn-save {
  @include btn-base($color-success);
}
</style>
