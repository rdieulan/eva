<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import {
  fetchCurrentTeam,
  fetchTeamLocations,
  updateTeam,
  fetchTeamMembers,
  updateMemberPermissions,
  removeMember,
  deleteTeam,
  leaveTeam,
  createInvite,
  fetchInvites,
  revokeInvite,
} from '@/api';
import type { TeamWithMembers, TeamMember, TeamInvite } from '@/api';
import type { UserPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const router = useRouter();
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
const canInviteMembers = computed(() => permissions.value.team.canInviteMembers);
const isLeader = computed(() => team.value?.leader.id === user.value?.id);

// Delete team modal
const showDeleteTeamModal = ref(false);

// Leave team modal
const showLeaveTeamModal = ref(false);

// Invitations
const invites = ref<TeamInvite[]>([]);
const showInviteModal = ref(false);
const inviteExpiresHours = ref(24);
const inviteMaxUses = ref(1);
const isCreatingInvite = ref(false);
const generatedInvite = ref<TeamInvite | null>(null);

// Expiration options
const expirationOptions = [
  { value: 1, label: '1 heure' },
  { value: 6, label: '6 heures' },
  { value: 12, label: '12 heures' },
  { value: 24, label: '24 heures' },
  { value: 48, label: '48 heures' },
  { value: 168, label: '7 jours' },
];

// Load data
async function loadData() {
  if (!token.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    const teamData = await fetchCurrentTeam();

    // Redirect to homepage if no team
    if (!teamData) {
      router.replace('/');
      return;
    }

    team.value = teamData;
    members.value = await fetchTeamMembers();
    locations.value = await fetchTeamLocations();

    // Load invitations if user has permission
    if (permissions.value.team.canInviteMembers) {
      try {
        invites.value = await fetchInvites(teamData.id);
      } catch (e) {
        // Silently fail for invites
        console.error('Error loading invites:', e);
      }
    }
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

// Delete the team (leader only)
async function confirmDeleteTeam() {
  if (!token.value || !isLeader.value) return;

  try {
    await deleteTeam();
    showDeleteTeamModal.value = false;
    team.value = null;
    members.value = [];
    showSuccess('Équipe supprimée');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Leave the team (for non-leader members)
async function confirmLeaveTeam() {
  if (!token.value || isLeader.value) return;

  try {
    await leaveTeam();
    showLeaveTeamModal.value = false;
    team.value = null;
    members.value = [];
    showSuccess('Vous avez quitté l\'équipe');
    // Reload to refresh user data
    window.location.reload();
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

// ========== Invitations ==========

// Open invite modal
function openInviteModal() {
  inviteExpiresHours.value = 24;
  inviteMaxUses.value = 1;
  generatedInvite.value = null;
  showInviteModal.value = true;
}

// Generate invite link
async function generateInvite() {
  if (!team.value) return;

  isCreatingInvite.value = true;
  error.value = null;

  try {
    const invite = await createInvite(team.value.id, {
      expiresInHours: inviteExpiresHours.value,
      maxUses: inviteMaxUses.value,
    });

    generatedInvite.value = invite;
    invites.value = [invite, ...invites.value];
    showSuccess('Lien d\'invitation généré !');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de la création';
  } finally {
    isCreatingInvite.value = false;
  }
}

// Copy invite URL to clipboard
async function copyInviteUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    showSuccess('Lien copié dans le presse-papiers !');
  } catch (e) {
    error.value = 'Impossible de copier le lien';
  }
}

// Revoke an invite
async function handleRevokeInvite(inviteId: string) {
  if (!team.value) return;

  try {
    await revokeInvite(team.value.id, inviteId);
    invites.value = invites.value.filter((i: TeamInvite) => i.id !== inviteId);
    showSuccess('Invitation révoquée');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Format expiration date
function formatExpiration(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Expiré';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
  }

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
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

    <!-- Team content -->
    <template v-else-if="team">
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

          <!-- Delete team button (Leader only) -->
          <button
            v-if="isLeader"
            class="btn-delete-team"
            @click="showDeleteTeamModal = true"
          >
            <SvgIcon name="trash" />
            Supprimer l'équipe
          </button>

          <!-- Leave team button (Non-leader members only) -->
          <button
            v-if="!isLeader"
            class="btn-leave-team"
            @click="showLeaveTeamModal = true"
          >
            <SvgIcon name="close" />
            Quitter l'équipe
          </button>
        </div>
      </section>

      <!-- Members section -->
      <section class="team-members">
        <div class="section-header">
          <h2>Membres ({{ members.length }})</h2>
          <button v-if="canInviteMembers" class="btn-invite" @click="openInviteModal">
            ➕ Inviter
          </button>
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

        <!-- Active invitations list -->
        <div v-if="canInviteMembers && invites.length > 0" class="invites-section">
          <h3>Invitations actives ({{ invites.length }})</h3>
          <div class="invites-list">
            <div v-for="invite in invites" :key="invite.id" class="invite-item">
              <div class="invite-info">
                <code class="invite-code">{{ invite.code }}</code>
                <span class="invite-details">
                  Expire dans {{ formatExpiration(invite.expiresAt) }} •
                  {{ invite.uses }}/{{ invite.maxUses }} utilisation(s)
                </span>
              </div>
              <div class="invite-actions">
                <button class="btn-copy" @click="copyInviteUrl(invite.url)" title="Copier le lien">
                  📋
                </button>
                <button class="btn-revoke" @click="handleRevokeInvite(invite.id)" title="Révoquer">
                  ❌
                </button>
              </div>
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

    <!-- Delete Team Confirmation Modal -->
    <ConfirmModal
      :open="showDeleteTeamModal"
      title="Supprimer l'équipe"
      :message="`Êtes-vous sûr de vouloir supprimer l'équipe '${team?.name}' ? Cette action supprimera définitivement tous les plans de jeu, événements et données de l'équipe. Cette action est irréversible.`"
      confirm-text="Supprimer"
      require-input="supprimer"
      :danger="true"
      @confirm="confirmDeleteTeam"
      @cancel="showDeleteTeamModal = false"
    />

    <!-- Leave Team Confirmation Modal -->
    <ConfirmModal
      :open="showLeaveTeamModal"
      title="Quitter l'équipe"
      :message="`Êtes-vous sûr de vouloir quitter l'équipe '${team?.name}' ? Vous devrez être réinvité pour la rejoindre.`"
      confirm-text="Quitter"
      :danger="true"
      @confirm="confirmLeaveTeam"
      @cancel="showLeaveTeamModal = false"
    />

    <!-- Invite Modal -->
    <Modal :open="showInviteModal" @close="showInviteModal = false">
      <template #header>
        <h3>Inviter un membre</h3>
      </template>

      <div class="invite-form">
        <template v-if="!generatedInvite">
          <p class="invite-description">
            Générez un lien d'invitation unique pour inviter un nouveau membre dans l'équipe.
          </p>

          <div class="form-group">
            <label>Expiration</label>
            <select v-model="inviteExpiresHours" :disabled="isCreatingInvite">
              <option v-for="opt in expirationOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Nombre d'utilisations maximum</label>
            <input
              type="number"
              v-model.number="inviteMaxUses"
              min="1"
              max="100"
              :disabled="isCreatingInvite"
            />
          </div>
        </template>

        <template v-else>
          <div class="invite-success">
            <p>✅ Lien d'invitation créé !</p>
            <div class="invite-url-box">
              <input type="text" :value="generatedInvite.url" readonly />
              <button class="btn-copy-big" @click="copyInviteUrl(generatedInvite.url)">
                📋 Copier
              </button>
            </div>
            <p class="invite-details-success">
              Expire dans {{ formatExpiration(generatedInvite.expiresAt) }} •
              {{ generatedInvite.maxUses }} utilisation(s) maximum
            </p>
          </div>
        </template>
      </div>

      <template #footer>
        <button class="btn-cancel" @click="showInviteModal = false">
          {{ generatedInvite ? 'Fermer' : 'Annuler' }}
        </button>
        <button
          v-if="!generatedInvite"
          class="btn-save"
          @click="generateInvite"
          :disabled="isCreatingInvite"
        >
          {{ isCreatingInvite ? 'Génération...' : 'Générer le lien' }}
        </button>
      </template>
    </Modal>
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

  .no-team-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-lg;
  }

  .no-team-actions {
    display: flex;
    gap: $spacing-md;
  }

  .btn-create {
    padding: $spacing-sm $spacing-lg;
    background: $color-accent;
    border: none;
    border-radius: $radius-md;
    color: white;
    font-size: $font-size-base;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: lighten($color-accent, 10%);
    }
  }

  .create-team-form {
    max-width: 400px;
    margin: 0 auto;
    text-align: left;
    background: $color-bg-tertiary;
    padding: $spacing-lg;
    border-radius: $radius-md;
    border: 1px solid $color-border;

    h2 {
      margin: 0 0 $spacing-xs;
      color: $color-text-primary;
    }

    .form-description {
      margin: 0 0 $spacing-lg;
      font-size: $font-size-sm;
      color: $color-text-muted;
    }
  }
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

// Delete team button
.btn-delete-team {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  margin-top: $spacing-lg;
  background: transparent;
  border: 1px solid $color-danger;
  border-radius: $radius-md;
  color: $color-danger;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: $color-danger;
    color: white;
  }

  :deep(svg) {
    width: 16px;
    height: 16px;
  }
}

// Leave team button
.btn-leave-team {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  margin-top: $spacing-lg;
  background: transparent;
  border: 1px solid $color-danger;
  border-radius: $radius-md;
  color: $color-danger;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: $color-danger;
    color: white;
  }

  :deep(svg) {
    width: 16px;
    height: 16px;
  }
}

// Invite button
.btn-invite {
  padding: $spacing-sm $spacing-md;
  background: $color-success;
  border: none;
  border-radius: $radius-md;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: darken($color-success, 10%);
  }
}

// Invitations section
.invites-section {
  margin-top: $spacing-lg;
  padding-top: $spacing-lg;
  border-top: 1px solid $color-border;

  h3 {
    font-size: $font-size-base;
    margin-bottom: $spacing-md;
    color: $color-text-secondary;
  }
}

.invites-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.invite-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border-radius: $radius-md;
  border: 1px solid $color-border;
}

.invite-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.invite-code {
  font-family: monospace;
  background: $color-bg-tertiary;
  padding: 2px 6px;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
}

.invite-details {
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.invite-actions {
  display: flex;
  gap: $spacing-sm;
}

.btn-copy,
.btn-revoke {
  padding: $spacing-xs $spacing-sm;
  background: transparent;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-bg-tertiary;
  }
}

.btn-revoke:hover {
  border-color: $color-danger;
  color: $color-danger;
}

// Invite modal form
.invite-form {
  min-width: 350px;
}

.invite-description {
  margin-bottom: $spacing-md;
  color: $color-text-secondary;
}

.invite-success {
  text-align: center;

  p:first-child {
    font-size: $font-size-lg;
    margin-bottom: $spacing-md;
  }
}

.invite-url-box {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;

  input {
    flex: 1;
    padding: $spacing-sm;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    color: $color-text-primary;
    font-family: monospace;
    font-size: $font-size-sm;
  }
}

.btn-copy-big {
  padding: $spacing-sm $spacing-md;
  background: $color-accent;
  border: none;
  border-radius: $radius-md;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: darken($color-accent, 10%);
  }
}

.invite-details-success {
  font-size: $font-size-sm;
  color: $color-text-secondary;
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
