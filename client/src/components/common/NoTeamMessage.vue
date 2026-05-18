<template>
  <div class="no-team-message">
    <div class="no-team-icon">👥</div>
    <h2>Aucune équipe</h2>
    <p>Vous n'êtes pas encore membre d'une équipe.</p>
    <p>Rejoignez une équipe existante ou créez la vôtre pour accéder à cette fonctionnalité.</p>

    <!-- Invite code section -->
    <div class="invite-section">
      <p class="invite-label">Vous avez reçu un lien d'invitation ?</p>
      <div class="invite-input-group">
        <input
          v-model="inviteCode"
          type="text"
          placeholder="Collez le code ou le lien ici..."
          @keyup.enter="handleJoin"
        />
        <button
          class="btn-join"
          @click="handleJoin"
          :disabled="!inviteCode.trim()"
        >
          Rejoindre
        </button>
      </div>
      <ErrorDisplay :errors="errors" />
    </div>

    <div class="separator">ou</div>

    <button class="btn-team" @click="handleCreateTeam">
      <span>Créer une équipe</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ERROR } from '@shared/constants';
import { useErrors } from '@/composables/useErrors';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const router = useRouter();

const inviteCode = ref('');
const { errors, setError } = useErrors();

// Handle create team - navigate to create page
function handleCreateTeam() {
  router.push('/team/create');
}

// Extract code from URL or raw code
function extractCode(input: string): string {
  const trimmed = input.trim();

  // Check if it's a full URL with /join/
  const joinMatch = trimmed.match(/\/join\/([a-zA-Z0-9]+)/);
  if (joinMatch && joinMatch[1]) {
    return joinMatch[1];
  }

  // Otherwise use as-is
  return trimmed;
}

// Handle join - redirect to join page
function handleJoin() {
  if (!inviteCode.value.trim()) return;

  const code = extractCode(inviteCode.value);

  if (!code) {
    setError(ERROR.inviteCodeInvalid);
    return;
  }

  // Redirect to join page - all join logic is handled there
  router.push(`/join/${code}`);
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use 'sass:color';

.no-team-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  padding: $spacing-xl;
  text-align: center;
  min-height: 300px;

  .no-team-icon {
    font-size: 4rem;
  }

  h2 {
    margin: 0;
    color: $color-text-primary;
  }

  p {
    margin: 0;
    color: $color-text-secondary;
    max-width: 400px;
  }

  .invite-section {
    width: 100%;
    max-width: 400px;
    margin-top: $spacing-md;

    .invite-label {
      font-weight: 500;
      color: $color-text-primary;
      margin-bottom: $spacing-sm;
    }
  }

  .invite-input-group {
    display: flex;
    gap: $spacing-sm;

    input {
      flex: 1;
      padding: $spacing-sm $spacing-md;
      border: 1px solid $color-border;
      border-radius: $radius-md;
      background: $color-bg-tertiary;
      color: $color-text-primary;
      font-size: $font-size-sm;

      &:focus {
        outline: none;
        border-color: $color-accent;
      }

      &::placeholder {
        color: $color-text-secondary;
      }
    }

    .btn-join {
      padding: $spacing-sm $spacing-md;
      background: $color-success;
      border: none;
      border-radius: $radius-md;
      color: white;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background: color.scale($color-success, $lightness: -17%);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  .separator {
    color: $color-text-secondary;
    font-size: $font-size-sm;
    position: relative;
    width: 100%;
    max-width: 200px;
    text-align: center;

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 40%;
      height: 1px;
      background: $color-border;
    }

    &::before {
      left: 0;
    }

    &::after {
      right: 0;
    }
  }

  .btn-team {
    display: inline-flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
    background-color: $color-accent;
    color: $color-text-primary;
    border: none;
    border-radius: $radius-md;
    text-decoration: none;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba($color-accent, 0.8);
    }
  }
}
</style>
