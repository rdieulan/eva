<script setup lang="ts">
// Walk-through, the pseudo: the Discord name to start with, changed here if wished
import { computed, ref } from 'vue';
import { NAME_MAX_LENGTH, ERROR } from '@shared/constants';
import { normalizeName, validateName } from '@shared/utils';
import { renameAccount } from '@/api/auth.api';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import OnboardingStepLayout from '@/components/onboarding/layout/OnboardingStepLayout.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const emit = defineEmits<{ done: [] }>();

const { account, setAuth } = useAuth();
const { errors, setErrors, setErrorFromException, clearErrors } = useErrors();

const name = ref(account.value?.name ?? '');
const isSaving = ref(false);
const isChanged = computed(() => normalizeName(name.value) !== account.value?.name);

async function next() {
  clearErrors();
  if (!isChanged.value) {
    emit('done');
    return;
  }

  const valid = validateName(name.value);
  if (valid !== true) {
    setErrors(valid);
    return;
  }

  isSaving.value = true;
  try {
    setAuth(await renameAccount(name.value));
    emit('done');
  } catch (error) {
    setErrorFromException(error, ERROR.nameUpdateFailed);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="next">
    <OnboardingStepLayout
      title="Ton pseudo"
      lead="C'est le nom que verront tes coéquipiers. On a repris ton nom Discord : change-le si tu veux."
    >
      <input
        v-model="name"
        class="field"
        type="text"
        aria-label="Pseudo"
        :maxlength="NAME_MAX_LENGTH"
        :disabled="isSaving"
        autofocus
      />
      <ErrorDisplay :errors="errors" />

      <template #actions>
        <button type="submit" class="primary" :disabled="isSaving">
          {{ isSaving ? 'Enregistrement…' : 'Continuer' }}
        </button>
      </template>
    </OnboardingStepLayout>
  </form>
</template>

<style scoped lang="scss">
@use '@/styles/onboarding' as *;

.field {
  @include onboarding-input;
}

.primary {
  @include onboarding-primary;
}
</style>
