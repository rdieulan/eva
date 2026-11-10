<script setup lang="ts">
// Finding a league team of competitive.eva.gg by its name: the directory is
// searched as the player types, and each team listed shows its logo, its
// member count, and the team of ours it already is, when there is one
import { onBeforeUnmount, ref, watch } from 'vue';
import type { LeagueTeamSummary } from '@shared/types';
import { foldForSearch } from '@shared/utils';
import { LEAGUE_SEARCH_MAX_LENGTH, LEAGUE_SEARCH_MIN_LENGTH } from '@shared/constants';
import { searchLeagueTeams } from '@/api';
import { formatMemberCount } from '@/utils/league';
import TeamLogo from '@/components/common/TeamLogo.vue';

withDefaults(defineProps<{
  disabled?: boolean;
  autofocus?: boolean;
  placeholder?: string; // What the field asks for, to whoever searches
}>(), {
  disabled: false,
  autofocus: false,
  placeholder: 'Le nom de ton équipe de ligue',
});

const emit = defineEmits<{ select: [leagueTeam: LeagueTeamSummary] }>();

// The pause after the last key before the directory is searched
const TYPING_PAUSE_MS = 250;

type SearchState = 'idle' | 'short' | 'loading' | 'done' | 'failed';

const query = ref('');
const results = ref<LeagueTeamSummary[]>([]);
const state = ref<SearchState>('idle');

let timer: ReturnType<typeof setTimeout> | null = null;
let running: AbortController | null = null;

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  running?.abort();
  running = null;
}

async function search(text: string) {
  const controller = new AbortController();
  running = controller;
  try {
    const found = await searchLeagueTeams(text, controller.signal);
    if (running !== controller) return;
    results.value = found;
    state.value = 'done';
  } catch {
    // A search called off by the next one says nothing
    if (controller.signal.aborted) return;
    results.value = [];
    state.value = 'failed';
  }
}

watch(query, text => {
  stop();
  const folded = foldForSearch(text);
  if (!folded) {
    results.value = [];
    state.value = 'idle';
    return;
  }
  if ([...folded].length < LEAGUE_SEARCH_MIN_LENGTH) {
    results.value = [];
    state.value = 'short';
    return;
  }
  state.value = 'loading';
  timer = setTimeout(() => void search(text), TYPING_PAUSE_MS);
});

onBeforeUnmount(stop);
</script>

<template>
  <div class="league-search">
    <input
      v-model="query"
      class="league-search-field"
      type="search"
      :aria-label="placeholder"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      :maxlength="LEAGUE_SEARCH_MAX_LENGTH"
      :disabled="disabled"
      :autofocus="autofocus"
    />

    <p class="league-search-state" aria-live="polite">
      <template v-if="state === 'short'">Encore une lettre…</template>
      <template v-else-if="state === 'loading' && !results.length">Recherche…</template>
      <template v-else-if="state === 'failed'">La recherche n'a pas abouti : réessaie dans un instant.</template>
      <template v-else-if="state === 'done' && !results.length">Aucune équipe de ligue ne porte ce nom.</template>
    </p>

    <ul v-if="results.length" class="league-search-results">
      <li v-for="leagueTeam in results" :key="leagueTeam.id">
        <button type="button" class="league-search-result" :disabled="disabled" @click="emit('select', leagueTeam)">
          <TeamLogo :name="leagueTeam.name" :logo-url="leagueTeam.logoUrl" :size="40" />
          <span class="league-search-text">
            <span class="league-search-name">{{ leagueTeam.name }}</span>
            <span class="league-search-meta">{{ formatMemberCount(leagueTeam.memberCount) }}</span>
            <span v-if="leagueTeam.team" class="league-search-ours">Déjà sur l'application : {{ leagueTeam.team.name }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.league-search {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  min-width: 0;
}

.league-search-field {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-primary;
  font: inherit;

  &:focus {
    outline: none;
    border-color: $color-accent;
  }
}

.league-search-state {
  margin: 0;
  min-height: 1.4em;
  color: $color-text-muted;
  font-size: $font-size-sm;

  &:empty {
    display: none;
  }
}

.league-search-results {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  margin: 0;
  padding: 0;
  list-style: none;
}

.league-search-result {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  width: 100%;
  padding: $spacing-sm;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-primary;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible {
    border-color: $color-accent;
    background: with-alpha($color-accent, 0.08);
    outline: none;
  }
}

.league-search-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.league-search-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.league-search-meta {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.league-search-ours {
  color: $color-accent;
  font-size: $font-size-sm;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
