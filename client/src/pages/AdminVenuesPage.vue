<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import {
  fetchAdminVenues,
  createAdminVenue,
  updateAdminVenue,
  deleteAdminVenue,
} from '@/api';
import type { VenueInput } from '@/api/admin.api';
import type { Venue } from '@shared/types';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const venues = ref<Venue[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, clearErrors } = useErrors();
const successMessage = ref<string | null>(null);

// Form state (create + edit)
const showFormModal = ref(false);
const editingVenueId = ref<string | null>(null);
const form = reactive<VenueInput>({ name: '', city: '', address: '', phone: '' });
const isSaving = ref(false);

// Delete state
const showDeleteModal = ref(false);
const venueToDelete = ref<Venue | null>(null);

function showSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => { successMessage.value = null; }, 3000);
}

async function loadVenues() {
  isLoading.value = true;
  clearErrors();
  try {
    venues.value = await fetchAdminVenues();
  } catch (e) {
    setErrorFromException(e, ERROR.venuesFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editingVenueId.value = null;
  form.name = '';
  form.city = '';
  form.address = '';
  form.phone = '';
  clearErrors();
  showFormModal.value = true;
}

function openEdit(venue: Venue) {
  editingVenueId.value = venue.id;
  form.name = venue.name;
  form.city = venue.city;
  form.address = venue.address;
  form.phone = venue.phone ?? '';
  clearErrors();
  showFormModal.value = true;
}

async function saveVenue() {
  clearErrors();
  isSaving.value = true;
  try {
    const payload: VenueInput = {
      name: form.name,
      city: form.city,
      address: form.address,
      phone: form.phone || null,
    };
    if (editingVenueId.value) {
      const updated = await updateAdminVenue(editingVenueId.value, payload);
      const idx = venues.value.findIndex(v => v.id === updated.id);
      if (idx !== -1) venues.value[idx] = updated;
      showSuccess('Salle mise à jour');
    } else {
      const created = await createAdminVenue(payload);
      venues.value = [...venues.value, created].sort(
        (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name),
      );
      showSuccess('Salle créée');
    }
    showFormModal.value = false;
  } catch (e) {
    setErrorFromException(e, ERROR.venueUpdateFailed);
  } finally {
    isSaving.value = false;
  }
}

function openDelete(venue: Venue) {
  venueToDelete.value = venue;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!venueToDelete.value) return;
  try {
    await deleteAdminVenue(venueToDelete.value.id);
    venues.value = venues.value.filter(v => v.id !== venueToDelete.value!.id);
    showSuccess('Salle supprimée');
  } catch (e) {
    setErrorFromException(e, ERROR.venueDeleteFailed);
  } finally {
    showDeleteModal.value = false;
    venueToDelete.value = null;
  }
}

onMounted(loadVenues);
</script>

<template>
  <section class="admin-venues">
    <header class="page-header">
      <h2>Salles</h2>
      <button class="btn-primary" @click="openCreate">+ Nouvelle salle</button>
    </header>

    <ErrorDisplay :errors="errors" />
    <div v-if="successMessage" class="message success">{{ successMessage }}</div>

    <div v-if="isLoading" class="loading">Chargement...</div>

    <div v-else-if="venues.length === 0" class="empty">
      Aucune salle pour le moment.
    </div>

    <table v-else class="venues-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Ville</th>
          <th>Adresse</th>
          <th>Téléphone</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="venue in venues" :key="venue.id">
          <td>{{ venue.name }}</td>
          <td>{{ venue.city }}</td>
          <td>{{ venue.address }}</td>
          <td>{{ venue.phone || '—' }}</td>
          <td class="col-actions">
            <button class="btn-link" @click="openEdit(venue)">Modifier</button>
            <button class="btn-link btn-link--danger" @click="openDelete(venue)">Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>

    <Modal :open="showFormModal" :title="editingVenueId ? 'Modifier la salle' : 'Nouvelle salle'" size="md" @close="showFormModal = false">
      <form class="venue-form" @submit.prevent="saveVenue">
        <ErrorDisplay :errors="errors" />

        <label>
          Nom
          <input v-model="form.name" type="text" required maxlength="100" />
        </label>
        <label>
          Ville
          <input v-model="form.city" type="text" required maxlength="100" />
        </label>
        <label>
          Adresse
          <input v-model="form.address" type="text" required maxlength="200" />
        </label>
        <label>
          Téléphone (optionnel)
          <input v-model="form.phone" type="text" maxlength="40" />
        </label>
      </form>

      <template #footer>
        <button class="btn-secondary" :disabled="isSaving" @click="showFormModal = false">Annuler</button>
        <button class="btn-primary" :disabled="isSaving" @click="saveVenue">
          {{ isSaving ? 'Enregistrement...' : (editingVenueId ? 'Enregistrer' : 'Créer') }}
        </button>
      </template>
    </Modal>

    <ConfirmModal
      :open="showDeleteModal"
      title="Supprimer la salle"
      :message="venueToDelete ? `Êtes-vous sûr de vouloir supprimer la salle '${venueToDelete.name}' ? Les équipes affiliées perdront leur affiliation.` : ''"
      confirm-text="Supprimer"
      require-input="supprimer"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false; venueToDelete = null"
    />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.admin-venues {
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

.venues-table {
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

.venue-form {
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

  input {
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
</style>
