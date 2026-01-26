<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { clearPlayersCache, clearBalanceRulesCache } from '@/api';

const router = useRouter();
const route = useRoute();
const { setAuth } = useAuth();

const email = ref('');
const password = ref('');
const errors = ref<string[]>([]);
const isLoading = ref(false);

async function handleLogin() {
  if (!email.value || !password.value) {
    errors.value = ['Veuillez remplir tous les champs'];
    return;
  }

  isLoading.value = true;
  errors.value = [];

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Backend returns { errors: [...] }
      errors.value = data.errors || [data.error || 'Erreur de connexion'];
      return;
    }

    // Clear cached data from previous user session
    clearPlayersCache();
    clearBalanceRulesCache();

    // Utiliser le composable pour définir l'auth
    setAuth(data.token, data.user);

    // Rediriger vers la page d'origine ou la homepage
    const redirectPath = route.query.redirect as string || '/';
    router.push(redirectPath);
  } catch {
    errors.value = ['Erreur de connexion'];
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>Connexion</h1>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            :disabled="isLoading"
          />
        </div>

        <div v-if="errors.length" class="error-message">
          <p v-for="(err, i) in errors" :key="i">{{ err }}</p>
        </div>

        <button type="submit" class="btn-submit" :disabled="isLoading">
          {{ isLoading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <div class="register-link">
        <span>Pas encore de compte ?</span>
        <router-link to="/register">Créer un compte</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.login-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $color-bg-secondary 0%, $color-bg-tertiary 100%);
  padding: $spacing-xl;

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
    align-items: flex-start;
    padding-top: $spacing-2xl;
  }

  @include mobile {
    padding: 0.75rem;
    padding-top: $spacing-xl;
  }
}

.login-card {
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-xl;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;

  @include tablet {
    padding: $spacing-xl;
  }

  @include mobile-lg {
    padding: $spacing-lg;
    border-radius: $radius-lg;
  }

  @include mobile {
    padding: 1.25rem;
    border-radius: 10px;
  }
}

h1 {
  color: $color-white;
  text-align: center;
  margin: 0 0 $spacing-xl;
  font-size: 1.8rem;

  @include mobile-lg {
    font-size: 1.5rem;
    margin-bottom: $spacing-lg;
  }

  @include mobile {
    font-size: 1.35rem;
    margin-bottom: 1.25rem;
  }
}

.form-group {
  margin-bottom: $spacing-lg;

  @include mobile-lg {
    margin-bottom: 1.25rem;
  }
}

label {
  display: block;
  color: $color-text-secondary;
  margin-bottom: $spacing-sm;
  font-size: 0.9rem;

  @include mobile {
    font-size: 0.85rem;
  }
}

input {
  width: 100%;
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
    padding: 0.875rem $spacing-md;
    font-size: 16px; // Prevents zoom on iOS
  }
}

.error-message {
  background: rgba($color-danger, 0.1);
  border: 1px solid rgba($color-danger, 0.3);
  color: $color-danger;
  padding: 0.75rem;
  border-radius: $radius-md;
  margin-bottom: $spacing-lg;
  font-size: 0.9rem;
  text-align: center;

  @include mobile {
    font-size: 0.85rem;
    padding: 0.625rem;
  }
}

.btn-submit {
  width: 100%;
  padding: 0.875rem;
  background: $color-accent;
  border: none;
  border-radius: $radius-md;
  color: $color-white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: $color-accent;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @include mobile {
    padding: 0.75rem;
    font-size: 0.95rem;
  }
}

.register-link {
  text-align: center;
  margin-top: $spacing-md;
  color: $color-text-muted;
  font-size: $font-size-sm;

  a {
    color: $color-accent;
    text-decoration: underline;

    &:hover {
      color: lighten($color-accent, 10%);
    }
  }
}
</style>
