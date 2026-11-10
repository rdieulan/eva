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
  isChanging,
  isBusy,
  successMessage,
  errors,
  load,
  linkAccount,
  startChange,
  cancelChange,
} = useEvaAccount();

onMounted(load);
</script>

<template>
  <section class="profile-section eva-account-section">
    <h2>Compte eva.gg</h2>

    <div v-if="isLoading" class="loading-state">Chargement...</div>

    <div v-else class="section-body">
      <!-- Linked: show the account, and let the player change it for another; never drop it -->
      <div v-if="link && !isChanging" class="linked-account">
        <div class="linked-account-row">
          <div class="linked-account-info">
            <span class="linked-tag">{{ link.username }}</span>
            <span class="linked-since">Lié le {{ linkedOn }}</span>
          </div>
          <button type="button" class="btn-change" :disabled="isBusy" @click="startChange">Changer</button>
        </div>
        <p class="form-hint">
          Ce lien suit ton compte eva.gg même si tu changes de pseudo là-bas.
        </p>
      </div>

      <!-- Not linked, or being changed: ask for the tag -->
      <form v-else class="profile-form" @submit.prevent="linkAccount">
        <div class="form-group">
          <label for="evaUsername">
            {{ isChanging && link ? `Nouveau tag eva.gg, à la place de ${link.username}` : 'Tag eva.gg' }}
          </label>
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

        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="isBusy">
            {{ isLinking ? 'Liaison...' : isChanging ? 'Lier ce compte à la place' : 'Lier mon compte eva.gg' }}
          </button>
          <button v-if="isChanging" type="button" class="btn-neutral" :disabled="isBusy" @click="cancelChange">Annuler</button>
        </div>
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

.btn-change {
  @include btn-base($color-accent);
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.btn-neutral {
  @include btn-base($color-text-secondary);
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
