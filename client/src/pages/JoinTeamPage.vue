<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { verifyInviteCode, joinTeamWithCode } from '@/api';
import type { InviteValidation } from '@/api';
import { useAuth } from '@/composables/useAuth';
import { ERROR_MESSAGES } from '@shared/constants';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const route = useRoute();
const router = useRouter();
const { user, token, refreshUser } = useAuth();

// State
const isLoading = ref(true);
const isJoining = ref(false);
const validation = ref<InviteValidation | null>(null);
const errors = ref<string[]>([]);
const success = ref(false);

// Computed
const inviteCode = computed(() => route.params.code as string);
const isValid = computed(() => validation.value?.valid === true);
const isLoggedIn = computed(() => !!token.value);

// Load invitation validation
onMounted(async () => {
  if (!inviteCode.value) {
    errors.value = [ERROR_MESSAGES.inviteCodeMissing];
    isLoading.value = false;
    return;
  }

  try {
    validation.value = await verifyInviteCode(inviteCode.value);
  } catch (e) {
    errors.value = [e instanceof Error ? e.message : ERROR_MESSAGES.inviteValidationFailed];
  } finally {
    isLoading.value = false;
  }
});

// Join team
async function handleJoin() {
  if (!inviteCode.value || !isLoggedIn.value) return;

  isJoining.value = true;
  errors.value = [];

  try {
    await joinTeamWithCode(inviteCode.value);

    // Refresh user data to update teamId
    await refreshUser();

    success.value = true;

    // Redirect to team page after 2 seconds
    setTimeout(() => {
      router.push('/team');
    }, 2000);
  } catch (e) {
    errors.value = [e instanceof Error ? e.message : ERROR_MESSAGES.joinTeamFailed];
  } finally {
    isJoining.value = false;
  }
}

// Redirect to login with return URL
function goToLogin() {
  router.push({
    path: '/login',
    query: { redirect: route.fullPath },
  });
}
</script>

<template>
  <div class="join-team-page">
    <div class="join-card">
      <!-- Loading -->
      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Vérification de l'invitation...</p>
      </div>

      <!-- Success -->
      <div v-else-if="success" class="success-state">
        <div class="success-icon">✅</div>
        <h1>Bienvenue !</h1>
        <p>Vous avez rejoint l'équipe <strong>{{ validation?.teamName }}</strong></p>
        <p class="redirect-notice">Redirection vers la page d'équipe...</p>
      </div>

      <!-- Invalid invitation -->
      <div v-else-if="!isValid" class="invalid-state">
        <div class="error-icon">❌</div>
        <h1>Invitation invalide</h1>
        <ErrorDisplay
          :errors="validation?.reason ? [validation.reason] : errors"
          :fallback="ERROR_MESSAGES.inviteInvalid"
        />
        <button class="btn-home" @click="router.push('/')">
          Retour à l'accueil
        </button>
      </div>

      <!-- Valid invitation -->
      <div v-else class="valid-state">
        <div class="team-icon">👥</div>
        <h1>Rejoindre une équipe</h1>
        <p class="team-name">{{ validation?.teamName }}</p>

        <!-- Not logged in -->
        <div v-if="!isLoggedIn" class="login-required">
          <p>Vous devez être connecté pour rejoindre cette équipe.</p>
          <button class="btn-login" @click="goToLogin">
            Se connecter
          </button>
        </div>

        <!-- Logged in -->
        <div v-else class="join-section">
          <p>Vous êtes connecté en tant que <strong>{{ user?.name }}</strong></p>

          <ErrorDisplay :errors="errors" />

          <button
            class="btn-join"
            @click="handleJoin"
            :disabled="isJoining"
          >
            {{ isJoining ? 'Rejoindre...' : 'Rejoindre l\'équipe' }}
          </button>
        </div>

        <p class="expiration-notice">
          Cette invitation expire dans {{ formatExpiration(validation?.expiresAt || '') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// Format expiration helper
function formatExpiration(dateStr: string): string {
  if (!dateStr) return 'N/A';

  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Expiré';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} jour(s)`;
  }

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} minutes`;
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use 'sass:color';

.join-team-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  width: 100%;
  padding: $spacing-lg;
  flex: 1;
}

.join-card {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $spacing-xl;
  max-width: 450px;
  width: 100%;
  text-align: center;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid $color-border;
    border-top-color: $color-accent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-icon,
.error-icon,
.team-icon {
  font-size: 48px;
  margin-bottom: $spacing-md;
}

h1 {
  margin-bottom: $spacing-md;
  color: $color-text-primary;
}

.team-name {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $color-accent;
  margin-bottom: $spacing-lg;
}

.login-required,
.join-section {
  padding: $spacing-lg;
  background: $color-bg-tertiary;
  border-radius: $radius-md;
  margin-bottom: $spacing-md;

  p {
    margin-bottom: $spacing-md;
  }
}

.btn-login,
.btn-join,
.btn-home {
  padding: $spacing-sm $spacing-lg;
  border: none;
  border-radius: $radius-md;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-login {
  background: $color-accent;
  color: white;

  &:hover:not(:disabled) {
    background: color.scale($color-accent, $lightness: -17%);
  }
}

.btn-join {
  background: $color-success;
  color: white;
  width: 100%;

  &:hover:not(:disabled) {
    background: color.scale($color-success, $lightness: -17%);
  }
}

.btn-home {
  background: $color-bg-tertiary;
  color: $color-text-primary;
  border: 1px solid $color-border;

  &:hover {
    background: $color-bg-secondary;
  }
}

.expiration-notice {
  font-size: $font-size-sm;
  color: $color-text-secondary;
  margin-top: $spacing-md;
}

.redirect-notice {
  color: $color-text-secondary;
  font-style: italic;
}

.invalid-state,
.success-state {
  p {
    margin-bottom: $spacing-md;
    color: $color-text-secondary;
  }
}
</style>
