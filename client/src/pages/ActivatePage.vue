<script setup lang="ts">
// An invitation to a role (venue manager, admin): what it gives, then
// accepting it by signing in with Discord, on one's own account
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { InvitationSummary } from '@shared/types';
import { ERROR } from '@shared/constants';
import { discordSignInUrl, fetchInvitation } from '@/api/auth.api';
import AuthCard from '@/components/auth/layout/AuthCard.vue';
import DiscordSignInButton from '@/components/auth/DiscordSignInButton.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const route = useRoute();
const token = computed(() => route.params.token as string);

const invitation = ref<InvitationSummary | null>(null);
const isLoading = ref(true);
const loadError = ref<string | null>(null);

// Why accepting stopped, as the server tells it in the address
const ACCEPT_PROBLEMS: Record<string, string> = {
  'invitation-invalid': ERROR.invitationInvalid,
  'invitation-expired': ERROR.invitationExpired,
  'role-taken': ERROR.invitationRoleTaken,
};

const errors = computed(() => {
  if (loadError.value) return [loadError.value];
  const problem = typeof route.query.error === 'string' ? ACCEPT_PROBLEMS[route.query.error] : undefined;
  if (problem) return [problem];
  if (!isLoading.value && !invitation.value) return [ERROR.invitationInvalid];
  if (invitation.value?.isExpired) return [ERROR.invitationExpired];
  return [];
});

const canAccept = computed(() => !!invitation.value && !invitation.value.isExpired && !loadError.value);

// What the invitation gives, in a sentence
const gives = computed(() => {
  if (!invitation.value) return '';
  if (invitation.value.role === 'admin') return 'administrer l\'application';
  const venues = invitation.value.venueNames;
  return venues.length ? `gérer ${venues.join(', ')}` : 'gérer des salles';
});

const signInUrl = computed(() => discordSignInUrl({ invitation: token.value }));

onMounted(async () => {
  try {
    invitation.value = await fetchInvitation(token.value);
  } catch {
    loadError.value = ERROR.invitationFetchFailed;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <AuthCard title="Invitation">
    <p v-if="isLoading" class="lead">Chargement…</p>

    <template v-else-if="invitation">
      <p class="lead">
        <template v-if="invitation.invitedName">Pour <strong>{{ invitation.invitedName }}</strong> : </template>
        tu es invité à <strong>{{ gives }}</strong>.
      </p>
      <p class="hint">
        Connecte-toi avec Discord pour accepter : le rôle s'ajoute à ton compte, créé au passage si tu n'en as pas.
        Le lien ne sert qu'une fois.
      </p>
    </template>

    <ErrorDisplay :errors="errors" />

    <DiscordSignInButton v-if="canAccept" :href="signInUrl" label="Accepter avec Discord" />

    <router-link class="back" to="/login">Retour à la connexion</router-link>
  </AuthCard>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.lead {
  margin: 0;
  text-align: center;
  color: $color-text-primary;
  line-height: 1.5;
}

.hint {
  margin: 0;
  text-align: center;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.5;
}

.back {
  text-align: center;
  color: $color-accent;
  font-size: $font-size-sm;

  &:hover {
    text-decoration: underline;
  }
}
</style>
