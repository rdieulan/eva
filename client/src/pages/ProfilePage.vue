<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import { clearPlayersCache } from '@/api';
import { validatePassword, validatePasswordsMatch } from '@shared/utils';
import { ERROR } from '@shared/constants';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import SvgIcon from '@/components/common/SvgIcon.vue';

const router = useRouter();
const { account, token, clearAuth } = useAuth();

// Password change
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const { errors: passwordErrors, setError: setPasswordError, setErrors: setPasswordErrors, clearErrors: clearPasswordErrors } = useErrors();
const passwordSuccess = ref('');
const isChangingPassword = ref(false);

// Change password
async function handleChangePassword() {
  clearPasswordErrors();
  passwordSuccess.value = '';

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    setPasswordError(ERROR.requiredFieldsMissing);
    return;
  }

  // Use shared validators
  const passwordValid = validatePassword(newPassword.value);
  if (passwordValid !== true) {
    setPasswordErrors(passwordValid);
    return;
  }

  const matchValid = validatePasswordsMatch(newPassword.value, confirmPassword.value);
  if (matchValid !== true) {
    setPasswordErrors(matchValid);
    return;
  }

  isChangingPassword.value = true;

  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setPasswordErrors(data.errors || [ERROR.passwordChangeFailed]);
      return;
    }

    passwordSuccess.value = 'Mot de passe modifié avec succès';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch {
    setPasswordError(ERROR.passwordChangeFailed);
  } finally {
    isChangingPassword.value = false;
  }
}

// Logout
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });
  } catch {
    // Ignore server-side logout errors
  } finally {
    clearPlayersCache();
    clearAuth();
    router.push('/login');
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-container">
      <h1>Mon Profil</h1>

      <!-- Account information -->
      <section class="profile-section" v-if="account">
        <h2>Informations</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>Nom</label>
            <span>{{ account.name }}</span>
          </div>
          <div class="info-item">
            <label>Email</label>
            <span>{{ account.email }}</span>
          </div>
          <div class="info-item">
            <label>Statut</label>
            <span class="role-badge" :class="account.isLeader ? 'leader' : 'player'">
              {{ account.isLeader ? 'Leader' : 'Joueur' }}
            </span>
          </div>
        </div>
      </section>

      <!-- Password change -->
      <section class="profile-section">
        <h2>Changer le mot de passe</h2>
        <form @submit.prevent="handleChangePassword" class="password-form">
          <div class="form-group">
            <label for="currentPassword">Mot de passe actuel</label>
            <input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              placeholder="••••••••"
              :disabled="isChangingPassword"
            />
          </div>

          <div class="form-group">
            <label for="newPassword">Nouveau mot de passe</label>
            <input
              id="newPassword"
              v-model="newPassword"
              type="password"
              placeholder="••••••••"
              :disabled="isChangingPassword"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le nouveau mot de passe</label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              :disabled="isChangingPassword"
            />
          </div>

          <ErrorDisplay :errors="passwordErrors" />

          <div v-if="passwordSuccess" class="message success">
            {{ passwordSuccess }}
          </div>

          <button type="submit" class="btn-primary" :disabled="isChangingPassword">
            {{ isChangingPassword ? 'Modification...' : 'Modifier le mot de passe' }}
          </button>
        </form>
      </section>

      <!-- Logout -->
      <section class="profile-section">
        <h2>Session</h2>
        <button class="btn-logout" @click="handleLogout">
          <SvgIcon name="logout" class="logout-icon" />
          Se déconnecter
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.profile-page {
  // ...existing code...
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: $spacing-xl;
  background: linear-gradient(135deg, $color-bg-secondary 0%, $color-bg-tertiary 100%);
  overflow-y: auto;

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
  }

  @include mobile {
    padding: 0.75rem;
  }
}

.profile-container {
  width: 100%;
  max-width: 600px;
}

h1 {
  color: $color-white;
  margin: 0 0 $spacing-xl;
  font-size: 2rem;
  text-align: center;

  @include tablet {
    font-size: 1.75rem;
  }

  @include mobile-lg {
    font-size: 1.5rem;
    margin-bottom: $spacing-lg;
  }

  @include mobile {
    font-size: 1.35rem;
    margin-bottom: 1.25rem;
  }
}

.profile-section {
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-lg;

  @include mobile-lg {
    padding: 1.25rem;
    margin-bottom: $spacing-md;
    border-radius: 10px;
  }

  @include mobile {
    padding: $spacing-md;
    margin-bottom: 0.75rem;
  }

  h2 {
    color: $color-accent;
    margin: 0 0 $spacing-md;
    font-size: 1.1rem;
    font-weight: 600;

    @include mobile-lg {
      font-size: 1rem;
    }

    @include mobile {
      font-size: 0.95rem;
      margin-bottom: 0.75rem;
    }
  }
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;

  @include mobile-lg {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
  }

  label {
    color: $color-text-secondary;
    font-size: 0.9rem;

    @include mobile {
      font-size: 0.85rem;
    }
  }

  span {
    color: $color-white;
    font-weight: 500;
  }
}

.role-badge {
  padding: $spacing-xs 0.75rem;
  border-radius: $radius-sm;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;

  &.leader {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }

  &.player {
    background: rgba($color-accent, 0.2);
    color: $color-accent;
  }
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  label {
    color: $color-text-secondary;
    font-size: 0.9rem;

    @include mobile {
      font-size: 0.85rem;
    }
  }

  input {
    padding: 0.75rem $spacing-md;
    background: $color-bg-secondary;
    border: 2px solid $color-border-light;
    border-radius: $radius-md;
    color: $color-white;
    font-size: 1rem;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }

    &::placeholder {
      color: $color-text-secondary;
    }

    @include mobile-lg {
      font-size: 16px; // Prevents zoom on iOS
    }
  }
}

.message {
  padding: 0.75rem;
  border-radius: $radius-md;
  font-size: 0.9rem;
  text-align: center;


  &.success {
    background: rgba($color-success, 0.1);
    border: 1px solid rgba($color-success, 0.3);
    color: $color-success;
  }

  @include mobile {
    font-size: 0.85rem;
    padding: 0.625rem;
  }
}

.btn-primary {
  @include btn-base($color-accent);

  @include mobile {
    padding: 0.75rem;
    font-size: 0.95rem;
  }
}

.btn-logout {
  @include btn-base($color-danger);
  width: 100%;

  @include mobile {
    padding: 0.75rem;
    font-size: 0.95rem;
  }
}

.logout-icon {
  font-size: 1.1em;
}
</style>
