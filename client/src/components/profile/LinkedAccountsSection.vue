<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import { getLinkedAccounts, linkAccount, switchAccount } from '@/api/auth.api';
import { validateEmail } from '@shared/utils';
import { ERROR } from '@shared/constants';
import type { LinkedAccount } from '@shared/types';
import { landingPathForAccount } from '@/router';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import Modal from '@/components/common/Modal.vue';

const { account, setAuth } = useAuth();
const { errors, setError, setErrors, clearErrors } = useErrors();

// Linked accounts
const linkedAccounts = ref<LinkedAccount[]>([]);
const isLoadingAccounts = ref(false);

// Link account modal
const showLinkModal = ref(false);
const linkEmail = ref('');
const linkPassword = ref('');
const isLinking = ref(false);
const linkSuccess = ref('');

// Account type labels
const accountTypeLabels: Record<string, string> = {
  player: 'Joueur',
  manager: 'Gérant',
  admin: 'Administrateur',
};

onMounted(async () => {
  await loadLinkedAccounts();
});

async function loadLinkedAccounts() {
  isLoadingAccounts.value = true;
  try {
    linkedAccounts.value = await getLinkedAccounts();
  } catch {
    // Silent fail - not critical
    linkedAccounts.value = [];
  } finally {
    isLoadingAccounts.value = false;
  }
}

function openLinkModal() {
  clearErrors();
  linkEmail.value = '';
  linkPassword.value = '';
  linkSuccess.value = '';
  showLinkModal.value = true;
}

function closeLinkModal() {
  showLinkModal.value = false;
}

async function handleLinkAccount() {
  clearErrors();
  linkSuccess.value = '';

  if (!linkEmail.value || !linkPassword.value) {
    setError(ERROR.requiredFieldsMissing);
    return;
  }

  const emailValid = validateEmail(linkEmail.value);
  if (emailValid !== true) {
    setErrors(emailValid);
    return;
  }

  isLinking.value = true;

  try {
    await linkAccount(linkEmail.value, linkPassword.value);
    linkSuccess.value = 'Compte lié avec succès';
    await loadLinkedAccounts();
    setTimeout(() => {
      closeLinkModal();
    }, 1500);
  } catch (err) {
    if (err && typeof err === 'object' && 'errors' in err) {
      setErrors((err as { errors: string[] }).errors);
    } else {
      setError(ERROR.linkAccountFailed);
    }
  } finally {
    isLinking.value = false;
  }
}

async function handleSwitchAccount(targetAccountId: string) {
  if (targetAccountId === account.value?.id) return;

  try {
    const response = await switchAccount(targetAccountId);
    setAuth(response.token, response.account);
    // Hard-navigate to the new account's landing page so all component state is
    // dropped and the global guards re-run against the fresh account.
    window.location.href = landingPathForAccount(response.account);
  } catch (err) {
    if (err && typeof err === 'object' && 'errors' in err) {
      setErrors((err as { errors: string[] }).errors);
    } else {
      setError(ERROR.switchAccountFailed);
    }
  }
}
</script>

<template>
  <section class="profile-section linked-accounts-section">
    <h2>Comptes liés</h2>

    <!-- Loading state -->
    <div v-if="isLoadingAccounts" class="loading-state">
      Chargement...
    </div>

    <!-- Linked accounts list -->
    <div v-else-if="linkedAccounts.length > 1" class="linked-accounts-list">
      <div
        v-for="linkedAccount in linkedAccounts"
        :key="linkedAccount.id"
        class="linked-account-item"
        :class="{ current: linkedAccount.isCurrent }"
        @click="handleSwitchAccount(linkedAccount.id)"
      >
        <div class="account-info">
          <span class="account-name">{{ linkedAccount.name }}</span>
          <span class="account-type">{{ accountTypeLabels[linkedAccount.accountType] }}</span>
        </div>
        <span v-if="linkedAccount.isCurrent" class="current-badge">Actuel</span>
        <span v-else class="switch-hint">Cliquer pour basculer</span>
      </div>
    </div>

    <!-- No linked accounts -->
    <p v-else class="no-accounts-text">
      Aucun autre compte lié.
    </p>

    <!-- Link account button -->
    <button class="btn-link-account" @click="openLinkModal">
      + Lier un autre compte
    </button>

    <!-- Link account modal -->
    <Modal
      :open="showLinkModal"
      title="Lier un compte"
      @close="closeLinkModal"
    >
      <form @submit.prevent="handleLinkAccount" class="link-form">
        <p class="modal-info">
          Entrez les identifiants du compte que vous souhaitez lier.
          Une fois liés, vous pourrez basculer entre les comptes rapidement.
        </p>

        <div class="form-group">
          <label for="linkEmail">Email du compte à lier</label>
          <input
            id="linkEmail"
            v-model="linkEmail"
            type="email"
            placeholder="email@exemple.com"
            :disabled="isLinking"
          />
        </div>

        <div class="form-group">
          <label for="linkPassword">Mot de passe</label>
          <input
            id="linkPassword"
            v-model="linkPassword"
            type="password"
            placeholder="••••••••"
            :disabled="isLinking"
          />
        </div>

        <ErrorDisplay :errors="errors" />

        <div v-if="linkSuccess" class="message success">
          {{ linkSuccess }}
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="closeLinkModal" :disabled="isLinking">
            Annuler
          </button>
          <button type="submit" class="btn-confirm" :disabled="isLinking || !linkEmail || !linkPassword">
            {{ isLinking ? 'Liaison...' : 'Lier le compte' }}
          </button>
        </div>
      </form>
    </Modal>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.linked-accounts-section {
  background: $color-bg-tertiary;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-lg;

  h2 {
    color: $color-accent;
    margin: 0 0 $spacing-md;
    font-size: 1.1rem;
    font-weight: 600;
  }
}

.loading-state {
  color: $color-text-secondary;
  text-align: center;
  padding: $spacing-md;
}

.linked-accounts-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.linked-account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.current) {
    border-color: $color-accent;
    background: rgba($color-accent, 0.1);
  }

  &.current {
    border-color: $color-accent;
    cursor: default;
  }
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-name {
  color: $color-text-primary;
  font-weight: 500;
}

.account-type {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.current-badge {
  background: $color-accent;
  color: $color-white;
  padding: 2px 8px;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: 500;
}

.switch-hint {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.no-accounts-text {
  color: $color-text-secondary;
  margin-bottom: $spacing-md;
}

.btn-link-account {
  @include btn-base($color-edit);
  width: 100%;
}

.link-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.modal-info {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.5;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }

  input {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-secondary;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    color: $color-text-primary;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }

    &::placeholder {
      color: $color-text-secondary;
    }

    &:disabled {
      opacity: 0.6;
    }
  }
}

.message {
  padding: $spacing-sm;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  text-align: center;

  &.success {
    background: rgba($color-success, 0.1);
    border: 1px solid $color-success;
    color: $color-success;
  }
}

.modal-actions {
  display: flex;
  gap: $spacing-md;
  justify-content: flex-end;
  margin-top: $spacing-sm;
}

.btn-cancel {
  @include btn-base($color-danger);
}

.btn-confirm {
  @include btn-base($color-accent);
}
</style>
