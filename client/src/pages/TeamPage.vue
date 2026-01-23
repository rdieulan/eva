<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import {
  fetchCurrentTeam,
  fetchTeamLocations,
  updateTeam,
  fetchTeamMembers,
  updateMemberPermissions,
  removeMember,
} from '@/api';
import type { TeamWithMembers, TeamMember } from '@/api';
import type { UserPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const { token, permissions, user } = useAuth();

// State
const team = ref<TeamWithMembers | null>(null);
const members = ref<TeamMember[]>([]);
const locations = ref<string[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Edit mode
const isEditingTeam = ref(false);
const editName = ref('');
const editLocation = ref<string | null>(null);

// Permissions modal
const showPermissionsModal = ref(false);
const selectedMember = ref<TeamMember | null>(null);
const editingPermissions = ref<UserPermissions>(DEFAULT_PLAYER_PERMISSIONS);

// Remove member modal
const showRemoveModal = ref(false);
const memberToRemove = ref<TeamMember | null>(null);

// Can manage team
const canManageTeam = computed(() => permissions.value.team.canManageTeam);
const canManagePermissions = computed(() => permissions.value.team.canManagePermissions);
const canRemoveMembers = computed(() => permissions.value.team.canRemoveMembers);

// Load data
async function loadData() {
  if (!token.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    const [teamData, locationsData, membersData] = await Promise.all([
      fetchCurrentTeam(),
      fetchTeamLocations(),
      fetchTeamMembers(),
    ]);

    team.value = teamData;
    locations.value = locationsData;
    members.value = membersData;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur inconnue';
  } finally {
    isLoading.value = false;
  }
}

// Start editing team
function startEditTeam() {
  if (!team.value) return;
  editName.value = team.value.name;
  editLocation.value = team.value.location ?? null;
  isEditingTeam.value = true;
}

// Cancel editing
function cancelEditTeam() {
  isEditingTeam.value = false;
}

// Save team changes
async function saveTeamChanges() {
  if (!token.value || !team.value) return;

  try {
    await updateTeam({
      name: editName.value,
      location: editLocation.value,
    });

    team.value.name = editName.value;
    team.value.location = editLocation.value ?? undefined;
    isEditingTeam.value = false;
    showSuccess('Équipe mise à jour');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Open permissions modal
function openPermissionsModal(member: TeamMember) {
  if (member.isLeader) return;
  selectedMember.value = member;
  editingPermissions.value = member.permissions ?? { ...DEFAULT_PLAYER_PERMISSIONS };
  showPermissionsModal.value = true;
}

// Save permissions
async function savePermissions() {
  if (!token.value || !selectedMember.value) return;

  try {
    await updateMemberPermissions(
      selectedMember.value.id,
      editingPermissions.value
    );

    // Update local state
    const idx = members.value.findIndex(m => m.id === selectedMember.value!.id);
    if (idx !== -1 && members.value[idx]) {
      members.value[idx]!.permissions = { ...editingPermissions.value };
    }

    showPermissionsModal.value = false;
    showSuccess('Permissions mises à jour');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Open remove member modal
function openRemoveModal(member: TeamMember) {
  if (member.isLeader) return;
  memberToRemove.value = member;
  showRemoveModal.value = true;
}

// Confirm remove member
async function confirmRemoveMember() {
  if (!token.value || !memberToRemove.value) return;

  try {
    await removeMember(memberToRemove.value.id);
    members.value = members.value.filter(m => m.id !== memberToRemove.value!.id);
    showRemoveModal.value = false;
    memberToRemove.value = null;
    showSuccess('Membre retiré');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Show success message
function showSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => { successMessage.value = null; }, 3000);
}

// Toggle permission
function togglePermission(category: keyof UserPermissions, perm: string) {
  const cat = editingPermissions.value[category] as Record<string, boolean>;
  cat[perm] = !cat[perm];
}

onMounted(loadData);
</script>

<template>
  <div class="team-page">
    <h1>Mon équipe</h1>

    <!-- Loading -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>Chargement...</p>
    </div>

    <!-- No team -->
    <div v-else-if="!team" class="no-team">
      <p>Vous n'appartenez à aucune équipe.</p>
    </div>

    <!-- Team content -->
    <template v-else>
      <!-- Messages -->
      <div v-if="error" class="message error">{{ error }}</div>
      <div v-if="successMessage" class="message success">{{ successMessage }}</div>

      <!-- Team info section -->
      <section class="team-info">
        <div class="section-header">
          <h2>Informations</h2>
          <button v-if="canManageTeam && !isEditingTeam" class="btn-edit" @click="startEditTeam">
            <SvgIcon name="edit" />
            Modifier
          </button>
        </div>

        <div v-if="isEditingTeam" class="edit-form">
          <div class="form-group">
            <label>Nom de l'équipe</label>
            <input v-model="editName" type="text" placeholder="Nom de l'équipe" />
          </div>
          <div class="form-group">
            <label>Localisation</label>
            <select v-model="editLocation">
              <option :value="null">Non spécifiée</option>
              <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn-cancel" @click="cancelEditTeam">Annuler</button>
            <button class="btn-save" @click="saveTeamChanges">Enregistrer</button>
          </div>
        </div>

        <div v-else class="info-display">
          <div class="info-item">
            <label>Nom</label>
            <span>{{ team.name }}</span>
          </div>
          <div class="info-item">
            <label>Localisation</label>
            <span>{{ team.location || 'Non spécifiée' }}</span>
          </div>
          <div class="info-item">
            <label>Leader</label>
            <span>{{ team.leader.name }}</span>
          </div>
        </div>
      </section>

      <!-- Members section -->
      <section class="team-members">
        <div class="section-header">
          <h2>Membres ({{ members.length }})</h2>
        </div>

        <div class="members-list">
          <div
            v-for="member in members"
            :key="member.id"
            class="member-card"
            :class="{ 'is-leader': member.isLeader, 'is-me': member.id === user?.id }"
          >
            <div class="member-info">
              <span class="member-name">
                {{ member.name }}
                <span v-if="member.isLeader" class="badge leader">Leader</span>
                <span v-if="member.id === user?.id" class="badge me">Vous</span>
              </span>
              <span class="member-email">{{ member.email }}</span>
            </div>

            <div class="member-actions" v-if="canManagePermissions && !member.isLeader && member.id !== user?.id">
              <button class="btn-icon" title="Gérer les permissions" @click="openPermissionsModal(member)">
                <SvgIcon name="settings" />
              </button>
              <button
                v-if="canRemoveMembers"
                class="btn-icon danger"
                title="Retirer de l'équipe"
                @click="openRemoveModal(member)"
              >
                <SvgIcon name="trash" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Permissions Modal -->
    <Modal :open="showPermissionsModal" @close="showPermissionsModal = false">
      <template #header>
        <h3>Permissions de {{ selectedMember?.name }}</h3>
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
        <button class="btn-cancel" @click="showPermissionsModal = false">Annuler</button>
        <button class="btn-save" @click="savePermissions">Enregistrer</button>
      </template>
    </Modal>

    <!-- Remove Member Confirmation Modal -->
    <ConfirmModal
      :open="showRemoveModal"
      title="Retirer un membre"
      :message="`Êtes-vous sûr de vouloir retirer ${memberToRemove?.name} de l'équipe ? Cette action est irréversible.`"
      confirm-text="Retirer"
      require-input="supprimer"
      :danger="true"
      @confirm="confirmRemoveMember"
      @cancel="showRemoveModal = false; memberToRemove = null"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.team-page {
  max-width: 800px;
  margin: 0 auto;
  padding: $spacing-lg;
}

h1 {
  margin-bottom: $spacing-lg;
  color: $color-text-primary;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-xl;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid $color-border;
  border-top-color: $color-accent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-team {
  text-align: center;
  padding: $spacing-xl;
  color: $color-text-secondary;
}

.message {
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-sm;
  margin-bottom: $spacing-md;

  &.error {
    background: rgba($color-danger, 0.2);
    color: $color-danger;
  }

  &.success {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
}

section {
  background: $color-bg-secondary;
  border-radius: $radius-md;
  padding: $spacing-lg;
  margin-bottom: $spacing-lg;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  h2 {
    margin: 0;
    font-size: $font-size-lg;
  }
}

.btn-edit {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-sm;
  background: transparent;
  border: 1px solid $color-edit;
  border-radius: $radius-sm;
  color: $color-edit;
  cursor: pointer;

  &:hover {
    background: rgba($color-edit, 0.2);
    color: $color-edit;
  }

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}

.info-display {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.info-item {
  display: flex;
  gap: $spacing-md;

  label {
    width: 120px;
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }

  span {
    color: $color-text-primary;
  }
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  input, select {
    padding: $spacing-sm;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-primary;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.btn-cancel, .btn-save {
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-sm;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel {
  background: transparent;
  border: 1px solid $color-border;
  color: $color-text-secondary;

  &:hover {
    background: $color-bg-tertiary;
  }
}

.btn-save {
  background: $color-accent;
  border: none;
  color: white;

  &:hover {
    background: $color-accent;
  }
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.member-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-tertiary;
  border-radius: $radius-sm;

  &.is-leader {
    border-left: 3px solid $color-star;
  }

  &.is-me {
    background: rgba($color-accent, 0.1);
  }
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-weight: 500;
  color: $color-text-primary;
}

.member-email {
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.badge {
  font-size: $font-size-xs;
  padding: 2px 6px;
  border-radius: $radius-sm;
  font-weight: 600;

  &.leader {
    background: $color-star;
    color: black;
  }

  &.me {
    background: $color-accent;
    color: white;
  }
}

.member-actions {
  display: flex;
  gap: $spacing-xs;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid $color-accent;
  border-radius: $radius-sm;
  color: $color-accent;
  cursor: pointer;

  &:hover {
    background: rgba($color-accent, 0.2);
    color: $color-accent;
  }

  &.danger {
    border-color: $color-danger;
    color: $color-danger;

    &:hover {
      background: rgba($color-danger, 0.2);
    }
  }

  :deep(svg) {
    width: 16px;
    height: 16px;
  }
}

.permissions-editor {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-md 0;
}

.perm-category {
  h4 {
    margin: 0 0 $spacing-sm;
    color: $color-text-primary;
    font-size: $font-size-base;
  }
}

.perm-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs 0;
  color: $color-text-secondary;
  cursor: pointer;

  &:hover {
    color: $color-text-primary;
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
}

.section-description {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  margin: 0;
}

@media (max-width: $breakpoint-tablet) {
  .team-page {
    padding: $spacing-md;
  }

  .info-item {
    flex-direction: column;
    gap: 2px;

    label {
      width: auto;
    }
  }
}
</style>
