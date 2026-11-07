<script setup lang="ts">
import { onMounted } from 'vue';
import { useEvaAccount } from '@/composables/useEvaAccount';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const {
  link,
  username,
  linkedOn,
  isLoading,
  isLinking,
  isUnlinking,
  isBusy,
  successMessage,
  errors,
  load,
  linkAccount,
  unlinkAccount,
} = useEvaAccount();

onMounted(load);
</script>

<template>
  <section class="profile-section eva-account-section">
    <h2>Compte eva.gg</h2>

    <div v-if="isLoading" class="loading-state">Chargement...</div>

    <div v-else class="section-body">
      <!-- Linked: show the account and let the player drop the link -->
      <div v-if="link" class="linked-account">
        <div class="linked-account-row">
          <div class="linked-account-info">
            <span class="linked-tag">{{ link.username }}</span>
            <span class="linked-since">Lié le {{ linkedOn }}</span>
          </div>
          <button type="button" class="btn-unlink" :disabled="isBusy" @click="unlinkAccount">
            {{ isUnlinking ? 'Suppression...' : 'Délier' }}
          </button>
        </div>
        <p class="form-hint">
          Ce lien suit ton compte eva.gg même si tu changes de pseudo là-bas.
        </p>
      </div>

      <!-- Not linked: ask for the tag -->
      <form v-else class="profile-form" @submit.prevent="linkAccount">
        <div class="form-group">
          <label for="evaUsername">Tag eva.gg</label>
          <input
            id="evaUsername"
            v-model="username"
            type="text"
            placeholder="Pseudo#123456"
            autocomplete="off"
            :disabled="isBusy"
          />
          <p class="form-hint">
            Ton tag complet, avec le suffixe, tel qu'il apparaît sous ton pseudo sur ta page compte eva.gg.
            Seules les informations publiques de ton profil eva.gg sont lues.
          </p>
        </div>

        <button type="submit" class="btn-primary" :disabled="isBusy">
          {{ isLinking ? 'Liaison...' : 'Lier mon compte eva.gg' }}
        </button>
      </form>

      <ErrorDisplay :errors="errors" />

      <div v-if="successMessage" class="message success">
        {{ successMessage }}
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.loading-state {
  color: $color-text-secondary;
  text-align: center;
  padding: $spacing-md;
}

.section-body,
.linked-account {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.linked-account-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-accent;
  border-radius: $radius-md;

  @include mobile-lg {
    flex-direction: column;
    align-items: stretch;
  }
}

.linked-account-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.linked-tag {
  color: $color-white;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.linked-since {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.btn-unlink {
  @include btn-base($color-danger);
  flex-shrink: 0;
}

.profile-form {
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
  }

  input {
    padding: 0.75rem $spacing-md;
    background: $color-bg-secondary;
    border: $border-thick solid $color-border-light;
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

.form-hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.85rem;
  line-height: 1.5;
}

.message {
  padding: 0.75rem;
  border-radius: $radius-md;
  font-size: 0.9rem;
  text-align: center;

  &.success {
    background: with-alpha($color-success, 0.1);
    border: $border-thin solid with-alpha($color-success, 0.3);
    color: $color-success;
  }
}

.btn-primary {
  @include btn-base($color-accent);
}
</style>
