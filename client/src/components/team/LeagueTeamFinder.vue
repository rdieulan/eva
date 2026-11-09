<script setup lang="ts">
// A player without a team finding theirs through its league team: searched by
// its name, then, once picked, joined or made. A league team another team of
// ours already is gets a request to join that team, its leader answering; one
// that no team of ours is yet gets made, its name and logo taken along.
import { computed, ref } from 'vue';
import type { LeagueTeamSummary, MyJoinRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { sendJoinRequest } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { formatMemberCount } from '@/utils/league';
import LeagueTeamSearch from '@/components/team/LeagueTeamSearch.vue';
import TeamLogo from '@/components/common/TeamLogo.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const emit = defineEmits<{
  create: [leagueTeam: LeagueTeamSummary];
  requested: [request: MyJoinRequest];
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const chosen = ref<LeagueTeamSummary | null>(null);
const isSending = ref(false);

// The name of ours, when the team took another one than its league team's
const ourName = computed(() => {
  const ours = chosen.value?.team;
  return ours && ours.name !== chosen.value!.name ? ours.name : null;
});

function choose(leagueTeam: LeagueTeamSummary | null) {
  clearErrors();
  chosen.value = leagueTeam;
}

async function requestToJoin() {
  const team = chosen.value?.team;
  if (!team || isSending.value) return;
  clearErrors();
  isSending.value = true;
  try {
    emit('requested', await sendJoinRequest(team.id));
  } catch (error) {
    setErrorFromException(error, ERROR.joinRequestFailed);
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div class="league-finder">
    <!-- Kept while a team is picked: going back finds the list as it was left -->
    <LeagueTeamSearch v-show="!chosen" :disabled="disabled" @select="choose" />

    <div v-if="chosen" class="league-chosen">
      <div class="league-chosen-team">
        <TeamLogo :name="chosen.name" :logo-url="chosen.logoUrl" :size="64" />
        <div class="league-chosen-text">
          <strong class="league-chosen-name">{{ chosen.name }}</strong>
          <span class="league-chosen-meta">{{ formatMemberCount(chosen.memberCount) }} sur competitive.eva.gg</span>
        </div>
      </div>

      <template v-if="chosen.team">
        <p class="league-chosen-lead">
          Ton équipe est déjà sur l'application{{ ourName ? `, sous le nom ${ourName}` : '' }}.
          Demande à la rejoindre : son capitaine accepte ou refuse.
        </p>
        <button type="button" class="league-chosen-action" :disabled="disabled || isSending" @click="requestToJoin">
          {{ isSending ? 'Envoi…' : `Demander à rejoindre ${chosen.team.name}` }}
        </button>
      </template>
      <template v-else>
        <p class="league-chosen-lead">
          Elle n'est pas encore sur l'application : crée-la, avec son nom et son logo.
        </p>
        <button type="button" class="league-chosen-action" :disabled="disabled" @click="emit('create', chosen)">
          Créer {{ chosen.name }}
        </button>
      </template>

      <ErrorDisplay :errors="errors" />

      <button type="button" class="league-chosen-back" :disabled="isSending" @click="choose(null)">
        Ce n'est pas mon équipe
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.league-finder {
  min-width: 0;
}

.league-chosen {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;
}

.league-chosen-team {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  min-width: 0;
}

.league-chosen-text {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  min-width: 0;
}

.league-chosen-name {
  font-size: $font-size-lg;
  color: $color-text-primary;
  overflow-wrap: anywhere;
}

.league-chosen-meta {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.league-chosen-lead {
  margin: 0;
  color: $color-text-secondary;
  line-height: 1.5;
}

.league-chosen-action {
  padding: $spacing-sm $spacing-lg;
  background: $color-accent;
  border: none;
  border-radius: $radius-md;
  color: $color-white;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  overflow-wrap: anywhere;

  &:hover:not(:disabled) {
    background: with-alpha($color-accent, 0.85);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.league-chosen-back {
  align-self: center;
  padding: $spacing-xs $spacing-sm;
  background: none;
  border: none;
  color: $color-text-secondary;
  font: inherit;
  font-size: $font-size-sm;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: $color-text-primary;
    text-decoration: underline;
  }
}
</style>
