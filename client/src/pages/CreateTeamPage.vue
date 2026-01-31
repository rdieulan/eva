<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import { createTeam, fetchTeamLocations } from '@/api';
import { validateTeamName } from '@shared/utils';
import { ERROR } from '@shared/constants';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const router = useRouter();
const { hasTeam, refreshAccount } = useAuth();

// State
const locations = ref<string[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const { errors, setErrors, setErrorFromException, clearErrors } = useErrors();

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
  const validation = validateTeamName(teamName.value);
  if (validation !== true) {
    setErrors(validation);
    return;
  }

  isSubmitting.value = true;
  clearErrors();

  try {
    await createTeam({
      name: teamName.value.trim(),
      location: teamLocation.value,
    });

    // Refresh account data to update teamId and permissions
    await refreshAccount();

    // Redirect to team page
    router.push('/team');
  } catch (e) {
    setErrorFromException(e, ERROR.teamCreationFailed);
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
        <ErrorDisplay :errors="errors" />

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
@use '@/styles/buttons' as *;
@use 'sass:color';

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
  @include btn-base($color-accent);
}

.btn-cancel {
  @include btn-base($color-danger);
}

.btn-create {
  @include btn-base($color-success);
}
</style>
