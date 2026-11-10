<script setup lang="ts">
// The first-login walk-through: one question a page (pseudo, eva.gg account,
// EVA Pass, team), shown once; each answer stays to be changed on the
// profile. It ends where the player was going, or where its last step leads.
// The eva.gg account is the one step that cannot be skipped: every player has
// one, and a player who has none, whenever they signed up, comes back here
// for that step alone. A step is a component in STEPS: adding one is adding
// it there.
import { computed, ref } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ERROR } from '@shared/constants';
import { finishOnboarding } from '@/api/auth.api';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import OnboardingNameStep from '@/components/onboarding/OnboardingNameStep.vue';
import OnboardingEvaStep from '@/components/onboarding/OnboardingEvaStep.vue';
import OnboardingPassStep from '@/components/onboarding/OnboardingPassStep.vue';
import OnboardingTeamStep from '@/components/onboarding/OnboardingTeamStep.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const route = useRoute();
const router = useRouter();
const { account, setAuth } = useAuth();
const { errors, setErrorFromException, clearErrors } = useErrors();

interface Step {
  key: string;
  component: Component;
}

const STEPS: Step[] = [
  { key: 'name', component: OnboardingNameStep },
  { key: 'eva', component: OnboardingEvaStep },
  { key: 'pass', component: OnboardingPassStep },
  { key: 'team', component: OnboardingTeamStep },
];

// Where the player was going when the walk-through stopped them: a page of the app only
const next = computed(() => {
  const value = route.query.next;
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;
});

// Sent back for the eva.gg account alone: the walk-through was over before it was required
const isReturning = account.value?.isOnboarded === true;

// The team step goes when the player came to join a team, or already has one
const steps = computed(() => (isReturning
  ? STEPS.filter(step => step.key === 'eva')
  : STEPS.filter(step => step.key !== 'team' || !(next.value?.startsWith('/join/') || account.value?.teamId))));

// "Plus tard" skips what can wait, never the eva.gg account: it shows once one is linked
const isEvaLinked = ref(account.value?.hasEvaAccount === true);

const hello = computed(() => {
  const name = account.value?.name;
  if (isReturning) return `Il te reste une étape${name ? `, ${name}` : ''}`;
  return `Bienvenue${name ? `, ${name}` : ''} !`;
});

const index = ref(0);
const direction = ref<'forward' | 'back'>('forward');
const isFinishing = ref(false);

const current = computed(() => steps.value[index.value]!);
// The last step has its own way out: skipping everything would say it twice
const isLastStep = computed(() => index.value === steps.value.length - 1);
const progress = computed(() => ((index.value + 1) / steps.value.length) * 100);

function back() {
  if (index.value === 0) return;
  direction.value = 'back';
  index.value -= 1;
}

function advance() {
  // The eva.gg step is done only once an account is linked
  if (current.value.key === 'eva') isEvaLinked.value = true;
  if (isLastStep.value) {
    void finish(next.value ?? '/');
    return;
  }
  direction.value = 'forward';
  index.value += 1;
}

// Over, done or skipped: it will not show again, and the player goes on
async function finish(destination: string) {
  clearErrors();
  isFinishing.value = true;
  try {
    setAuth(await finishOnboarding());
    await router.replace(destination);
  } catch (error) {
    setErrorFromException(error, ERROR.onboardingFailed);
  } finally {
    isFinishing.value = false;
  }
}
</script>

<template>
  <div class="welcome-page">
    <div class="welcome">
      <header class="welcome-header">
        <div class="welcome-top">
          <span class="welcome-hello">{{ hello }}</span>
          <button v-if="!isLastStep && isEvaLinked" type="button" class="later" :disabled="isFinishing" @click="finish(next ?? '/')">
            Plus tard
          </button>
        </div>
        <!-- A single step has no way to go -->
        <template v-if="steps.length > 1">
          <div
            class="progress"
            role="progressbar"
            :aria-valuenow="index + 1"
            aria-valuemin="1"
            :aria-valuemax="steps.length"
            :aria-label="`Étape ${index + 1} sur ${steps.length}`"
          >
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <span class="step-count">Étape {{ index + 1 }} sur {{ steps.length }}</span>
        </template>
      </header>

      <Transition :name="`step-${direction}`" mode="out-in">
        <component
          :is="current.component"
          :key="current.key"
          v-bind="current.key === 'team' ? { isFinishing } : {}"
          @done="advance"
          @finish="finish"
        />
      </Transition>

      <ErrorDisplay :errors="errors" />

      <button v-if="index > 0" type="button" class="back" :disabled="isFinishing" @click="back">
        ← Retour
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.welcome-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  @include surface-gradient;
  padding: $spacing-2xl $spacing-lg;

  @include mobile-lg {
    padding: $spacing-lg $spacing-md;
  }
}

.welcome {
  display: flex;
  flex-direction: column;
  gap: $spacing-xl;
  width: 100%;
  max-width: 480px;

  @include mobile {
    gap: $spacing-lg;
  }
}

.welcome-header {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.welcome-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: $spacing-md;
}

.welcome-hello {
  color: $color-text-secondary;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.later {
  flex-shrink: 0;
  padding: $spacing-xs $spacing-sm;
  background: none;
  border: none;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: $color-text-primary;
    text-decoration: underline;
  }
}

.progress {
  height: 6px;
  background: $color-bg-tertiary;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: $color-accent;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.step-count {
  color: $color-text-muted;
  font-size: $font-size-xs;
}

.back {
  align-self: flex-start;
  padding: $spacing-xs 0;
  background: none;
  border: none;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: $color-text-primary;
  }
}

// One step slides in where the other leaves, the way the player goes
.step-forward-enter-active,
.step-forward-leave-active,
.step-back-enter-active,
.step-back-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.step-forward-enter-from,
.step-back-leave-to {
  opacity: 0;
  transform: translateX(28px);
}

.step-forward-leave-to,
.step-back-enter-from {
  opacity: 0;
  transform: translateX(-28px);
}

@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-from,
  .step-forward-leave-to,
  .step-back-enter-from,
  .step-back-leave-to {
    transform: none;
  }

  .progress-fill {
    transition: none;
  }
}
</style>
