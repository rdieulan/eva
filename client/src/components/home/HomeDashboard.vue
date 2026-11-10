<script setup lang="ts">
// The home dashboard: what the player has to do soon, the most pressing first,
// read when the page opens. Each card says what it is about, in the colour and
// with the symbol of its subject (docs/PRODUIT.md, *Code couleur*), when it
// stops being of use, and what to do: a page of the app, another site (booking
// a seat on eva.gg, registering on competitive.eva.gg), or the team's league
// registration read again once done. With nothing to do, the team's next match.
import { computed, onMounted, ref } from 'vue';
import type { Dashboard } from '@shared/types';
import { ERROR } from '@shared/constants';
import { answerCompetitionOffer, checkLeagueRegistration, fetchDashboard } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { dashboardItemKey, describeDashboardItem, describeNextMatch } from '@/utils/dashboard';
import SubjectIcon from '@/components/common/SubjectIcon.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const { errors, setErrorFromException, clearErrors } = useErrors();
const dashboard = ref<Dashboard | null>(null);
const isLoading = ref(true);
const isChecking = ref(false);
// What the read again of the league said, under the card it was asked from
const leagueNote = ref<{ tournamentId: string; text: string } | null>(null);

const cards = computed(() => (dashboard.value?.items ?? []).map(item => ({
  item,
  key: dashboardItemKey(item),
  view: describeDashboardItem(item),
})));
const nextMatch = computed(() => dashboard.value?.nextMatch ? describeNextMatch(dashboard.value.nextMatch) : null);

async function load() {
  try {
    dashboard.value = await fetchDashboard();
    clearErrors();
  } catch (error) {
    setErrorFromException(error, ERROR.dashboardFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

function retry() {
  isLoading.value = true;
  clearErrors();
  void load();
}

// Registered on the site, its month leaves the dashboard; not yet, its card says so
async function checkLeague(tournamentId: string) {
  if (isChecking.value) return;
  isChecking.value = true;
  leagueNote.value = null;
  try {
    await checkLeagueRegistration();
    await load();
    const stillThere = dashboard.value?.items.some(item => item.kind === 'LEAGUE_REGISTRATION' && item.data.tournamentId === tournamentId);
    if (stillThere) {
      leagueNote.value = { tournamentId, text: 'Pas encore inscrite sur competitive.eva.gg. Une inscription peut attendre que l\'organisateur la valide.' };
    }
  } catch (error) {
    leagueNote.value = { tournamentId, text: error instanceof Error ? error.message : ERROR.leagueCheckFailed };
  } finally {
    isChecking.value = false;
  }
}

// Accepted, the competition joins the team's calendar; either way its card goes
const answering = ref<string | null>(null);
async function answer(competitionId: string, choice: 'accept' | 'refuse') {
  if (answering.value) return;
  answering.value = competitionId;
  clearErrors();
  try {
    await answerCompetitionOffer(competitionId, choice);
    await load();
  } catch (error) {
    setErrorFromException(error, ERROR.competitionOfferFailed);
  } finally {
    answering.value = null;
  }
}

onMounted(load);
</script>

<template>
  <section class="dashboard" aria-label="À faire">
    <p v-if="isLoading" class="dashboard-note">Chargement…</p>

    <template v-else-if="errors.length">
      <ErrorDisplay :errors="errors" />
      <button type="button" class="dashboard-retry" @click="retry">Réessayer</button>
    </template>

    <div v-else-if="!cards.length" class="dashboard-quiet">
      <p class="dashboard-quiet-title">Rien à faire pour le moment.</p>
      <p v-if="nextMatch" class="dashboard-quiet-next">
        {{ nextMatch.lead }} <RouterLink :to="nextMatch.to" class="subject--match">{{ nextMatch.label }}</RouterLink>
      </p>
    </div>

    <ol v-else class="dashboard-list">
      <li
        v-for="{ item, key, view } in cards"
        :key="key"
        class="dashboard-card"
        :class="[`subject--${view.subject}`, { urgent: view.isUrgent }]"
      >
        <SubjectIcon :subject="view.subject" size="28px" class="dashboard-icon" />
        <div class="dashboard-content">
          <div class="dashboard-head">
            <h2 class="dashboard-title">{{ view.title }}</h2>
            <span v-if="view.when" class="dashboard-when">{{ view.when }}</span>
          </div>
          <p class="dashboard-body">{{ view.body }}</p>
          <p
            v-if="view.detail"
            class="dashboard-detail"
            :class="view.headcountStatus && `headcount-${view.headcountStatus}`"
          >{{ view.detail }}</p>
          <p
            v-if="item.kind === 'LEAGUE_REGISTRATION' && leagueNote?.tournamentId === item.data.tournamentId"
            class="dashboard-detail dashboard-detail--note"
            role="status"
          >{{ leagueNote.text }}</p>

          <div class="dashboard-actions">
            <!-- The first is the main one, in the colour of the subject -->
            <template v-for="(action, index) in view.actions" :key="action.label">
              <RouterLink
                v-if="action.kind === 'route'"
                :to="action.to"
                class="dashboard-action"
                :class="{ 'dashboard-action--main': index === 0 }"
              >{{ action.label }}</RouterLink>
              <a
                v-else-if="action.kind === 'link'"
                :href="action.url"
                target="_blank"
                rel="noopener noreferrer"
                class="dashboard-action"
                :class="{ 'dashboard-action--main': index === 0 }"
              >{{ action.label }} ↗</a>
              <button
                v-else-if="action.kind === 'answerCompetition' && item.kind === 'COMPETITION_OFFER'"
                type="button"
                class="dashboard-action"
                :class="{ 'dashboard-action--main': index === 0, 'dashboard-action--refuse': action.answer === 'refuse' }"
                :disabled="answering !== null"
                @click="answer(item.data.competitionId, action.answer)"
              >{{ action.label }}</button>
              <button
                v-else-if="item.kind === 'LEAGUE_REGISTRATION'"
                type="button"
                class="dashboard-action"
                :class="{ 'dashboard-action--main': index === 0 }"
                :disabled="isChecking"
                @click="checkLeague(item.data.tournamentId)"
              >{{ isChecking ? 'Vérification…' : action.label }}</button>
            </template>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.dashboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  width: 100%;
}

.dashboard-note {
  margin: 0;
  padding: $spacing-lg;
  color: $color-text-secondary;
  text-align: center;
}

.dashboard-retry {
  @include btn-base($color-text-secondary);
  align-self: center;
  font-family: inherit;
}

.dashboard-quiet {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;
  text-align: center;
}

.dashboard-quiet-title {
  margin: 0;
  color: $color-text-primary;
  font-weight: 600;
}

.dashboard-quiet-next {
  margin: 0;
  color: $color-text-secondary;
  overflow-wrap: anywhere;

  a {
    color: var(--subject-color);
    font-weight: 600;
  }
}

@include subject-color-classes;

.dashboard-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dashboard-card {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-left: 4px solid var(--subject-color);
  border-radius: $radius-lg;

  // Due before the end of tomorrow: the card stands out in its own colour, never another
  &.urgent {
    background-image: linear-gradient(with-alpha(var(--subject-color), 0.12), with-alpha(var(--subject-color), 0.12));
  }

  @include mobile {
    gap: $spacing-sm;
    padding: $spacing-md;
  }
}

.dashboard-icon {
  margin-top: 2px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  flex: 1;
  min-width: 0;
}

.dashboard-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-xs $spacing-md;
}

.dashboard-title {
  margin: 0;
  font-size: $font-size-base;
  font-weight: 700;
  color: $color-text-primary;
  overflow-wrap: anywhere;
}

.dashboard-when {
  flex-shrink: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  font-weight: 600;

  .urgent & {
    color: var(--subject-color);
    font-weight: 700;
  }
}

.dashboard-body {
  margin: 0;
  color: $color-text-primary;
  overflow-wrap: anywhere;
}

.dashboard-detail {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  overflow-wrap: anywhere;

  &--note {
    color: $color-text-primary;
  }

  // What eva.gg counts, in the colours of the match sheet: full, players missing, one too many
  &.headcount-full {
    color: $color-success;
  }

  &.headcount-missing {
    color: $color-conditional;
  }

  &.headcount-over {
    color: $color-danger;
  }
}

.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.dashboard-action {
  @include btn-base($color-text-secondary);
  font-family: inherit;
  text-decoration: none;

  @include mobile-lg {
    min-height: $touch-target-min;
  }

  // What the card is there for, in the colour of its subject
  &--main {
    @include btn-base(var(--subject-color));
  }

  // Refusing: the state's red, as everywhere a refusal shows
  &--refuse {
    @include btn-base($color-danger);
  }
}
</style>
