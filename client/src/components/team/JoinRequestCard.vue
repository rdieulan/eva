<script setup lang="ts">
// The player's request to join a team, on their no-team screen: waiting, to
// take back, or refused, said once. While it waits it is read again now and
// then: accepted, the player goes to their team page.
import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { MyJoinRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { cancelMyJoinRequest, fetchMyJoinRequest, markMyRefusalSeen } from '@/api';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import TeamLogo from '@/components/common/TeamLogo.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const props = defineProps<{
  request: MyJoinRequest;
}>();

const emit = defineEmits<{
  // The request as it is now, refused; or null once taken back, seen, or gone
  changed: [request: MyJoinRequest | null];
}>();

// How often a waiting request is read again, while the page is in sight
const WATCH_EVERY_MS = 15_000;

const router = useRouter();
const { hasTeam, refreshAccount } = useAuth();
const { errors, setErrorFromException, clearErrors } = useErrors();

let timer: ReturnType<typeof setInterval> | null = null;
let isActing = false;

// Read the request again: gone means answered by a yes, or taken back elsewhere
async function check() {
  if (props.request.status !== 'PENDING' || document.visibilityState !== 'visible') return;
  try {
    const now = await fetchMyJoinRequest();
    if (now?.status === 'PENDING' && now.id === props.request.id) return;
    if (now) {
      emit('changed', now);
      return;
    }
    await refreshAccount();
    if (hasTeam.value) {
      await router.push('/team');
      return;
    }
    emit('changed', null);
  } catch {
    // A missed reading is tried again at the next one
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') void check();
}

async function act(action: () => Promise<void>, fallback: string) {
  if (isActing) return;
  isActing = true;
  clearErrors();
  try {
    await action();
    emit('changed', null);
  } catch (error) {
    setErrorFromException(error, fallback);
  } finally {
    isActing = false;
  }
}

onMounted(() => {
  timer = setInterval(() => void check(), WATCH_EVERY_MS);
  document.addEventListener('visibilitychange', onVisible);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisible);
});
</script>

<template>
  <section class="join-request" :class="{ 'join-request--refused': request.status === 'REFUSED' }">
    <div class="join-request-team">
      <TeamLogo :name="request.team.name" :logo-url="request.team.logoUrl" :size="56" />
      <div class="join-request-text">
        <template v-if="request.status === 'PENDING'">
          <strong>Demande envoyée à {{ request.team.name }}</strong>
          <span>Tu entres dans l'équipe dès que son capitaine l'accepte.</span>
        </template>
        <template v-else>
          <strong>{{ request.team.name }} n'a pas accepté ta demande</strong>
          <span>Un lien d'invitation de l'équipe peut toujours t'y faire entrer.</span>
        </template>
      </div>
    </div>

    <ErrorDisplay :errors="errors" />

    <button
      v-if="request.status === 'PENDING'"
      type="button"
      class="join-request-action"
      @click="act(cancelMyJoinRequest, ERROR.joinRequestCancelFailed)"
    >
      Annuler la demande
    </button>
    <button v-else type="button" class="join-request-action" @click="act(markMyRefusalSeen, ERROR.serverError)">
      Compris
    </button>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.join-request {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  width: 100%;
  padding: $spacing-lg;
  background: $color-bg-secondary;
  border: $border-thin solid with-alpha($color-accent, 0.5);
  border-radius: $radius-lg;

  &--refused {
    border-color: with-alpha($color-danger, 0.5);
  }
}

.join-request-team {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  min-width: 0;
}

.join-request-text {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  min-width: 0;
  text-align: left;

  strong {
    color: $color-text-primary;
    overflow-wrap: anywhere;
  }

  span {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
}

.join-request-action {
  align-self: flex-start;
  padding: $spacing-sm $spacing-md;
  background: transparent;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
  color: $color-text-primary;
  font: inherit;
  cursor: pointer;

  &:hover {
    border-color: $color-text-secondary;
  }
}
</style>
