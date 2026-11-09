<template>
  <div class="no-team-message">
    <div class="no-team-icon">👥</div>
    <h2>Aucune équipe</h2>

    <JoinRequestCard v-if="request" class="no-team-section" :request="request" @changed="request = $event" />

    <template v-else-if="isLoaded">
      <p>Retrouve ton équipe de ligue, ou rejoins une équipe avec le lien que son capitaine t'a envoyé.</p>

      <section class="no-team-section">
        <h3>Ton équipe de ligue</h3>
        <LeagueTeamFinder @create="createFrom" @requested="request = $event" />
      </section>

      <section class="no-team-section">
        <h3>Un lien d'invitation ?</h3>
        <div class="invite-input-group">
          <input
            v-model="inviteCode"
            type="text"
            aria-label="Lien d'invitation"
            placeholder="Colle le code ou le lien ici"
            @keyup.enter="handleJoin"
          />
          <button
            class="btn-join"
            @click="handleJoin"
            :disabled="!inviteCode.trim()"
          >
            Rejoindre
          </button>
        </div>
        <ErrorDisplay :errors="errors" />
      </section>

      <div class="separator">ou</div>

      <button class="btn-team" @click="router.push('/team/create')">
        <span>Créer une équipe</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
// The screen of a player without a team: find their league team, to join or
// make it; or join a team by the link its captain sent; or make a team of
// their own. A request to join a team, waiting or refused, takes its place.
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { LeagueTeamSummary, MyJoinRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchMyJoinRequest } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { inviteCodeOf } from '@/utils/invites';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import JoinRequestCard from '@/components/team/JoinRequestCard.vue';
import LeagueTeamFinder from '@/components/team/LeagueTeamFinder.vue';

const router = useRouter();

const inviteCode = ref('');
const { errors, setError } = useErrors();
const request = ref<MyJoinRequest | null>(null);
const isLoaded = ref(false);

onMounted(async () => {
  try {
    request.value = await fetchMyJoinRequest();
  } catch {
    // Without its request, the screen offers the ways in: asking again tells where it stands
  } finally {
    isLoaded.value = true;
  }
});

// Make the league team picked: the creation page takes its name and logo
function createFrom(leagueTeam: LeagueTeamSummary) {
  router.push({ path: '/team/create', query: { ligue: leagueTeam.id } });
}

// Join by a link: the join page checks it and does the rest
function handleJoin() {
  if (!inviteCode.value.trim()) return;

  const code = inviteCodeOf(inviteCode.value);
  if (!code) {
    setError(ERROR.inviteCodeInvalid);
    return;
  }

  router.push(`/join/${code}`);
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.no-team-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-xl;
  text-align: center;
  min-height: 300px;
  // Never squeezed by the page around it: what it holds would spill over the rest
  flex-shrink: 0;

  @include mobile-lg {
    padding: $spacing-lg $spacing-md;
  }

  .no-team-icon {
    font-size: 4rem;
  }

  h2 {
    margin: 0;
    color: $color-text-primary;
  }

  > p {
    margin: 0;
    color: $color-text-secondary;
    max-width: 440px;
  }
}

.no-team-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  width: 100%;
  max-width: 440px;
  margin-top: $spacing-sm;
  text-align: left;

  h3 {
    margin: 0;
    font-size: $font-size-base;
    font-weight: 600;
    color: $color-text-primary;
  }
}

.invite-input-group {
  display: flex;
  gap: $spacing-sm;

  input {
    flex: 1;
    min-width: 0;
    padding: $spacing-sm $spacing-md;
    border: $border-thin solid $color-border;
    border-radius: $radius-md;
    background: $color-bg-tertiary;
    color: $color-text-primary;
    font-size: $font-size-sm;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }

    &::placeholder {
      color: $color-text-secondary;
    }
  }

  .btn-join {
    padding: $spacing-sm $spacing-md;
    background: $color-success;
    border: none;
    border-radius: $radius-md;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: shade($color-success, 17%);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.separator {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  position: relative;
  width: 100%;
  max-width: 200px;
  text-align: center;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: $color-border;
  }

  &::before {
    left: 0;
  }

  &::after {
    right: 0;
  }
}

.btn-team {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-lg;
  background-color: $color-accent;
  color: $color-text-primary;
  border: none;
  border-radius: $radius-md;
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: with-alpha($color-accent, 0.8);
  }
}
</style>
