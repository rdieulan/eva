<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import {
  fetchAdminManagers,
  createAdminManager,
  updateAdminManagerVenues,
  deleteAdminManager,
  fetchAdminVenues,
  buildActivationUrl,
} from '@/api';
import type { ManagerSummary } from '@/api/admin.api';
import type { Venue } from '@shared/types';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const managers = ref<ManagerSummary[]>([]);
const venues = ref<Venue[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, setError, clearErrors } = useErrors();
const successMessage = ref<string | null>(null);

// Create form
const showCreateModal = ref(false);
const createForm = reactive({ email: '', name: '', venueIds: [] as string[] });
const isCreating = ref(false);

// Activation link modal (shown after creation)
const showActivationModal = ref(false);
const activationUrl = ref<string>('');
const createdManagerName = ref<string>('');

// Edit form
const showEditModal = ref(false);
const editingManager = ref<ManagerSummary | null>(null);
const editVenueIds = ref<string[]>([]);
const isSaving = ref(false);

// Delete
const showDeleteModal = ref(false);
const managerToDelete = ref<ManagerSummary | null>(null);

function showSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => { successMessage.value = null; }, 3000);
}

async function loadData() {
  isLoading.value = true;
  clearErrors();
  try {
    [managers.value, venues.value] = await Promise.all([
      fetchAdminManagers(),
      fetchAdminVenues(),
    ]);
  } catch (e) {
    setErrorFromException(e, ERROR.managersFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

function toggleVenueInList(list: string[], venueId: string): string[] {
  return list.includes(venueId) ? list.filter(id => id !== venueId) : [...list, venueId];
}

function openCreate() {
  createForm.email = '';
  createForm.name = '';
  createForm.venueIds = [];
  clearErrors();
  showCreateModal.value = true;
}

async function submitCreate() {
  clearErrors();
  isCreating.value = true;
  try {
    const result = await createAdminManager({
      email: createForm.email.trim(),
      name: createForm.name.trim(),
      venueIds: createForm.venueIds,
    });
    managers.value = [result.manager, ...managers.value];
    createdManagerName.value = result.manager.name;
    activationUrl.value = buildActivationUrl(result.activationToken);
    showCreateModal.value = false;
    showActivationModal.value = true;
  } catch (e) {
    setErrorFromException(e, ERROR.managerCreationFailed);
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

function openEdit(manager: ManagerSummary) {
  editingManager.value = manager;
  editVenueIds.value = manager.venues.map(v => v.id);
  clearErrors();
  showEditModal.value = true;
}

function toggleEditVenue(venueId: string) {
  editVenueIds.value = toggleVenueInList(editVenueIds.value, venueId);
}

function toggleCreateVenue(venueId: string) {
  createForm.venueIds = toggleVenueInList(createForm.venueIds, venueId);
}

async function submitEdit() {
  if (!editingManager.value) return;
  clearErrors();
  isSaving.value = true;
  try {
    const updated = await updateAdminManagerVenues(editingManager.value.id, editVenueIds.value);
    const idx = managers.value.findIndex(m => m.id === updated.id);
    if (idx !== -1) managers.value[idx] = updated;
    showEditModal.value = false;
    editingManager.value = null;
    showSuccess('Manager mis à jour');
  } catch (e) {
    setErrorFromException(e, ERROR.managerUpdateFailed);
  } finally {
    isSaving.value = false;
  }
}

function openDelete(manager: ManagerSummary) {
  managerToDelete.value = manager;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!managerToDelete.value) return;
  try {
    await deleteAdminManager(managerToDelete.value.id);
    managers.value = managers.value.filter(m => m.id !== managerToDelete.value!.id);
    showSuccess('Manager supprimé');
  } catch (e) {
    setErrorFromException(e, ERROR.managerDeleteFailed);
  } finally {
    showDeleteModal.value = false;
    managerToDelete.value = null;
  }
}

onMounted(loadData);
</script>

<template>
  <section class="admin-managers">
    <header class="page-header">
      <h2>Managers</h2>
      <button class="btn-primary" @click="openCreate">+ Nouveau manager</button>
    </header>

    <ErrorDisplay :errors="errors" />
    <div v-if="successMessage" class="message success">{{ successMessage }}</div>

    <div v-if="isLoading" class="loading">Chargement...</div>

    <div v-else-if="managers.length === 0" class="empty">
      Aucun manager pour le moment.
    </div>

    <table v-else class="managers-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Email</th>
          <th>Salles</th>
          <th>Statut</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="manager in managers" :key="manager.id">
          <td>{{ manager.name }}</td>
          <td>{{ manager.email }}</td>
          <td>
            <span v-if="manager.venues.length === 0" class="muted">Aucune</span>
            <span v-else>{{ manager.venues.map(v => v.name).join(', ') }}</span>
          </td>
          <td>
            <span v-if="manager.activationPending" class="badge badge--pending">En attente d'activation</span>
            <span v-else class="badge badge--active">Actif</span>
          </td>
          <td class="col-actions">
            <button class="btn-link" @click="openEdit(manager)">Modifier</button>
            <button class="btn-link btn-link--danger" @click="openDelete(manager)">Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Create modal -->
    <Modal :open="showCreateModal" title="Nouveau manager" size="md" @close="showCreateModal = false">
      <form class="manager-form" @submit.prevent="submitCreate">
        <ErrorDisplay :errors="errors" />

        <label>
          Email
          <input v-model="createForm.email" type="email" required maxlength="200" />
        </label>
        <label>
          Pseudo
          <input v-model="createForm.name" type="text" required maxlength="50" />
        </label>

        <fieldset class="venues-pick">
          <legend>Salles associées</legend>
          <p v-if="venues.length === 0" class="muted">Aucune salle disponible. Créez une salle d'abord.</p>
          <label v-for="venue in venues" :key="venue.id" class="venue-check">
            <input
              type="checkbox"
              :checked="createForm.venueIds.includes(venue.id)"
              @change="toggleCreateVenue(venue.id)"
            />
            <span>{{ venue.name }} <em>· {{ venue.city }}</em></span>
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
    <Modal :open="showActivationModal" title="Manager créé" size="md" @close="showActivationModal = false">
      <div class="activation-info">
        <p>
          Le compte de <strong>{{ createdManagerName }}</strong> a été créé. Transmettez ce lien
          d'activation au manager pour qu'il définisse son mot de passe.
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

    <!-- Edit modal -->
    <Modal :open="showEditModal" :title="editingManager ? `Modifier ${editingManager.name}` : ''" size="md" @close="showEditModal = false">
      <form class="manager-form" @submit.prevent="submitEdit">
        <ErrorDisplay :errors="errors" />

        <fieldset class="venues-pick">
          <legend>Salles associées</legend>
          <label v-for="venue in venues" :key="venue.id" class="venue-check">
            <input
              type="checkbox"
              :checked="editVenueIds.includes(venue.id)"
              @change="toggleEditVenue(venue.id)"
            />
            <span>{{ venue.name }} <em>· {{ venue.city }}</em></span>
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
      title="Supprimer le manager"
      :message="managerToDelete ? `Êtes-vous sûr de vouloir supprimer le compte de '${managerToDelete.name}' ?` : ''"
      confirm-text="Supprimer"
      require-input="supprimer"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false; managerToDelete = null"
    />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.admin-managers {
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

.managers-table {
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

  tr:last-child td {
    border-bottom: none;
  }
}

.col-actions {
  width: 1%;
  white-space: nowrap;
  text-align: right;

  .btn-link + .btn-link {
    margin-left: $spacing-sm;
  }
}

.muted {
  color: $color-text-secondary;
  font-style: italic;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: $font-size-xs;
  font-weight: 600;

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

  &:hover {
    background: $color-bg-tertiary;
  }

  &--danger {
    color: $color-danger;
  }
}

.manager-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;

  label {
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

.venues-pick {
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

.venue-check {
  display: flex;
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
