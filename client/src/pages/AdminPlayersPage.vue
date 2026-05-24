<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  fetchAdminPlayers,
  resetPlayerPassword,
  deleteAdminPlayer,
  buildPasswordResetUrl,
} from '@/api';
import type { PlayerAdminSummary } from '@/api/admin.api';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const players = ref<PlayerAdminSummary[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, setError, clearErrors } = useErrors();
const successMessage = ref<string | null>(null);

const search = ref('');

const filteredPlayers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return players.value;
  return players.value.filter(p =>
    (p.name ?? '').toLowerCase().includes(q)
    || (p.email ?? '').toLowerCase().includes(q)
    || (p.teamName ?? '').toLowerCase().includes(q),
  );
});

// Reset password modal
const showResetModal = ref(false);
const resetUrl = ref<string>('');
const resetUserEmail = ref<string>('');
const isGeneratingReset = ref(false);

// Delete modal
const showDeleteModal = ref(false);
const playerToDelete = ref<PlayerAdminSummary | null>(null);

async function loadPlayers() {
  isLoading.value = true;
  clearErrors();
  try {
    players.value = await fetchAdminPlayers();
  } catch (e) {
    setErrorFromException(e, ERROR.playersAdminFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

function showSuccess(message: string) {
  successMessage.value = message;
  setTimeout(() => { successMessage.value = null; }, 3000);
}

async function openResetPassword(player: PlayerAdminSummary) {
  clearErrors();
  isGeneratingReset.value = true;
  try {
    const result = await resetPlayerPassword(player.id);
    resetUrl.value = buildPasswordResetUrl(result.token);
    resetUserEmail.value = result.userEmail;
    showResetModal.value = true;
  } catch (e) {
    setErrorFromException(e, ERROR.passwordResetFailed);
  } finally {
    isGeneratingReset.value = false;
  }
}

async function copyResetUrl() {
  try {
    await navigator.clipboard.writeText(resetUrl.value);
    showSuccess('Lien copié');
  } catch {
    setError(ERROR.copyFailed);
  }
}

function openDelete(player: PlayerAdminSummary) {
  playerToDelete.value = player;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!playerToDelete.value) return;
  try {
    await deleteAdminPlayer(playerToDelete.value.id);
    players.value = players.value.filter(p => p.id !== playerToDelete.value!.id);
    showSuccess('Joueur supprimé');
  } catch (e) {
    setErrorFromException(e, ERROR.playerDeleteFailed);
  } finally {
    showDeleteModal.value = false;
    playerToDelete.value = null;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(loadPlayers);
</script>

<template>
  <section class="admin-players">
    <header class="page-header">
      <h2>Joueurs <span class="count">({{ players.length }})</span></h2>
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher par nom, email, équipe..."
        class="search"
      />
    </header>

    <ErrorDisplay :errors="errors" />
    <div v-if="successMessage" class="message success">{{ successMessage }}</div>

    <div v-if="isLoading" class="loading">Chargement...</div>

    <div v-else-if="players.length === 0" class="empty">
      Aucun joueur inscrit.
    </div>

    <div v-else-if="filteredPlayers.length === 0" class="empty">
      Aucun joueur ne correspond à la recherche.
    </div>

    <table v-else class="players-table">
      <thead>
        <tr>
          <th>Pseudo</th>
          <th>Email</th>
          <th>Équipe</th>
          <th>Rôle</th>
          <th>Inscrit le</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in filteredPlayers" :key="p.id">
          <td>{{ p.name ?? '—' }}</td>
          <td>{{ p.email ?? '—' }}</td>
          <td>
            <span v-if="p.teamName">{{ p.teamName }}</span>
            <span v-else class="muted">Sans équipe</span>
          </td>
          <td>
            <span v-if="p.isLeader" class="badge badge--leader">Leader</span>
            <span v-else-if="p.teamId" class="badge badge--member">Membre</span>
            <span v-else class="muted">—</span>
          </td>
          <td>{{ formatDate(p.createdAt) }}</td>
          <td class="col-actions">
            <button
              class="btn-link"
              :disabled="isGeneratingReset || !p.userId"
              @click="openResetPassword(p)"
            >Réinitialiser le mot de passe</button>
            <button
              class="btn-link btn-link--danger"
              :disabled="p.isLeader"
              :title="p.isLeader ? 'Impossible de supprimer un leader d’équipe. Supprimez l’équipe d’abord.' : ''"
              @click="openDelete(p)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Reset password URL modal -->
    <Modal :open="showResetModal" title="Lien de réinitialisation" size="md" @close="showResetModal = false">
      <div class="reset-info">
        <p>
          Transmettez ce lien à <strong>{{ resetUserEmail }}</strong> pour qu'il
          définisse un nouveau mot de passe. Ses sessions actuelles ont été invalidées.
        </p>
        <div class="reset-url">
          <input :value="resetUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
          <button class="btn-secondary" @click="copyResetUrl">Copier</button>
        </div>
        <p class="hint">Ce lien est valable 24 heures.</p>
      </div>

      <template #footer>
        <button class="btn-primary" @click="showResetModal = false">Fermer</button>
      </template>
    </Modal>

    <ConfirmModal
      :open="showDeleteModal"
      title="Supprimer le joueur"
      :message="playerToDelete ? `Êtes-vous sûr de vouloir supprimer le compte de '${playerToDelete.name}' ? Toutes ses disponibilités, invitations créées et événements de calendrier qu'il a créés seront aussi supprimés.` : ''"
      confirm-text="Supprimer"
      require-input="supprimer"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false; playerToDelete = null"
    />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.admin-players {
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

.count {
  color: $color-text-secondary;
  font-weight: 400;
  font-size: $font-size-base;
}

.search {
  padding: $spacing-sm $spacing-md;
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  color: $color-text-primary;
  font-size: $font-size-base;
  min-width: 260px;

  &:focus {
    outline: none;
    border-color: $color-accent;
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

.players-table {
  width: 100%;
  border-collapse: collapse;
  background: $color-bg-secondary;
  border-radius: $radius-md;
  overflow: hidden;

  th, td {
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

  &--leader {
    background: rgba($color-star, 0.15);
    color: $color-star;
  }

  &--member {
    background: rgba($color-accent, 0.15);
    color: $color-accent;
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

.reset-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  color: $color-text-primary;
}

.reset-url {
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
