<script setup lang="ts">
// Walk-through, the team: join one with the link its leader sent, make one's
// own, or later; the walk-through ends on the page it leads to
import { ref } from 'vue';
import { ERROR } from '@shared/constants';
import { inviteCodeOf } from '@/utils/invites';
import { useErrors } from '@/composables/useErrors';
import OnboardingStepLayout from '@/components/onboarding/layout/OnboardingStepLayout.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

defineProps<{
  isFinishing: boolean;
}>();

const emit = defineEmits<{ finish: [destination: string] }>();

const { errors, setError, clearErrors } = useErrors();
const invite = ref('');

function join() {
  clearErrors();
  const code = inviteCodeOf(invite.value);
  if (!code) {
    setError(ERROR.inviteCodeInvalid);
    return;
  }
  emit('finish', `/join/${code}`);
}
</script>

<template>
  <form @submit.prevent="join">
    <OnboardingStepLayout
      title="Ton équipe"
      lead="Rejoins ton équipe avec le lien que son capitaine t'a envoyé, ou crée la tienne."
    >
      <input
        v-model="invite"
        class="field"
        type="text"
        aria-label="Lien d'invitation"
        placeholder="Colle ici ton lien d'invitation"
        autocomplete="off"
        :disabled="isFinishing"
      />
      <ErrorDisplay :errors="errors" />

      <template #actions>
        <button type="submit" class="primary" :disabled="isFinishing || !invite.trim()">
          Rejoindre l'équipe
        </button>
        <div class="separator"><span>ou</span></div>
        <button type="button" class="create" :disabled="isFinishing" @click="emit('finish', '/team/create')">
          Créer mon équipe
        </button>
        <button type="button" class="skip" :disabled="isFinishing" @click="emit('finish', '/')">
          Plus tard
        </button>
      </template>
    </OnboardingStepLayout>
  </form>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/onboarding' as *;

.field {
  @include onboarding-input;
}

.primary {
  @include onboarding-primary;
}

.create {
  @include onboarding-primary;
  background: transparent;
  border: $border-thick solid $color-accent;
  color: $color-text-primary;

  &:hover:not(:disabled) {
    background: with-alpha($color-accent, 0.12);
  }
}

.separator {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  color: $color-text-muted;
  font-size: $font-size-sm;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: $color-border-light;
  }
}

.skip {
  @include onboarding-skip;
}
</style>
