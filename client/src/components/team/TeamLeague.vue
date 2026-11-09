<script setup lang="ts">
// The league team the team is on competitive.eva.gg. Linked, players who find
// that league team in the directory find the team, and can ask to join it.
// Whoever manages the team links it, changes it or unlinks it; linked, a team
// with no logo takes its league team's, and one with no venue its league's.
import { ref } from 'vue';
import type { LeagueTeamSummary } from '@shared/types';
import { ERROR } from '@shared/constants';
import { setTeamLeagueTeam, type TeamLeagueLink } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { formatMemberCount } from '@/utils/league';
import LeagueTeamSearch from '@/components/team/LeagueTeamSearch.vue';
import TeamLogo from '@/components/common/TeamLogo.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const props = defineProps<{
  teamId: string;
  leagueTeam: LeagueTeamSummary | null;
  canManage: boolean;
}>();

const emit = defineEmits<{
  // The league team linked now, where the team's logo loads from, its venue
  changed: [link: TeamLeagueLink];
}>();

const { errors, setError, setErrorFromException, clearErrors } = useErrors();
const isChanging = ref(false); // Another league team instead of the one linked
const isBusy = ref(false);

async function set(leagueTeamId: string | null) {
  if (isBusy.value) return;
  isBusy.value = true;
  clearErrors();
  try {
    const link = await setTeamLeagueTeam(leagueTeamId);
    isChanging.value = false;
    emit('changed', link);
  } catch (error) {
    setErrorFromException(error, ERROR.leagueTeamLinkFailed);
  } finally {
    isBusy.value = false;
  }
}

function link(picked: LeagueTeamSummary) {
  // Another team of ours already is that league team: said at once
  if (picked.team && picked.team.id !== props.teamId) {
    setError(ERROR.leagueTeamTaken);
    return;
  }
  void set(picked.id);
}

function cancelChange() {
  isChanging.value = false;
  clearErrors();
}
</script>

<template>
  <section class="team-league">
    <h2>Équipe de ligue</h2>

    <template v-if="leagueTeam && !isChanging">
      <div class="league-linked">
        <TeamLogo :name="leagueTeam.name" :logo-url="leagueTeam.logoUrl" :size="48" />
        <div class="league-linked-text">
          <strong>{{ leagueTeam.name }}</strong>
          <span>{{ formatMemberCount(leagueTeam.memberCount) }} sur competitive.eva.gg</span>
        </div>
      </div>
      <p class="league-status">
        Les joueurs qui cherchent cette équipe de ligue trouvent l'équipe ici, et peuvent demander à la rejoindre.
      </p>
      <ErrorDisplay :errors="errors" />
      <div v-if="canManage" class="league-actions">
        <button type="button" class="btn btn-secondary" :disabled="isBusy" @click="isChanging = true">Changer</button>
        <button type="button" class="btn btn-danger" :disabled="isBusy" @click="set(null)">Délier</button>
      </div>
    </template>

    <template v-else>
      <p class="league-status">
        <template v-if="isChanging">Cherche l'équipe de ligue qui remplace {{ leagueTeam?.name }}.</template>
        <template v-else-if="canManage">
          Relie l'équipe à son équipe de ligue de competitive.eva.gg : les joueurs qui la cherchent trouveront l'équipe ici.
        </template>
        <template v-else>L'équipe n'est reliée à aucune équipe de ligue.</template>
      </p>
      <LeagueTeamSearch v-if="canManage" :disabled="isBusy" @select="link" />
      <ErrorDisplay :errors="errors" />
      <div v-if="isChanging" class="league-actions">
        <button type="button" class="btn btn-secondary" :disabled="isBusy" @click="cancelChange">Annuler</button>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.team-league {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;

  h2 {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-white;
  }
}

.league-linked {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  min-width: 0;
}

.league-linked-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: $color-text-primary;
    overflow-wrap: anywhere;
  }

  span {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
}

.league-status {
  margin: 0;
  color: $color-text-secondary;
}

.league-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.btn-secondary {
  @include btn-base($color-text-secondary);
}

.btn-danger {
  @include btn-base($color-danger);
}
</style>
