<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  fetchAdminPlayers,
  deleteAdminPlayer,
  freePlayerEvaAccount,
} from '@/api';
import type { PlayerAdminSummary } from '@/api/admin.api';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const players = ref<PlayerAdminSummary[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, clearErrors } = useErrors();
const successMessage = ref<string | null>(null);

const search = ref('');

const filteredPlayers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return players.value;
  return players.value.filter(p =>
    (p.name ?? '').toLowerCase().includes(q)
    || (p.teamName ?? '').toLowerCase().includes(q)
    || (p.evaUsername ?? '').toLowerCase().includes(q),
  );
});

// Delete modal
const showDeleteModal = ref(false);
const playerToDelete = ref<PlayerAdminSummary | null>(null);

// The player whose eva.gg account is being freed: for its owner to link it,
// when another player holds a tag that is not theirs
const playerToFree = ref<PlayerAdminSummary | null>(null);

async function confirmFree() {
  const player = playerToFree.value;
  if (!player) return;
  clearErrors();
  try {
    await freePlayerEvaAccount(player.id);
    players.value = players.value.map(p => (p.id === player.id ? { ...p, evaUsername: null } : p));
    showSuccess('Compte eva.gg libéré');
  } catch (e) {
    setErrorFromException(e, ERROR.evaAccountFreeFailed);
  } finally {
    playerToFree.value = null;
  }
}

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

// Why a player cannot be deleted from here, if they cannot
function deleteBlockedReason(player: PlayerAdminSummary): string {
  if (player.isLeader) return 'Impossible de supprimer un leader d’équipe. Supprimez l’équipe d’abord.';
  if (player.roles.includes('admin')) return 'Administrateur : retirez-lui d’abord ce rôle, dans la liste des administrateurs.';
  if (player.roles.includes('manager')) return 'Manager : retirez-lui d’abord ce rôle, dans la liste des managers.';
  return '';
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
        placeholder="Pseudo, équipe, tag eva.gg..."
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
          <th>Compte eva.gg</th>
          <th>Équipe</th>
          <th>Rôle</th>
          <th>Inscrit le</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in filteredPlayers" :key="p.id">
          <td>
            {{ p.name ?? '—' }}
            <span v-if="p.roles.includes('manager')" class="badge badge--role">Gérant</span>
            <span v-if="p.roles.includes('admin')" class="badge badge--role">Admin</span>
          </td>
          <td>
            <span v-if="p.evaUsername" class="eva-tag">{{ p.evaUsername }}</span>
            <span v-else class="muted">Aucun</span>
          </td>
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
              v-if="p.evaUsername"
              class="btn-link"
              title="Pour que son propriétaire le relie, quand ce joueur tient un compte qui n'est pas le sien"
              @click="playerToFree = p"
            >Libérer eva.gg</button>
            <button
              class="btn-link btn-link--danger"
              :disabled="!!deleteBlockedReason(p)"
              :title="deleteBlockedReason(p)"
              @click="openDelete(p)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>

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

    <ConfirmModal
      :open="!!playerToFree"
      title="Libérer le compte eva.gg"
      :message="playerToFree ? `Libérer ${playerToFree.evaUsername} de '${playerToFree.name}' ? Son propriétaire pourra le relier, et '${playerToFree.name}' devra relier le sien à sa prochaine visite.` : ''"
      confirm-text="Libérer"
      :danger="true"
      @confirm="confirmFree"
      @cancel="playerToFree = null"
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
  border: $border-thin solid $color-border;
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
  background: with-alpha($color-success, 0.1);
  border: $border-thin solid with-alpha($color-success, 0.3);
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
    border-bottom: $border-thin solid $color-border;
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

// A tag reads whole: a few characters, never cut at its #
.eva-tag {
  white-space: nowrap;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: $font-size-xs;
  font-weight: 600;

  &--leader {
    background: with-alpha($color-star, 0.15);
    color: $color-star;
  }

  &--member {
    background: with-alpha($color-accent, 0.15);
    color: $color-accent;
  }

  &--role {
    margin-left: $spacing-xs;
    background: $color-bg-tertiary;
    color: $color-text-secondary;
  }
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
</style>
