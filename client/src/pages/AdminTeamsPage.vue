<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchAdminTeams, fetchAdminTeamDetail } from '@/api';
import type { TeamAdminSummary, TeamAdminDetail } from '@/api/admin.api';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import Modal from '@/components/common/Modal.vue';

const teams = ref<TeamAdminSummary[]>([]);
const isLoading = ref(true);
const { errors, setErrorFromException, clearErrors } = useErrors();

const search = ref('');

const filteredTeams = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return teams.value;
  return teams.value.filter(t =>
    t.name.toLowerCase().includes(q)
    || (t.leader?.name ?? '').toLowerCase().includes(q)
    || (t.venue?.name ?? '').toLowerCase().includes(q),
  );
});

// Detail modal
const showDetailModal = ref(false);
const detail = ref<TeamAdminDetail | null>(null);
const isLoadingDetail = ref(false);

async function loadTeams() {
  isLoading.value = true;
  clearErrors();
  try {
    teams.value = await fetchAdminTeams();
  } catch (e) {
    setErrorFromException(e, ERROR.teamsAdminFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

async function openDetail(team: TeamAdminSummary) {
  clearErrors();
  showDetailModal.value = true;
  detail.value = null;
  isLoadingDetail.value = true;
  try {
    detail.value = await fetchAdminTeamDetail(team.id);
  } catch (e) {
    setErrorFromException(e, ERROR.teamsAdminFetchFailed);
  } finally {
    isLoadingDetail.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(loadTeams);
</script>

<template>
  <section class="admin-teams">
    <header class="page-header">
      <h2>Équipes <span class="count">({{ teams.length }})</span></h2>
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher par nom, leader, salle..."
        class="search"
      />
    </header>

    <ErrorDisplay :errors="errors" />

    <div v-if="isLoading" class="loading">Chargement...</div>

    <div v-else-if="teams.length === 0" class="empty">
      Aucune équipe.
    </div>

    <div v-else-if="filteredTeams.length === 0" class="empty">
      Aucune équipe ne correspond à la recherche.
    </div>

    <table v-else class="teams-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Leader</th>
          <th>Membres</th>
          <th>Salle</th>
          <th>Créée le</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in filteredTeams" :key="t.id">
          <td>{{ t.name }}</td>
          <td>{{ t.leader?.name ?? '—' }}</td>
          <td>{{ t.memberCount }}</td>
          <td>
            <span v-if="t.venue">{{ t.venue.name }} <em>· {{ t.venue.city }}</em></span>
            <span v-else class="muted">—</span>
          </td>
          <td>{{ formatDate(t.createdAt) }}</td>
          <td class="col-actions">
            <button class="btn-link" @click="openDetail(t)">Détails</button>
          </td>
        </tr>
      </tbody>
    </table>

    <Modal :open="showDetailModal" :title="detail?.name ?? 'Équipe'" size="md" @close="showDetailModal = false">
      <div v-if="isLoadingDetail" class="loading">Chargement...</div>
      <div v-else-if="detail" class="detail">
        <div class="detail-row">
          <span class="detail-label">Leader</span>
          <span>{{ detail.leader ? `${detail.leader.name} · ${detail.leader.email}` : '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Salle</span>
          <span v-if="detail.venue">{{ detail.venue.name }} · {{ detail.venue.city }}</span>
          <span v-else class="muted">Aucune</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Créée le</span>
          <span>{{ formatDate(detail.createdAt) }}</span>
        </div>

        <h4>Membres ({{ detail.members.length }})</h4>
        <ul class="members">
          <li v-for="m in detail.members" :key="m.id">
            <span class="member-name">{{ m.name }}</span>
            <span class="member-email">{{ m.email }}</span>
            <span v-if="m.isLeader" class="badge badge--leader">Leader</span>
          </li>
        </ul>
      </div>

      <template #footer>
        <button class="btn-primary" @click="showDetailModal = false">Fermer</button>
      </template>
    </Modal>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.admin-teams {
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

.teams-table {
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

    em {
      color: $color-text-secondary;
      font-style: normal;
      font-size: $font-size-sm;
    }
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.col-actions {
  width: 1%;
  white-space: nowrap;
  text-align: right;
}

.muted {
  color: $color-text-secondary;
  font-style: italic;
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
}

.btn-primary {
  @include btn-base($color-accent);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  color: $color-text-primary;

  h4 {
    margin: $spacing-md 0 $spacing-sm;
    color: $color-text-primary;
  }
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-xs 0;
  border-bottom: 1px solid $color-border;
}

.detail-label {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.members {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  li {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-sm;
    background: $color-bg-tertiary;
    border-radius: $radius-sm;
  }
}

.member-name {
  font-weight: 600;
  color: $color-text-primary;
}

.member-email {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  margin-right: auto;
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
}
</style>
