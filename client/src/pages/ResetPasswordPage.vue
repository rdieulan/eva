<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useErrors } from '@/composables/useErrors';
import { resetPasswordWithToken } from '@/api/auth.api';
import { isValidPassword } from '@shared/utils';
import { ERROR } from '@shared/constants';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const router = useRouter();
const route = useRoute();
const { errors, setError, setErrors, clearErrors } = useErrors();

const password = ref('');
const confirmPassword = ref('');
const success = ref(false);
const isLoading = ref(false);
const token = ref('');

const isPasswordValid = computed(() => isValidPassword(password.value));
const doPasswordsMatch = computed(() => password.value === confirmPassword.value);
const isFormValid = computed(() => {
  return password.value && isPasswordValid.value && confirmPassword.value && doPasswordsMatch.value;
});

onMounted(() => {
  token.value = route.params.token as string;
  if (!token.value) {
    setError(ERROR.passwordResetTokenRequired);
  }
});

async function handleReset() {
  clearErrors();

  if (!token.value) {
    setError(ERROR.passwordResetTokenRequired);
    return;
  }

  if (!password.value || !confirmPassword.value) {
    setError(ERROR.requiredFieldsMissing);
    return;
  }

  if (!isPasswordValid.value) {
    setError(ERROR.passwordTooShort);
    return;
  }

  if (!doPasswordsMatch.value) {
    setError(ERROR.passwordsMismatch);
    return;
  }

  isLoading.value = true;

  try {
    await resetPasswordWithToken(token.value, password.value);
    success.value = true;
    setTimeout(() => {
      router.push({ name: 'login' });
    }, 2000);
  } catch (err) {
    if (err && typeof err === 'object' && 'errors' in err) {
      setErrors((err as { errors: string[] }).errors);
    } else {
      setError(ERROR.passwordResetFailed);
    }
  } finally {
    isLoading.value = false;
  }
}

function goToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="reset-page">
    <div class="reset-card">
      <h1>Réinitialiser le mot de passe</h1>

      <div v-if="success" class="success-message">
        ✅ Mot de passe mis à jour ! Redirection vers la connexion...
      </div>

      <form v-else @submit.prevent="handleReset">
        <p class="info-text">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>

        <div class="form-group">
          <label for="password">Nouveau mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            :disabled="isLoading || !token"
            :class="{ valid: password && isPasswordValid, invalid: password && !isPasswordValid }"
          />
          <span v-if="password && !isPasswordValid" class="field-hint error">
            Au moins 8 caractères, 1 chiffre, 1 majuscule
          </span>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirmer le mot de passe</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            :disabled="isLoading || !token"
            :class="{ valid: confirmPassword && doPasswordsMatch, invalid: confirmPassword && !doPasswordsMatch }"
          />
          <span v-if="confirmPassword && !doPasswordsMatch" class="field-hint error">
            Les mots de passe ne correspondent pas
          </span>
        </div>

        <ErrorDisplay v-if="errors.length" :errors="errors" />

        <button type="submit" class="btn-submit" :disabled="!isFormValid || isLoading || !token">
          {{ isLoading ? 'Enregistrement...' : 'Définir le nouveau mot de passe' }}
        </button>
      </form>

      <div class="footer-links">
        <button type="button" class="btn-link" @click="goToLogin">
          Retour à la connexion
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables' as *;
@use 'sass:color';

.reset-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: $spacing-md;
  background: $color-bg-secondary;
}

.reset-card {
  background: $color-bg-tertiary;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $spacing-xl;
  width: 100%;
  max-width: 400px;

  h1 {
    text-align: center;
    margin-bottom: $spacing-lg;
    color: $color-text-primary;
  }
}

.info-text {
  text-align: center;
  color: $color-text-secondary;
  margin-bottom: $spacing-lg;
}

.form-group {
  margin-bottom: $spacing-md;

  label {
    display: block;
    margin-bottom: $spacing-xs;
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }

  input {
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    background: $color-bg-primary;
    color: $color-text-primary;
    font-size: $font-size-base;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }

    &.valid {
      border-color: $color-success;
    }

    &.invalid {
      border-color: $color-danger;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.field-hint {
  display: block;
  font-size: $font-size-xs;
  margin-top: $spacing-xs;

  &.error {
    color: $color-danger;
  }
}

.btn-submit {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  background: $color-accent;
  color: $color-white;
  border: none;
  border-radius: $radius-md;
  font-size: $font-size-base;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background: color.adjust($color-accent, $lightness: -10%);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.success-message {
  text-align: center;
  padding: $spacing-lg;
  background: rgba($color-success, 0.1);
  border: 1px solid $color-success;
  border-radius: $radius-md;
  color: $color-success;
}

.footer-links {
  margin-top: $spacing-lg;
  text-align: center;
}

.btn-link {
  background: none;
  border: none;
  color: $color-accent;
  cursor: pointer;
  font-size: $font-size-sm;

  &:hover {
    text-decoration: underline;
  }
}
</style>
