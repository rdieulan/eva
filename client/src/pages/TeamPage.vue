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
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import TeamInfo from '@/components/team/TeamInfo.vue';
import TeamMembers from '@/components/team/TeamMembers.vue';
import TeamInvites from '@/components/team/TeamInvites.vue';
import TeamPermissionsModal from '@/components/team/TeamPermissionsModal.vue';
import TeamInviteModal from '@/components/team/TeamInviteModal.vue';

const router = useRouter();
const { token, permissions, user } = useAuth();

// State
const team = ref<TeamWithMembers | null>(null);
const members = ref<TeamMember[]>([]);
const locations = ref<string[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Permissions modal
const showPermissionsModal = ref(false);
const selectedMember = ref<TeamMember | null>(null);
const editingPermissions = ref<UserPermissions>({ ...DEFAULT_PLAYER_PERMISSIONS });

// Remove member modal
const showRemoveModal = ref(false);
const memberToRemove = ref<TeamMember | null>(null);

// Computed permissions
const canManageTeam = computed(() => permissions.value.team.canManageTeam);
const canManagePermissions = computed(() => permissions.value.team.canManagePermissions);
const canRemoveMembers = computed(() => permissions.value.team.canRemoveMembers);
const canInviteMembers = computed(() => permissions.value.team.canInviteMembers);
const isLeader = computed(() => team.value?.leader.id === user.value?.id);

// Delete/Leave team modals
const showDeleteTeamModal = ref(false);
const showLeaveTeamModal = ref(false);

// Invitations
const invites = ref<TeamInvite[]>([]);
const showInviteModal = ref(false);
const isCreatingInvite = ref(false);
const generatedInvite = ref<TeamInvite | null>(null);

// Load data
async function loadData() {
  if (!token.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    const teamData = await fetchCurrentTeam();

    if (!teamData) {
      router.replace('/');
      return;
    }

    team.value = teamData;
    members.value = await fetchTeamMembers();
    locations.value = await fetchTeamLocations();

    if (permissions.value.team.canInviteMembers) {
      try {
        invites.value = await fetchInvites(teamData.id);
      } catch (e) {
        console.error('Error loading invites:', e);
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur inconnue';
  } finally {
    isLoading.value = false;
  }
}

// Show success message
function showSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => { successMessage.value = null; }, 3000);
}

// Team info handlers
async function handleSaveTeam(data: { name: string; location: string | null }) {
  if (!token.value || !team.value) return;

  try {
    await updateTeam(data);
    team.value.name = data.name;
    team.value.location = data.location ?? undefined;
    showSuccess('Équipe mise à jour');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

async function handleDeleteTeam() {
  if (!token.value || !isLeader.value) return;

  try {
    await deleteTeam();
    showDeleteTeamModal.value = false;
    showSuccess('Équipe supprimée');
    window.location.reload();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

async function handleLeaveTeam() {
  if (!token.value || isLeader.value) return;

  try {
    await leaveTeam();
    showLeaveTeamModal.value = false;
    showSuccess('Vous avez quitté l\'équipe');
    window.location.reload();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Permissions handlers
function openPermissionsModal(member: TeamMember) {
  if (member.isLeader) return;
  selectedMember.value = member;
  editingPermissions.value = member.permissions
    ? { ...member.permissions }
    : { ...DEFAULT_PLAYER_PERMISSIONS };
  showPermissionsModal.value = true;
}

async function savePermissions(perms: UserPermissions) {
  if (!token.value || !selectedMember.value) return;

  try {
    await updateMemberPermissions(selectedMember.value.id, perms);

    const idx = members.value.findIndex(m => m.id === selectedMember.value!.id);
    if (idx !== -1) {
      members.value[idx]!.permissions = { ...perms };
    }

    showPermissionsModal.value = false;
    showSuccess('Permissions mises à jour');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
}

// Remove member handlers
function openRemoveModal(member: TeamMember) {
  if (member.isLeader) return;
  memberToRemove.value = member;
  showRemoveModal.value = true;
}

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

// Invite handlers
function openInviteModal() {
  generatedInvite.value = null;
  showInviteModal.value = true;
}

async function generateInvite(options: { expiresInHours: number; maxUses: number }) {
  if (!team.value) return;

  isCreatingInvite.value = true;
  error.value = null;

  try {
    const invite = await createInvite(team.value.id, options);
    generatedInvite.value = invite;
    invites.value = [invite, ...invites.value];
    showSuccess('Lien d\'invitation généré !');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de la création';
  } finally {
    isCreatingInvite.value = false;
  }
}

async function copyInviteUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    showSuccess('Lien copié !');
  } catch (e) {
    error.value = 'Impossible de copier le lien';
  }
}

async function handleRevokeInvite(inviteId: string) {
  if (!team.value) return;

  try {
    await revokeInvite(team.value.id, inviteId);
    invites.value = invites.value.filter(i => i.id !== inviteId);
    showSuccess('Invitation révoquée');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur';
  }
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
      <TeamInfo
        :team="team"
        :locations="locations"
        :can-manage-team="canManageTeam"
        :is-leader="isLeader"
        @save="handleSaveTeam"
        @delete-team="showDeleteTeamModal = true"
        @leave-team="showLeaveTeamModal = true"
      />

      <!-- Members section -->
      <TeamMembers
        :members="members"
        :current-user-id="user?.id"
        :can-manage-permissions="canManagePermissions"
        :can-remove-members="canRemoveMembers"
        :can-invite-members="canInviteMembers"
        @invite="openInviteModal"
        @edit-permissions="openPermissionsModal"
        @remove-member="openRemoveModal"
      />

      <!-- Invites list (inside members section context) -->
      <TeamInvites
        v-if="canInviteMembers"
        :invites="invites"
        @copy="copyInviteUrl"
        @revoke="handleRevokeInvite"
      />
    </template>

    <!-- Permissions Modal -->
    <TeamPermissionsModal
      :open="showPermissionsModal"
      :member-name="selectedMember?.name || ''"
      v-model:permissions="editingPermissions"
      @close="showPermissionsModal = false"
      @save="savePermissions"
    />

    <!-- Remove Member Confirmation Modal -->
    <ConfirmModal
      :open="showRemoveModal"
      title="Retirer un membre"
      :message="`Êtes-vous sûr de vouloir retirer ${memberToRemove?.name} de l'équipe ?`"
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
      :message="`Êtes-vous sûr de vouloir supprimer l'équipe '${team?.name}' ? Cette action est irréversible.`"
      confirm-text="Supprimer"
      require-input="supprimer"
      :danger="true"
      @confirm="handleDeleteTeam"
      @cancel="showDeleteTeamModal = false"
    />

    <!-- Leave Team Confirmation Modal -->
    <ConfirmModal
      :open="showLeaveTeamModal"
      title="Quitter l'équipe"
      :message="`Êtes-vous sûr de vouloir quitter l'équipe '${team?.name}' ?`"
      confirm-text="Quitter"
      :danger="true"
      @confirm="handleLeaveTeam"
      @cancel="showLeaveTeamModal = false"
    />

    <!-- Invite Modal -->
    <TeamInviteModal
      :open="showInviteModal"
      :is-creating="isCreatingInvite"
      :generated-invite="generatedInvite"
      @close="showInviteModal = false"
      @generate="generateInvite"
      @copy="copyInviteUrl"
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

.message {
  padding: $spacing-md;
  border-radius: $radius-md;
  margin-bottom: $spacing-md;
  text-align: center;

  &.error {
    background: rgba($color-danger, 0.1);
    border: 1px solid rgba($color-danger, 0.3);
    color: $color-danger;
  }

  &.success {
    background: rgba($color-success, 0.1);
    border: 1px solid rgba($color-success, 0.3);
    color: $color-success;
  }
}
</style>
