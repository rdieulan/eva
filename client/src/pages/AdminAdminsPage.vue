<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import {
  fetchAdminAdmins,
  createAdminAdmin,
  updateAdminAdminPermissions,
  deleteAdminAdmin,
  buildActivationUrl,
} from '@/api';
import type { AdminSummary } from '@/api/admin.api';
import type { AdminPermissions } from '@shared/types';
import { ERROR } from '@shared/constants';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const { account } = useAuth();
const admins = ref<AdminSummary[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, setError, clearErrors } = useErrors();
const successMessage = ref<string | null>(null);

// Create form
const showCreateModal = ref(false);
const createForm = reactive({
  email: '',
  name: '',
  permissions: defaultPermissions(),
});
const isCreating = ref(false);

// Activation link modal
const showActivationModal = ref(false);
const activationUrl = ref<string>('');
const createdAdminName = ref<string>('');

// Edit form
const showEditModal = ref(false);
const editingAdmin = ref<AdminSummary | null>(null);
const editPermissions = ref<AdminPermissions>(defaultPermissions());
const isSaving = ref(false);

// Delete
const showDeleteModal = ref(false);
const adminToDelete = ref<AdminSummary | null>(null);

function defaultPermissions(): AdminPermissions {
  return {
    system: {
      canManageVenues: true,
      canManageManagers: true,
      canManageAdmins: false,
      canViewAllData: true,
    },
  };
}

function clonePermissions(p: AdminPermissions): AdminPermissions {
  return { system: { ...p.system } };
}

function showSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => { successMessage.value = null; }, 3000);
}

async function loadAdmins() {
  isLoading.value = true;
  clearErrors();
  try {
    admins.value = await fetchAdminAdmins();
  } catch (e) {
    setErrorFromException(e, ERROR.adminsFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  createForm.email = '';
  createForm.name = '';
  createForm.permissions = defaultPermissions();
  clearErrors();
  showCreateModal.value = true;
}

async function submitCreate() {
  clearErrors();
  isCreating.value = true;
  try {
    const result = await createAdminAdmin({
      email: createForm.email.trim(),
      name: createForm.name.trim(),
      permissions: createForm.permissions,
    });
    admins.value = [result.admin, ...admins.value];
    createdAdminName.value = result.admin.name;
    activationUrl.value = buildActivationUrl(result.activationToken);
    showCreateModal.value = false;
    showActivationModal.value = true;
  } catch (e) {
    setErrorFromException(e, ERROR.adminCreationFailed);
  } finally {
    isCreating.value = false;
  }
}

async function copyActivationUrl() {
  try {
    await navigator.clipboard.writeText(activationUrl.value);
    showSuccess('Lien copié');
  } catch {
    setError(ERROR.copyFailed);
  }
}

function openEdit(admin: AdminSummary) {
  editingAdmin.value = admin;
  editPermissions.value = clonePermissions(admin.permissions);
  clearErrors();
  showEditModal.value = true;
}

async function submitEdit() {
  if (!editingAdmin.value) return;
  clearErrors();
  isSaving.value = true;
  try {
    const updated = await updateAdminAdminPermissions(editingAdmin.value.id, editPermissions.value);
    const idx = admins.value.findIndex(a => a.id === updated.id);
    if (idx !== -1) admins.value[idx] = updated;
    showEditModal.value = false;
    editingAdmin.value = null;
    showSuccess('Administrateur mis à jour');
  } catch (e) {
    setErrorFromException(e, ERROR.adminUpdateFailed);
  } finally {
    isSaving.value = false;
  }
}

function openDelete(admin: AdminSummary) {
  adminToDelete.value = admin;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!adminToDelete.value) return;
  try {
    await deleteAdminAdmin(adminToDelete.value.id);
    admins.value = admins.value.filter(a => a.id !== adminToDelete.value!.id);
    showSuccess('Administrateur supprimé');
  } catch (e) {
    setErrorFromException(e, ERROR.adminDeleteFailed);
  } finally {
    showDeleteModal.value = false;
    adminToDelete.value = null;
  }
}

function isSelf(admin: AdminSummary): boolean {
  return account.value?.adminId === admin.id;
}

onMounted(loadAdmins);
</script>

<template>
  <section class="admin-admins">
    <header class="page-header">
      <h2>Administrateurs</h2>
      <button class="btn-primary" @click="openCreate">+ Nouvel administrateur</button>
    </header>

    <ErrorDisplay :errors="errors" />
    <div v-if="successMessage" class="message success">{{ successMessage }}</div>

    <div v-if="isLoading" class="loading">Chargement...</div>

    <div v-else-if="admins.length === 0" class="empty">
      Aucun administrateur.
    </div>

    <table v-else class="admins-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Email</th>
          <th>Type</th>
          <th>Statut</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="admin in admins" :key="admin.id" :class="{ 'is-self': isSelf(admin) }">
          <td>
            {{ admin.name }}
            <span v-if="isSelf(admin)" class="self-badge">(vous)</span>
          </td>
          <td>{{ admin.email }}</td>
          <td>
            <span v-if="admin.isSuperAdmin" class="badge badge--super">Super admin</span>
            <span v-else class="badge badge--regular">Admin</span>
          </td>
          <td>
            <span v-if="admin.activationPending" class="badge badge--pending">En attente d'activation</span>
            <span v-else class="badge badge--active">Actif</span>
          </td>
          <td class="col-actions">
            <button class="btn-link" @click="openEdit(admin)">Permissions</button>
            <button
              class="btn-link btn-link--danger"
              :disabled="isSelf(admin)"
              :title="isSelf(admin) ? 'Vous ne pouvez pas supprimer votre propre compte' : ''"
              @click="openDelete(admin)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Create modal -->
    <Modal :open="showCreateModal" title="Nouvel administrateur" size="md" @close="showCreateModal = false">
      <form class="admin-form" @submit.prevent="submitCreate">
        <ErrorDisplay :errors="errors" />

        <label>
          Email
          <input v-model="createForm.email" type="email" required maxlength="200" />
        </label>
        <label>
          Pseudo
          <input v-model="createForm.name" type="text" required maxlength="50" />
        </label>

        <fieldset class="perms">
          <legend>Permissions</legend>
          <label class="perm">
            <input type="checkbox" v-model="createForm.permissions.system.canManageVenues" />
            <span>Gérer les salles</span>
          </label>
          <label class="perm">
            <input type="checkbox" v-model="createForm.permissions.system.canManageManagers" />
            <span>Gérer les managers</span>
          </label>
          <label class="perm">
            <input type="checkbox" v-model="createForm.permissions.system.canManageAdmins" />
            <span>Gérer les administrateurs <em>(super admin)</em></span>
          </label>
          <label class="perm">
            <input type="checkbox" v-model="createForm.permissions.system.canViewAllData" />
            <span>Voir toutes les données</span>
          </label>
        </fieldset>
      </form>

      <template #footer>
        <button class="btn-secondary" :disabled="isCreating" @click="showCreateModal = false">Annuler</button>
        <button class="btn-primary" :disabled="isCreating" @click="submitCreate">
          {{ isCreating ? 'Création...' : 'Créer' }}
        </button>
      </template>
    </Modal>

    <!-- Activation link modal -->
    <Modal :open="showActivationModal" title="Administrateur créé" size="md" @close="showActivationModal = false">
      <div class="activation-info">
        <p>
          Le compte de <strong>{{ createdAdminName }}</strong> a été créé. Transmettez ce lien
          d'activation pour qu'il définisse son mot de passe.
        </p>
        <div class="activation-url">
          <input :value="activationUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
          <button class="btn-secondary" @click="copyActivationUrl">Copier</button>
        </div>
        <p class="hint">Ce lien est valable 7 jours.</p>
      </div>

      <template #footer>
        <button class="btn-primary" @click="showActivationModal = false">Fermer</button>
      </template>
    </Modal>

    <!-- Edit permissions modal -->
    <Modal :open="showEditModal" :title="editingAdmin ? `Permissions · ${editingAdmin.name}` : ''" size="md" @close="showEditModal = false">
      <form class="admin-form" @submit.prevent="submitEdit">
        <ErrorDisplay :errors="errors" />

        <fieldset class="perms">
          <legend>Permissions</legend>
          <label class="perm">
            <input type="checkbox" v-model="editPermissions.system.canManageVenues" />
            <span>Gérer les salles</span>
          </label>
          <label class="perm">
            <input type="checkbox" v-model="editPermissions.system.canManageManagers" />
            <span>Gérer les managers</span>
          </label>
          <label class="perm">
            <input type="checkbox" v-model="editPermissions.system.canManageAdmins" />
            <span>Gérer les administrateurs <em>(super admin)</em></span>
          </label>
          <label class="perm">
            <input type="checkbox" v-model="editPermissions.system.canViewAllData" />
            <span>Voir toutes les données</span>
          </label>
        </fieldset>
      </form>

      <template #footer>
        <button class="btn-secondary" :disabled="isSaving" @click="showEditModal = false">Annuler</button>
        <button class="btn-primary" :disabled="isSaving" @click="submitEdit">
          {{ isSaving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </template>
    </Modal>

    <ConfirmModal
      :open="showDeleteModal"
      title="Supprimer l'administrateur"
      :message="adminToDelete ? `Êtes-vous sûr de vouloir supprimer le compte administrateur de '${adminToDelete.name}' ?` : ''"
      confirm-text="Supprimer"
      require-input="supprimer"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false; adminToDelete = null"
    />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.admin-admins {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;

  h2 {
    margin: 0;
    color: $color-text-primary;
  }
}

.message.success {
  padding: $spacing-md;
  background: rgba($color-success, 0.1);
  border: 1px solid rgba($color-success, 0.3);
  color: $color-success;
  border-radius: $radius-md;
}

.loading,
.empty {
  padding: $spacing-xl;
  text-align: center;
  color: $color-text-secondary;
}

.admins-table {
  width: 100%;
  border-collapse: collapse;
  background: $color-bg-secondary;
  border-radius: $radius-md;
  overflow: hidden;

  th,
  td {
    padding: $spacing-md;
    text-align: left;
    border-bottom: 1px solid $color-border;
  }

  th {
    background: $color-bg-tertiary;
    color: $color-text-secondary;
    font-weight: 600;
    font-size: $font-size-sm;
    text-transform: uppercase;
  }

  td {
    color: $color-text-primary;
  }

  tr.is-self td:first-child {
    font-weight: 600;
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.self-badge {
  margin-left: $spacing-sm;
  color: $color-accent;
  font-size: $font-size-sm;
  font-weight: 500;
}

.col-actions {
  width: 1%;
  white-space: nowrap;
  text-align: right;

  .btn-link + .btn-link {
    margin-left: $spacing-sm;
  }
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: $font-size-xs;
  font-weight: 600;

  &--super {
    background: rgba($color-star, 0.15);
    color: $color-star;
  }

  &--regular {
    background: rgba($color-accent, 0.15);
    color: $color-accent;
  }

  &--pending {
    background: rgba($color-warning, 0.15);
    color: $color-warning;
  }

  &--active {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
}

.btn-primary {
  @include btn-base($color-accent);
}

.btn-secondary {
  @include btn-base($color-bg-tertiary);
}

.btn-link {
  background: transparent;
  border: none;
  color: $color-accent;
  cursor: pointer;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm;
  font-size: $font-size-sm;

  &:hover:not(:disabled) {
    background: $color-bg-tertiary;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &--danger {
    color: $color-danger;
  }
}

.admin-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;

  > label {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }

  input[type='text'],
  input[type='email'] {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-primary;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

.perms {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-md;

  legend {
    color: $color-text-secondary;
    font-size: $font-size-sm;
    padding: 0 $spacing-xs;
  }
}

.perm {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: $spacing-sm;
  color: $color-text-primary;
  cursor: pointer;

  em {
    color: $color-text-secondary;
    font-style: normal;
    font-size: $font-size-sm;
  }
}

.activation-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  color: $color-text-primary;
}

.activation-url {
  display: flex;
  gap: $spacing-sm;

  input {
    flex: 1;
    padding: $spacing-sm $spacing-md;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-primary;
    font-family: monospace;
    font-size: $font-size-sm;
  }
}

.hint {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  margin: 0;
}
</style>
