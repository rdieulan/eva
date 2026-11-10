<script setup lang="ts">
// The requests to join the team, waiting for an answer: who asks, with the
// eva.gg account they linked, and when. Shown to those who may invite members,
// and only when there is one. A refusal is for good: it asks first.
import { onMounted, ref } from 'vue';
import type { TeamJoinRequestView } from '@shared/types';
import { ERROR } from '@shared/constants';
import { acceptJoinRequest, fetchTeamJoinRequests, refuseJoinRequest } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { formatRelativeTime } from '@/utils/notifications';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import SubjectIcon from '@/components/common/SubjectIcon.vue';

const emit = defineEmits<{
  // A player came in: the members follow
  accepted: [playerName: string];
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const requests = ref<TeamJoinRequestView[]>([]);
const busyId = ref<string | null>(null);
const toRefuse = ref<TeamJoinRequestView | null>(null);

async function load() {
  try {
    requests.value = await fetchTeamJoinRequests();
  } catch (error) {
    setErrorFromException(error, ERROR.joinRequestsFetchFailed);
  }
}

async function answer(request: TeamJoinRequestView, verdict: 'accept' | 'refuse') {
  if (busyId.value) return;
  busyId.value = request.id;
  clearErrors();
  try {
    await (verdict === 'accept' ? acceptJoinRequest(request.id) : refuseJoinRequest(request.id));
    requests.value = requests.value.filter(other => other.id !== request.id);
    if (verdict === 'accept') emit('accepted', request.playerName);
  } catch (error) {
    setErrorFromException(error, ERROR.joinRequestAnswerFailed);
    // Answered elsewhere meanwhile, or gone: the list says where things stand
    await load();
  } finally {
    busyId.value = null;
  }
}

function confirmRefusal() {
  const request = toRefuse.value;
  toRefuse.value = null;
  if (request) void answer(request, 'refuse');
}

onMounted(load);
</script>

<template>
  <section v-if="requests.length || errors.length" class="team-join-requests">
    <!-- The team's symbol and colour, as the reminder of the home shows them -->
    <h2><SubjectIcon subject="team" size="22px" />Demandes pour rejoindre <span class="count">{{ requests.length }}</span></h2>
    <ErrorDisplay :errors="errors" />

    <ul class="request-list">
      <li v-for="request in requests" :key="request.id" class="request">
        <div class="request-who">
          <strong>{{ request.playerName }}</strong>
          <span>
            {{ request.evaUsername ? `eva.gg : ${request.evaUsername}` : 'Pas de compte eva.gg relié' }}
            · {{ formatRelativeTime(request.createdAt) }}
          </span>
        </div>
        <div class="request-actions">
          <button type="button" class="btn btn-accept" :disabled="!!busyId" @click="answer(request, 'accept')">Accepter</button>
          <button type="button" class="btn btn-refuse" :disabled="!!busyId" @click="toRefuse = request">Refuser</button>
        </div>
      </li>
    </ul>

    <ConfirmModal
      :open="!!toRefuse"
      title="Refuser la demande"
      :message="`${toRefuse?.playerName} ne pourra plus demander à rejoindre l'équipe. Un lien d'invitation pourra toujours l'y faire entrer.`"
      confirm-text="Refuser"
      :danger="true"
      @confirm="confirmRefusal"
      @cancel="toRefuse = null"
    />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.team-join-requests {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid with-alpha($color-accent, 0.6);
  border-radius: $radius-lg;

  h2 {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin: 0;
    font-size: $font-size-xl;
    color: $color-white;
  }
}

.count {
  min-width: 1.6em;
  padding: 0 $spacing-xs;
  background: $color-team;
  border-radius: 999px;
  color: $color-white;
  font-size: $font-size-sm;
  text-align: center;
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin: 0;
  padding: 0;
  list-style: none;
}

.request {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-sm $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border-radius: $radius-md;
}

.request-who {
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong {
    color: $color-text-primary;
    overflow-wrap: anywhere;
  }

  span {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
}

.request-actions {
  display: flex;
  gap: $spacing-sm;
}

.btn-accept {
  @include btn-base($color-success);
}

.btn-refuse {
  @include btn-base($color-danger);
}
</style>
