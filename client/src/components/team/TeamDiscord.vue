<script setup lang="ts">
import { ref, computed } from 'vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { linkTeamDiscord, unlinkTeamDiscord } from '@/api';
import { useErrors } from '@/composables/useErrors';
import type { TeamDiscordStatus } from '@shared/types';
import { ERROR } from '@shared/constants';

// Where the team's notifications go besides the bell: a channel of its Discord
// server, through the webhook Discord gives for it. Whoever manages the team
// links it, changes it or removes it; the others see whether it is there.
const props = defineProps<{
  status: TeamDiscordStatus;
  canManage: boolean;
}>();

const emit = defineEmits<{
  changed: [status: TeamDiscordStatus];
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const webhookUrl = ref('');
const isChanging = ref(false); // Another channel instead of the one linked
const isBusy = ref(false);

// The address goes in when nothing posts yet, or when the channel changes
const showForm = computed(() => props.canManage && (props.status !== 'linked' || isChanging.value));

async function act(action: () => Promise<void>, fallback: string, then: TeamDiscordStatus) {
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
  if (url) act(() => linkTeamDiscord(url), ERROR.discordLinkFailed, 'linked');
}

function unlink() {
  act(unlinkTeamDiscord, ERROR.discordUnlinkFailed, 'none');
}

function cancelChange() {
  isChanging.value = false;
  webhookUrl.value = '';
  clearErrors();
}
</script>

<template>
  <section class="team-discord">
    <h2>Discord</h2>

    <p v-if="status === 'linked'" class="discord-status discord-status--linked">
      Les notifications de l'équipe sont postées dans {{ canManage ? 'votre salon Discord' : 'le salon Discord de l\'équipe' }}.
    </p>
    <p v-else-if="status === 'broken'" class="discord-status discord-status--broken" role="alert">
      Discord a refusé le dernier message : le webhook a sans doute été supprimé.{{ canManage ? ' Collez une nouvelle adresse pour reprendre.' : '' }}
    </p>
    <p v-else-if="canManage" class="discord-status">
      Les notifications de l'équipe peuvent aussi arriver dans un salon de votre serveur Discord.
    </p>
    <p v-else class="discord-status">Aucun salon Discord n'est relié.</p>

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
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.team-discord {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;

  h2 {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-white;
  }
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
