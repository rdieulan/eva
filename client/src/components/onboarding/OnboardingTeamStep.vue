<script setup lang="ts">
// Walk-through, the team: find one's league team, to join it when it is already
// here or make it when it is not; or join a team with the link its captain
// sent; or make one's own, or later. The walk-through ends on the page it leads to.
import { ref } from 'vue';
import type { LeagueTeamSummary } from '@shared/types';
import { ERROR } from '@shared/constants';
import { inviteCodeOf } from '@/utils/invites';
import { useErrors } from '@/composables/useErrors';
import OnboardingStepLayout from '@/components/onboarding/layout/OnboardingStepLayout.vue';
import LeagueTeamFinder from '@/components/team/LeagueTeamFinder.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

defineProps<{
  isFinishing: boolean;
}>();

const emit = defineEmits<{ finish: [destination: string] }>();

const { errors, setError, clearErrors } = useErrors();
const invite = ref('');
const showInvite = ref(false);

// Made from the league team picked: the creation page takes its name and logo
function createFrom(leagueTeam: LeagueTeamSummary) {
  emit('finish', `/team/create?ligue=${encodeURIComponent(leagueTeam.id)}`);
}

function join() {
  clearErrors();
  const code = inviteCodeOf(invite.value);
  if (!code) {
    setError(ERROR.inviteCodeInvalid);
    return;
  }
  emit('finish', `/join/${code}`);
}
</script>

<template>
  <OnboardingStepLayout
    title="Ton équipe"
    lead="Cherche ton équipe de ligue : rejoins-la si elle est déjà là, crée-la sinon."
  >
    <!-- A request sent waits on the home screen, where its answer shows -->
    <LeagueTeamFinder class="finder" :disabled="isFinishing" @create="createFrom" @requested="emit('finish', '/')" />

    <form v-if="showInvite" class="invite" @submit.prevent="join">
      <input
        v-model="invite"
        class="field"
        type="text"
        aria-label="Lien d'invitation"
        placeholder="Colle ici ton lien d'invitation"
        autocomplete="off"
        :disabled="isFinishing"
      />
      <ErrorDisplay :errors="errors" />
      <button type="submit" class="primary" :disabled="isFinishing || !invite.trim()">
        Rejoindre l'équipe
      </button>
    </form>
    <button v-else type="button" class="reveal" :disabled="isFinishing" @click="showInvite = true">
      Tu as un lien d'invitation ?
    </button>

    <template #actions>
      <div class="separator"><span>ou</span></div>
      <button type="button" class="create" :disabled="isFinishing" @click="emit('finish', '/team/create')">
        Créer une équipe hors ligue
      </button>
      <button type="button" class="skip" :disabled="isFinishing" @click="emit('finish', '/')">
        Plus tard
      </button>
    </template>
  </OnboardingStepLayout>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/onboarding' as *;

// The search of the walk-through has its large field
.finder :deep(.league-search-field) {
  @include onboarding-input;
}

.invite {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.field {
  @include onboarding-input;
}

.primary {
  @include onboarding-primary;
}

.reveal {
  @include onboarding-skip;
  align-self: flex-start;
  padding-left: 0;
}

.create {
  @include onboarding-primary;
  background: transparent;
  border: $border-thick solid $color-accent;
  color: $color-text-primary;

  &:hover:not(:disabled) {
    background: with-alpha($color-accent, 0.12);
  }
}

.separator {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  color: $color-text-muted;
  font-size: $font-size-sm;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: $color-border-light;
  }
}

.skip {
  @include onboarding-skip;
}
</style>
