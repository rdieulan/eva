<script setup lang="ts">
// Walk-through, the EVA Pass: its tier, chosen at a glance, and the day it
// renews, as on the profile (eva.gg does not make them public)
import { computed, onMounted } from 'vue';
import { SUBSCRIPTION_TIERS } from '@shared/types';
import type { SubscriptionTier } from '@shared/types';
import { SUBSCRIPTION_RENEWAL_PERIOD_DAYS } from '@shared/constants';
import { SUBSCRIPTION_TIER_LABELS } from '@/utils/subscription';
import { useSubscription } from '@/composables/useSubscription';
import OnboardingStepLayout from '@/components/onboarding/layout/OnboardingStepLayout.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const emit = defineEmits<{ done: [] }>();

const { tier, renewalDate, isLoading, isSaving, errors, load, save } = useSubscription();

// No pass first, then the tiers in their order
const CHOICES: { value: SubscriptionTier | null; label: string }[] = [
  { value: null, label: 'Pas d\'EVA Pass' },
  ...SUBSCRIPTION_TIERS.map(value => ({ value, label: SUBSCRIPTION_TIER_LABELS[value] })),
];

const isBusy = computed(() => isLoading.value || isSaving.value);

onMounted(load);

function choose(value: SubscriptionTier | null) {
  tier.value = value;
  if (value === null) renewalDate.value = '';
}

async function next() {
  await save();
  if (!errors.value.length) emit('done');
}
</script>

<template>
  <form @submit.prevent="next">
    <OnboardingStepLayout
      title="Ton EVA Pass"
      lead="Ton palier et sa date de renouvellement : eva.gg ne les rend pas publics, alors on te les demande."
    >
      <div class="tiers" role="radiogroup" aria-label="Palier de l'EVA Pass">
        <button
          v-for="choice in CHOICES"
          :key="choice.value ?? 'none'"
          type="button"
          role="radio"
          class="tier"
          :class="[`tier--${(choice.value ?? 'none').toLowerCase()}`, { selected: tier === choice.value }]"
          :aria-checked="tier === choice.value"
          :disabled="isBusy"
          @click="choose(choice.value)"
        >
          {{ choice.label }}
        </button>
      </div>

      <label v-if="tier" class="renewal">
        <span class="renewal-label">Date de renouvellement</span>
        <input v-model="renewalDate" class="field" type="date" :disabled="isBusy" />
        <span class="hint">Il se renouvelle tous les {{ SUBSCRIPTION_RENEWAL_PERIOD_DAYS }} jours à partir de cette date.</span>
      </label>

      <ErrorDisplay :errors="errors" />

      <template #actions>
        <button type="submit" class="primary" :disabled="isBusy">
          {{ isSaving ? 'Enregistrement…' : 'Continuer' }}
        </button>
        <button type="button" class="skip" :disabled="isBusy" @click="emit('done')">
          Passer cette étape
        </button>
      </template>
    </OnboardingStepLayout>
  </form>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/forms' as *;
@use '@/styles/onboarding' as *;

.tiers {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
}

.tier {
  padding: 1.1rem $spacing-md;
  background: $color-bg-secondary;
  border: $border-thick solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-primary;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, transform 0.15s;

  &:hover:not(:disabled) {
    border-color: $color-accent;
  }

  &.selected {
    border-color: $color-accent;
    background: with-alpha($color-accent, 0.15);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  // The metal of each tier, as a thin mark along the top of the card: drawn
  // inside it, so it stays when the card is chosen and shifts nothing
  &--bronze {
    box-shadow: inset 0 4px 0 $color-tier-bronze;
  }

  &--silver {
    box-shadow: inset 0 4px 0 $color-tier-silver;
  }

  &--gold {
    box-shadow: inset 0 4px 0 $color-tier-gold;
  }
}

.renewal {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.renewal-label {
  @include form-label;
}

.field {
  @include onboarding-input;
}

.hint {
  @include onboarding-hint;
}

.primary {
  @include onboarding-primary;
}

.skip {
  @include onboarding-skip;
}
</style>
