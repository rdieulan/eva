<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchAdminPlayers } from '@/api';
import type { PlayerAdminSummary } from '@/api/admin.api';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const players = ref<PlayerAdminSummary[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, clearErrors } = useErrors();

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
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

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
</style>
