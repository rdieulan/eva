<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import { useSubscription } from '@/composables/useSubscription';
import { clearPlayersCache } from '@/api';
import { normalizeName, validateName } from '@shared/utils';
import { ERROR, NAME_MAX_LENGTH, SUBSCRIPTION_RENEWAL_PERIOD_DAYS } from '@shared/constants';
import { renameAccount } from '@/api/auth.api';
import { SUBSCRIPTION_TIERS } from '@shared/types';
import { SUBSCRIPTION_TIER_LABELS } from '@/utils/subscription';
import { formatLongDate } from '@/utils/calendar';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import SvgIcon from '@/components/common/SvgIcon.vue';
import AccountRolesSection from '@/components/profile/AccountRolesSection.vue';
import EvaAccountSection from '@/components/profile/EvaAccountSection.vue';
import ThemeSection from '@/components/profile/ThemeSection.vue';

const router = useRouter();
const { account, clearAuth, setAuth } = useAuth();

// The name shown to the others: it starts as the Discord name, and changes here
const name = ref(account.value?.name ?? '');
const { errors: nameErrors, setErrors: setNameErrors, setErrorFromException: setNameErrorFromException, clearErrors: clearNameErrors } = useErrors();
const nameSuccess = ref('');
const isSavingName = ref(false);
const isNameChanged = computed(() => normalizeName(name.value) !== account.value?.name);

watch(() => account.value?.name, current => {
  name.value = current ?? '';
});

// Subscription (player accounts only)
const {
  tier: subscriptionTier,
  renewalDate: subscriptionRenewalDate,
  nextRenewalDate,
  isLoading: isLoadingSubscription,
  isSaving: isSavingSubscription,
  successMessage: subscriptionSuccess,
  errors: subscriptionErrors,
  load: loadSubscription,
  save: saveSubscription,
} = useSubscription();
const isSubscriptionBusy = computed(() => isLoadingSubscription.value || isSavingSubscription.value);

onMounted(() => {
  if (account.value?.playerId) loadSubscription();
});

async function saveName() {
  clearNameErrors();
  nameSuccess.value = '';

  const valid = validateName(name.value);
  if (valid !== true) {
    setNameErrors(valid);
    return;
  }

  isSavingName.value = true;
  try {
    setAuth(await renameAccount(name.value));
    nameSuccess.value = 'Pseudo enregistré';
  } catch (error) {
    setNameErrorFromException(error, ERROR.nameUpdateFailed);
  } finally {
    isSavingName.value = false;
  }
}

// Logout
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
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
            <label>Statut</label>
            <span class="role-badge" :class="account.isLeader ? 'leader' : 'player'">
              {{ account.isLeader ? 'Leader' : 'Joueur' }}
            </span>
          </div>
        </div>

        <form class="profile-form name-form" @submit.prevent="saveName">
          <div class="form-group">
            <label for="accountName">Pseudo</label>
            <input
              id="accountName"
              v-model="name"
              type="text"
              :maxlength="NAME_MAX_LENGTH"
              :disabled="isSavingName"
            />
            <p class="form-hint">Pris de ton compte Discord à ta première connexion : c'est le nom que voient les autres.</p>
          </div>

          <ErrorDisplay :errors="nameErrors" />

          <div v-if="nameSuccess" class="message success">
            {{ nameSuccess }}
          </div>

          <button type="submit" class="btn-primary" :disabled="isSavingName || !isNameChanged">
            {{ isSavingName ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </form>
      </section>

      <!-- Subscription (player accounts only) -->
      <section v-if="account?.playerId" class="profile-section">
        <h2>Abonnement</h2>
        <form @submit.prevent="saveSubscription" class="profile-form">
          <div class="form-group">
            <label for="subscriptionTier">Niveau</label>
            <select id="subscriptionTier" v-model="subscriptionTier" :disabled="isSubscriptionBusy">
              <option :value="null">Non renseigné</option>
              <option v-for="subscriptionTierOption in SUBSCRIPTION_TIERS" :key="subscriptionTierOption" :value="subscriptionTierOption">
                {{ SUBSCRIPTION_TIER_LABELS[subscriptionTierOption] }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="subscriptionRenewalDate">Date de renouvellement</label>
            <input
              id="subscriptionRenewalDate"
              v-model="subscriptionRenewalDate"
              type="date"
              :disabled="isSubscriptionBusy"
            />
            <p class="form-hint">
              Renouvelé tous les {{ SUBSCRIPTION_RENEWAL_PERIOD_DAYS }} jours à partir de cette date.
              <template v-if="nextRenewalDate">
                <br />Prochain renouvellement : <strong>{{ formatLongDate(nextRenewalDate) }}</strong>
              </template>
            </p>
          </div>

          <ErrorDisplay :errors="subscriptionErrors" />

          <div v-if="subscriptionSuccess" class="message success">
            {{ subscriptionSuccess }}
          </div>

          <button type="submit" class="btn-primary" :disabled="isSubscriptionBusy">
            {{ isSavingSubscription ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </form>
      </section>

      <!-- eva.gg account (player accounts only) -->
      <EvaAccountSection v-if="account?.playerId" />

      <!-- Roles of the account (player, manager, admin) -->
      <AccountRolesSection />

      <ThemeSection />

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
  @include surface-gradient;
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
  border: $border-thin solid $color-border-light;
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

  // The sections are child components: reach their heading through the scope
  :deep(h2) {
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

  // The main role, in the star's colour, as everywhere a leader shows
  &.leader {
    background: with-alpha($color-star, 0.2);
    color: $color-star;
  }

  &.player {
    background: with-alpha($color-accent, 0.2);
    color: $color-accent;
  }
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.name-form {
  margin-top: $spacing-lg;
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

  input,
  select {
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

  strong {
    color: $color-white;
    font-weight: 600;
  }
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
