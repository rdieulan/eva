<script setup lang="ts">
// Walk-through, the eva.gg account: the tag that links it, checked on eva.gg
// as on the profile; skipped when the player has none at hand
import { onMounted } from 'vue';
import { useEvaAccount } from '@/composables/useEvaAccount';
import OnboardingStepLayout from '@/components/onboarding/layout/OnboardingStepLayout.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const emit = defineEmits<{ done: [] }>();

const { link, username, isLoading, isLinking, isBusy, errors, load, linkAccount } = useEvaAccount();

onMounted(load);

async function next() {
  if (link.value) {
    emit('done');
    return;
  }
  await linkAccount();
  if (link.value) emit('done');
}
</script>

<template>
  <form @submit.prevent="next">
    <OnboardingStepLayout
      title="Ton compte eva.gg"
      lead="Relie ton compte eva.gg à celui-ci. Seules les informations publiques de ton profil eva.gg sont lues."
    >
      <p v-if="isLoading" class="hint">Chargement…</p>

      <p v-else-if="link" class="linked">
        Lié à <strong>{{ link.username }}</strong>
      </p>

      <template v-else>
        <input
          v-model="username"
          class="field"
          type="text"
          aria-label="Tag eva.gg"
          placeholder="Pseudo#123456"
          autocomplete="off"
          :disabled="isBusy"
          autofocus
        />
        <p class="hint">Ton tag complet, avec le suffixe, tel qu'il apparaît sous ton pseudo sur ta page compte eva.gg.</p>
      </template>

      <ErrorDisplay :errors="errors" />

      <template #actions>
        <button type="submit" class="primary" :disabled="isBusy || (!link && !username.trim())">
          {{ isLinking ? 'Vérification sur eva.gg…' : link ? 'Continuer' : 'Lier mon compte' }}
        </button>
        <button v-if="!link" type="button" class="skip" :disabled="isBusy" @click="emit('done')">
          Passer cette étape
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

.hint {
  @include onboarding-hint;
}

.linked {
  margin: 0;
  padding: $spacing-md;
  background: with-alpha($color-success, 0.1);
  border: $border-thin solid with-alpha($color-success, 0.4);
  border-radius: $radius-md;
  color: $color-text-primary;
}

.primary {
  @include onboarding-primary;
}

.skip {
  @include onboarding-skip;
}
</style>
