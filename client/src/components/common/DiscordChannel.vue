<script setup lang="ts">
// A channel of a Discord server that a team or a venue posts in, through the
// webhook Discord gives for it. Whoever manages it links it, changes it or
// removes it; the others see whether it is there. What it gets, and how the
// reader is spoken to, is the owner's to say.
import { ref, computed } from 'vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { useErrors } from '@/composables/useErrors';
import type { DiscordChannelStatus } from '@shared/types';
import { ERROR } from '@shared/constants';

const props = defineProps<{
  status: DiscordChannelStatus;
  canManage: boolean;
  says: { linked: string; broken: string; none: string }; // What each status tells the reader
  link: (webhookUrl: string) => Promise<void>;
  unlink: () => Promise<void>;
}>();

const emit = defineEmits<{
  changed: [status: DiscordChannelStatus];
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const webhookUrl = ref('');
const isChanging = ref(false); // Another channel instead of the one linked
const isBusy = ref(false);

// The address goes in when nothing posts yet, or when the channel changes
const showForm = computed(() => props.canManage && (props.status !== 'linked' || isChanging.value));

async function act(action: () => Promise<void>, fallback: string, then: DiscordChannelStatus) {
  if (isBusy.value) return;
  isBusy.value = true;
  clearErrors();
  try {
    await action();
    webhookUrl.value = '';
    isChanging.value = false;
    emit('changed', then);
  } catch (error) {
    setErrorFromException(error, fallback);
  } finally {
    isBusy.value = false;
  }
}

function link() {
  const url = webhookUrl.value.trim();
  if (url) act(() => props.link(url), ERROR.discordLinkFailed, 'linked');
}

function unlink() {
  act(props.unlink, ERROR.discordUnlinkFailed, 'none');
}

function cancelChange() {
  isChanging.value = false;
  webhookUrl.value = '';
  clearErrors();
}
</script>

<template>
  <div class="discord-channel">
    <p v-if="status === 'linked'" class="discord-status discord-status--linked">{{ says.linked }}</p>
    <p v-else-if="status === 'broken'" class="discord-status discord-status--broken" role="alert">{{ says.broken }}</p>
    <p v-else class="discord-status">{{ says.none }}</p>

    <form v-if="showForm" class="discord-form" @submit.prevent="link">
      <label for="discord-webhook">Adresse du webhook</label>
      <input
        id="discord-webhook"
        v-model="webhookUrl"
        type="url"
        placeholder="https://discord.com/api/webhooks/…"
        autocomplete="off"
        spellcheck="false"
        :disabled="isBusy"
      />
      <p class="discord-hint">
        Dans Discord : paramètres du salon, Intégrations, Webhooks, Nouveau webhook, puis « Copier l'URL du webhook ».
      </p>
      <ErrorDisplay :errors="errors" />
      <div class="discord-actions">
        <button type="submit" class="btn btn-primary" :disabled="isBusy || !webhookUrl.trim()">
          {{ isBusy ? 'Liaison…' : 'Relier' }}
        </button>
        <button v-if="isChanging" type="button" class="btn btn-secondary" :disabled="isBusy" @click="cancelChange">Annuler</button>
        <button v-if="status === 'broken'" type="button" class="btn btn-danger" :disabled="isBusy" @click="unlink">Retirer</button>
      </div>
    </form>

    <div v-else-if="canManage && status === 'linked'" class="discord-actions">
      <ErrorDisplay :errors="errors" />
      <button type="button" class="btn btn-secondary" :disabled="isBusy" @click="isChanging = true">Changer de salon</button>
      <button type="button" class="btn btn-danger" :disabled="isBusy" @click="unlink">Retirer</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.discord-channel {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.discord-status {
  margin: 0;
  color: $color-text-secondary;

  &--linked {
    color: $color-success;
  }

  // Flagged by its frame, read in the text colour
  &--broken {
    padding: $spacing-sm $spacing-md;
    background: with-alpha($color-danger, 0.12);
    border: $border-thin solid with-alpha($color-danger, 0.4);
    border-radius: $radius-sm;
    color: $color-text-primary;
  }
}

.discord-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  input {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-secondary;
    border: $border-thin solid $color-border-light;
    border-radius: $radius-md;
    color: $color-white;
    font: inherit;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

.discord-hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.discord-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;

  // An error says what went wrong above the buttons
  > :deep(.error-display) {
    flex-basis: 100%;
  }
}

.btn-primary {
  @include btn-base($color-accent);
}

.btn-secondary {
  @include btn-base($color-text-secondary);
}

.btn-danger {
  @include btn-base($color-danger);
}
</style>
