<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { ERROR } from '@shared/constants';
import { discordSignInUrl } from '@/api/auth.api';
import AuthCard from '@/components/auth/layout/AuthCard.vue';
import DiscordSignInButton from '@/components/auth/DiscordSignInButton.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

// The development login exists in development builds only: a production build drops it
const DevLoginPicker = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/auth/DevLoginPicker.vue'))
  : null;

const route = useRoute();

// Why the last sign-in stopped, as the server tells it in the address
const SIGN_IN_PROBLEMS: Record<string, string> = {
  cancelled: ERROR.discordLoginCancelled,
  expired: ERROR.discordLoginExpired,
  failed: ERROR.discordLoginFailed,
  unavailable: ERROR.discordLoginUnavailable,
};

// The page to land on: the one the visitor was sent here from, if any
const redirect = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : null));

const errors = computed(() => {
  const problem = typeof route.query.error === 'string' ? SIGN_IN_PROBLEMS[route.query.error] : undefined;
  return problem ? [problem] : [];
});

const signInUrl = computed(() => discordSignInUrl({ next: redirect.value ?? undefined }));
</script>

<template>
  <AuthCard title="Connexion">
    <p class="lead">
      Ton compte Discord suffit. On n'en garde que son numéro et ton pseudo : ni email, ni mot de passe.
    </p>

    <ErrorDisplay :errors="errors" />

    <DiscordSignInButton :href="signInUrl" />

    <component :is="DevLoginPicker" v-if="DevLoginPicker" :redirect="redirect" />
  </AuthCard>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.lead {
  margin: 0;
  text-align: center;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.5;
}
</style>
