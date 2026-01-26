<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { createTeam, fetchTeamLocations } from '@/api';

const router = useRouter();
const { hasTeam, refreshUser } = useAuth();

// State
const locations = ref<string[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const error = ref<string | null>(null);

// Form
const teamName = ref('');
const teamLocation = ref<string | null>(null);

// Load locations
onMounted(async () => {
  // Redirect if already has a team
  if (hasTeam.value) {
    router.replace('/team');
    return;
  }

  try {
    locations.value = await fetchTeamLocations();
  } catch (e) {
    console.error('Error loading locations:', e);
  } finally {
    isLoading.value = false;
  }
});

// Submit form
async function handleSubmit() {
  if (!teamName.value.trim() || teamName.value.trim().length < 2) {
    error.value = 'Le nom de l\'équipe doit contenir au moins 2 caractères';
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    await createTeam({
      name: teamName.value.trim(),
      location: teamLocation.value,
    });

    // Refresh user data to update teamId and permissions
    await refreshUser();

    // Redirect to team page
    router.push('/team');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur lors de la création';
  } finally {
    isSubmitting.value = false;
  }
}

// Go back
function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="create-team-page">
    <div class="create-team-card">
      <h1>Créer une équipe</h1>
      <p class="description">
        Vous deviendrez le leader de l'équipe avec toutes les permissions.
      </p>

      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Chargement...</p>
      </div>

      <form v-else @submit.prevent="handleSubmit" class="create-form">
        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="form-group">
          <label for="team-name">Nom de l'équipe *</label>
          <input
            id="team-name"
            v-model="teamName"
            type="text"
            placeholder="Nom de votre équipe"
            :disabled="isSubmitting"
            autofocus
          />
        </div>

        <div class="form-group">
          <label for="team-location">Localisation</label>
          <select id="team-location" v-model="teamLocation" :disabled="isSubmitting">
            <option :value="null">Non spécifiée</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="goBack" :disabled="isSubmitting">
            Annuler
          </button>
          <button type="submit" class="btn-create" :disabled="isSubmitting">
            {{ isSubmitting ? 'Création...' : 'Créer l\'équipe' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.create-team-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  width: 100%;
  padding: $spacing-lg;
  flex: 1;
}

.create-team-card {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  padding: $spacing-xl;
  max-width: 450px;
  width: 100%;

  h1 {
    margin: 0 0 $spacing-xs;
    color: $color-text-primary;
    font-size: $font-size-xl;
    text-align: center;
  }

  .description {
    margin: 0 0 $spacing-lg;
    color: $color-text-secondary;
    text-align: center;
    font-size: $font-size-sm;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg;

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

.create-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.error-message {
  padding: $spacing-sm $spacing-md;
  background: rgba($color-danger, 0.1);
  border: 1px solid $color-danger;
  border-radius: $radius-sm;
  color: $color-danger;
  font-size: $font-size-sm;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  input, select {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    color: $color-text-primary;
    font-size: $font-size-base;

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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.btn-cancel,
.btn-create {
  padding: $spacing-sm $spacing-lg;
  border-radius: $radius-md;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-cancel {
  background: transparent;
  border: 1px solid $color-border;
  color: $color-text-secondary;

  &:hover:not(:disabled) {
    background: $color-bg-tertiary;
  }
}

.btn-create {
  background: $color-accent;
  border: none;
  color: white;

  &:hover:not(:disabled) {
    background: darken($color-accent, 10%);
  }
}
</style>
