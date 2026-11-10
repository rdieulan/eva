<script setup lang="ts">
// The development login: act as any account of the local database without
// Discord, to check the app with the demo teams. The login page loads it in
// development only; the server offers it only when asked (DEV_LOGIN=true),
// never in production.

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { AccountType, DevLoginAccount } from '@shared/types';
import { ERROR } from '@shared/constants';
import { devLogin, fetchDevLoginAccounts } from '@/api/auth.api';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import { landingPathForAccount } from '@/utils/landing';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const props = defineProps<{
  redirect: string | null; // The page to land on, as the login page was asked
}>();

const router = useRouter();
const { setAuth } = useAuth();
const { errors, setErrorFromException } = useErrors();

const accounts = ref<DevLoginAccount[]>([]);
const isUnavailable = ref(false);
const pendingId = ref<string | null>(null);

const ROLE_LABELS: Partial<Record<AccountType, string>> = { manager: 'Gérant', admin: 'Admin' };

// The accounts team by team, those without a team last (the server sorts them)
const groups = computed(() => {
  const byTeam = new Map<string, DevLoginAccount[]>();
  for (const account of accounts.value) {
    const team = account.teamName ?? 'Sans équipe';
    byTeam.set(team, [...(byTeam.get(team) ?? []), account]);
  }
  return [...byTeam.entries()].map(([team, members]) => ({ team, members }));
});

onMounted(async () => {
  try {
    accounts.value = await fetchDevLoginAccounts();
  } catch {
    // The server does not offer it (DEV_LOGIN not set): nothing to show
    isUnavailable.value = true;
  }
});

async function actAs(account: DevLoginAccount) {
  pendingId.value = account.id;
  try {
    const signedIn = await devLogin(account.id);
    setAuth(signedIn);
    router.push(props.redirect || landingPathForAccount(signedIn));
  } catch (error) {
    setErrorFromException(error, ERROR.devLoginFailed);
  } finally {
    pendingId.value = null;
  }
}
</script>

<template>
  <section v-if="!isUnavailable" class="dev-login">
    <h2>Développement · se connecter en tant que</h2>
    <ErrorDisplay :errors="errors" />
    <div v-for="group in groups" :key="group.team" class="dev-group">
      <h3>{{ group.team }}</h3>
      <div class="dev-accounts">
        <button
          v-for="account in group.members"
          :key="account.id"
          type="button"
          class="dev-account"
          :disabled="pendingId !== null"
          @click="actAs(account)"
        >
          <span class="dev-name">{{ account.name }}</span>
          <span
            v-for="role in account.roles.filter(held => ROLE_LABELS[held])"
            :key="role"
            class="dev-role"
          >{{ ROLE_LABELS[role] }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.dev-login {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding-top: $spacing-md;
  border-top: $border-thin dashed $color-border-light;

  h2 {
    margin: 0;
    font-size: $font-size-sm;
    font-weight: 600;
    color: $color-accent;
  }
}

.dev-group h3 {
  margin: $spacing-xs 0;
  font-size: $font-size-xs;
  font-weight: 600;
  color: $color-text-secondary;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dev-accounts {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.dev-account {
  display: inline-flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-sm;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-primary;
  font-size: $font-size-sm;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: $color-accent;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.dev-role {
  padding: 0 $spacing-xs;
  border-radius: $radius-sm;
  background: with-alpha($color-accent, 0.15);
  color: $color-accent;
  font-size: $font-size-xs;
  font-weight: 600;
}
</style>
