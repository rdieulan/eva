<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import TeamLogo from '@/components/common/TeamLogo.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { fetchVenueBoard } from '@/api';
import { ApiError } from '@/api/error';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import type { PublicScrimSearch, VenueBoard } from '@shared/types';
import { ERROR } from '@shared/constants';
import { describeVenueBoard } from '@shared/utils';
import { calendarRoute, formatDateStr, formatLongDate } from '@/utils/calendar';
import { describeMatchesWanted, formatOfferRange } from '@/utils/scrims';

// The public board of a venue: the teams that look for an opponent there, day
// by day, readable without an account so the venue can share it on its own
// channels. Proposing goes through the calendar, after signing in.

// How long "Lien copié" stays before the button reads as before
const COPIED_NOTICE_MS = 2000;

const route = useRoute();
const { account, isAuthenticated, hasTeam } = useAuth();
const { errors, setErrorFromException, clearErrors } = useErrors();

const board = ref<VenueBoard | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const copyState = ref<'idle' | 'copied' | 'failed'>('idle');
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

async function load(slug: string) {
  isLoading.value = true;
  notFound.value = false;
  board.value = null;
  clearErrors();
  try {
    board.value = await fetchVenueBoard(slug);
    document.title = `EVA - ${describeVenueBoard(board.value.venue.name).title}`;
  } catch (error) {
    if (error instanceof ApiError && error.errors.includes(ERROR.venueNotFound)) {
      notFound.value = true;
      document.title = 'EVA - Salle introuvable';
    } else {
      setErrorFromException(error, ERROR.venueBoardFetchFailed);
    }
  } finally {
    isLoading.value = false;
  }
}

watch(() => route.params.slug, slug => {
  if (typeof slug === 'string') load(slug);
}, { immediate: true });

// Its title and its sentence, as the link shows them where it is posted
const words = computed(() => (board.value ? describeVenueBoard(board.value.venue.name) : null));

// The searches day by day, in the order the board gives them
const days = computed(() => {
  const byDate = new Map<string, PublicScrimSearch[]>();
  for (const search of board.value?.searches ?? []) {
    byDate.set(search.date, [...(byDate.get(search.date) ?? []), search]);
  }
  return [...byDate].map(([date, searches]) => ({ date, searches }));
});

function isOurs(search: PublicScrimSearch): boolean {
  return search.team.id === account.value?.teamId;
}

// The search's sheet in the calendar, its venue ticked: signing in comes first when needed
function searchRoute(search: PublicScrimSearch): RouteLocationRaw {
  return calendarRoute({
    page: 'calendar', date: search.date, mode: 'matchmaking', venueId: board.value!.venue.id,
    open: { kind: 'scrimSearch', id: search.id },
  });
}

// With nothing on the board: the matchmaking of the venue for a player of a team
const searchHereRoute = computed<RouteLocationRaw | null>(() => {
  if (!board.value || !hasTeam.value) return null;
  return calendarRoute({ page: 'calendar', date: formatDateStr(new Date()), mode: 'matchmaking', venueId: board.value.venue.id });
});

async function copyLink() {
  if (copiedTimer) clearTimeout(copiedTimer);
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyState.value = 'copied';
    copiedTimer = setTimeout(() => { copyState.value = 'idle'; }, COPIED_NOTICE_MS);
  } catch {
    copyState.value = 'failed';
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
</script>

<template>
  <div class="board-page">
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
    </div>

    <section v-else-if="notFound" class="board-missing">
      <h1>Salle introuvable</h1>
      <p>Cette adresse ne correspond à aucune salle.</p>
      <RouterLink to="/" class="btn btn-secondary">Retour à l'accueil</RouterLink>
    </section>

    <ErrorDisplay v-else-if="!board" :errors="errors" />

    <template v-else>
      <header class="board-header">
        <div class="board-heading">
          <h1>{{ words!.title }}</h1>
          <p class="board-lead">{{ words!.lead }}</p>
        </div>
        <button type="button" class="btn btn-secondary board-copy" @click="copyLink">
          {{ copyState === 'copied' ? 'Lien copié' : 'Copier le lien' }}
        </button>
        <p v-if="copyState === 'failed'" class="board-copy-failed" role="alert">
          Copie impossible ici : copiez l'adresse de la page.
        </p>
      </header>

      <section v-if="!days.length" class="board-empty">
        <p>Aucune équipe ne cherche d'adversaire à {{ board.venue.name }} pour le moment.</p>
        <RouterLink v-if="!isAuthenticated" :to="{ name: 'register' }" class="btn btn-primary">Créer un compte</RouterLink>
        <RouterLink v-else-if="searchHereRoute" :to="searchHereRoute" class="btn btn-primary">Chercher un adversaire</RouterLink>
      </section>

      <section v-for="day in days" :key="day.date" class="board-day">
        <h2 class="board-day-title">{{ formatLongDate(day.date) }}</h2>
        <ul class="board-searches">
          <li v-for="search in day.searches" :key="search.id" class="board-search">
            <TeamLogo :name="search.team.name" :logo-url="search.team.logoUrl" :size="40" />
            <div class="board-search-body">
              <p class="board-team">{{ search.team.name }}</p>
              <p class="board-wanted">{{ describeMatchesWanted(search) }}</p>
              <ul class="board-ranges" aria-label="Créneaux où un match tient">
                <li v-for="range in search.ranges" :key="`${range.arenaNumber}-${range.startTime}`" class="board-range">
                  {{ formatOfferRange(range, board.venue.arenaCount) }}
                </li>
              </ul>
            </div>
            <RouterLink :to="searchRoute(search)" class="btn btn-primary board-propose">
              {{ isOurs(search) ? 'Voir notre recherche' : 'Proposer un match' }}
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.board-page {
  width: 100%;
  max-width: 760px;
  height: 100%;
  margin: 0 auto;
  padding: $spacing-lg;
  overflow-y: auto;

  @include mobile-lg {
    padding: $spacing-md;
  }
}

.loading {
  display: flex;
  justify-content: center;
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

h1 {
  margin: 0;
  font-size: $font-size-2xl;
  color: $color-white;
}

.board-missing,
.board-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: $spacing-md;
  color: $color-text-secondary;

  p {
    margin: 0;
  }
}

.board-missing {
  padding-top: $spacing-xl;
}

.board-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
}

.board-heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  min-width: 0;
}

.board-lead {
  margin: 0;
  color: $color-text-secondary;
}

.board-copy-failed {
  flex-basis: 100%;
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.board-day + .board-day {
  margin-top: $spacing-lg;
}

.board-day-title {
  margin: 0 0 $spacing-sm;
  font-size: $font-size-base;
  font-weight: 600;
  color: $color-text-secondary;

  &::first-letter {
    text-transform: uppercase;
  }
}

.board-searches {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin: 0;
  padding: 0;
  list-style: none;
}

.board-search {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;

  // On a phone the button takes its own line under the team
  @include mobile {
    flex-wrap: wrap;
  }
}

.board-search-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

// The name is what the board is read for: a long one wraps, it is never cut
.board-team {
  margin: 0;
  color: $color-white;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.board-wanted {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.board-ranges {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin: $spacing-xs 0 0;
  padding: 0;
  list-style: none;
}

.board-range {
  padding: 1px $spacing-sm;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-sm;
  color: $color-text-primary;
  font-size: $font-size-sm;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.btn {
  text-decoration: none;
  white-space: nowrap;
}

.btn-primary {
  @include btn-base($color-accent);
}

.btn-secondary {
  @include btn-base($color-text-secondary);
}

.board-propose {
  flex-shrink: 0;

  @include mobile {
    flex-basis: 100%;
  }
}
</style>
