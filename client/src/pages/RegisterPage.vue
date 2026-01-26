<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  validateRegistration,
  isValidEmail,
  isValidPassword,
  isValidName,
} from '@shared/utils';

const router = useRouter();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const name = ref('');
const errors = ref<string[]>([]);
const success = ref(false);
const isLoading = ref(false);

// Use shared validation helpers for computed properties
const isEmailValid = computed(() => isValidEmail(email.value));
const isPasswordValid = computed(() => isValidPassword(password.value));
const doPasswordsMatch = computed(() => password.value === confirmPassword.value);
const isNameValid = computed(() => isValidName(name.value.trim()));

const isFormValid = computed(() => {
  return (
    email.value &&
    isEmailValid.value &&
    password.value &&
    isPasswordValid.value &&
    confirmPassword.value &&
    doPasswordsMatch.value &&
    isNameValid.value
  );
});

async function handleRegister() {
  errors.value = [];

  // Client-side validation using shared validators
  const validation = validateRegistration({
    email: email.value,
    password: password.value,
    confirmPassword: confirmPassword.value,
    name: name.value.trim(),
  });

  if (validation !== true) {
    errors.value = validation;
    return;
  }

  isLoading.value = true;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
        name: name.value.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      errors.value = data.errors || [data.error || 'Erreur lors de l\'inscription'];
      return;
    }

    success.value = true;
    setTimeout(() => {
      router.push({ name: 'login' });
    }, 2000);
  } catch {
    errors.value = ['Erreur lors de l\'inscription'];
  } finally {
    isLoading.value = false;
  }
}

function goToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <h1>Créer un compte</h1>

      <div v-if="success" class="success-message">
        ✅ Compte créé avec succès ! Redirection vers la connexion...
      </div>

      <form v-else @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="name">Pseudo</label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Votre pseudo"
            :disabled="isLoading"
            autocomplete="username"
          />
          <span v-if="name && name.trim().length < 2" class="field-hint error">
            Minimum 2 caractères
          </span>
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            :disabled="isLoading"
            autocomplete="email"
          />
          <span v-if="email && !isEmailValid" class="field-hint error">
            Adresse email invalide
          </span>
        </div>

        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            :disabled="isLoading"
            autocomplete="new-password"
          />
          <span v-if="password && !isPasswordValid" class="field-hint error">
            Minimum 8 caractères
          </span>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirmer le mot de passe</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            :disabled="isLoading"
            autocomplete="new-password"
          />
          <span v-if="confirmPassword && !doPasswordsMatch" class="field-hint error">
            Les mots de passe ne correspondent pas
          </span>
        </div>

        <div v-if="errors.length" class="error-message">
          <p v-for="(err, i) in errors" :key="i">{{ err }}</p>
        </div>

        <button
          type="submit"
          class="btn-submit"
          :disabled="isLoading || !isFormValid"
        >
          {{ isLoading ? 'Création...' : 'Créer mon compte' }}
        </button>

        <div class="login-link">
          Déjà un compte ?
          <button type="button" class="link-btn" @click="goToLogin">
            Se connecter
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.register-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: $spacing-lg;
  background-color: $color-bg-primary;
}

.register-card {
  background-color: $color-bg-secondary;
  border-radius: $radius-md;
  padding: $spacing-xl;
  width: 100%;
  max-width: 400px;
  box-shadow: $color-shadow;

  h1 {
    color: $color-text-primary;
    text-align: center;
    margin-bottom: $spacing-lg;
    font-size: $font-size-xl;
  }
}

.form-group {
  margin-bottom: $spacing-md;

  label {
    display: block;
    color: $color-text-muted;
    margin-bottom: $spacing-xs;
    font-size: $font-size-sm;
  }

  input {
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    background-color: $color-bg-primary;
    color: $color-text-primary;
    font-size: $font-size-base;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: $color-accent;
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

.error-message {
  background-color: rgba($color-danger, 0.1);
  color: $color-danger;
  padding: $spacing-sm;
  border-radius: $radius-sm;
  margin-bottom: $spacing-md;
  font-size: $font-size-sm;
}

.success-message {
  background-color: rgba($color-success, 0.1);
  color: $color-success;
  padding: $spacing-md;
  border-radius: $radius-sm;
  text-align: center;
  font-size: $font-size-base;
}

.btn-submit {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  background-color: $color-accent;
  color: white;
  border: none;
  border-radius: $radius-sm;
  font-size: $font-size-base;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: darken($color-accent, 10%);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.login-link {
  text-align: center;
  margin-top: $spacing-md;
  color: $color-text-muted;
  font-size: $font-size-sm;

  .link-btn {
    background: none;
    border: none;
    color: $color-accent;
    cursor: pointer;
    font-size: inherit;
    text-decoration: underline;

    &:hover {
      color: lighten($color-accent, 10%);
    }
  }
}
</style>
