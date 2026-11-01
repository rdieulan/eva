<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from '@/components/common/Modal.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import { deleteScrimSearch } from '@/api';
import { useErrors } from '@/composables/useErrors';
import type { ScrimSearch } from '@shared/types';
import { ERROR } from '@shared/constants';
import { formatLongDate } from '@/utils/calendar';

// A search as the calendar shows it: who looks for an opponent, when, where.
// The team that opened it can withdraw it from here.
const props = defineProps<{
  search: ScrimSearch | null; // Open while set
  venueLabel: string | null;
  canWithdraw: boolean; // The reader's team opened it and the reader may act for the team
}>();

const emit = defineEmits<{
  close: [];
  withdrawn: []; // The search is gone; the calendar reloads
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const showConfirm = ref(false);
const isWithdrawing = ref(false);

watch(() => props.search, () => {
  clearErrors();
  showConfirm.value = false;
  isWithdrawing.value = false;
});

function slotCountLabel(search: ScrimSearch): string {
  return search.evaSlotIds.length > 1 ? `${search.evaSlotIds.length} créneaux` : '1 créneau';
}

async function withdraw() {
  if (!props.search) return;
  showConfirm.value = false;
  isWithdrawing.value = true;
  try {
    await deleteScrimSearch(props.search.id);
    emit('withdrawn');
    emit('close');
  } catch (error) {
    setErrorFromException(error, ERROR.scrimSearchDeleteFailed);
  } finally {
    isWithdrawing.value = false;
  }
}
</script>

<template>
  <Modal :open="search !== null" size="sm" @close="emit('close')">
    <template #header>
      <h2 class="modal-title">🔎 {{ search?.isMine ? 'Votre recherche' : 'Recherche d\'adversaire' }}</h2>
    </template>

    <div v-if="search" class="details">
      <ErrorDisplay :errors="errors" />

      <div class="team">
        <img v-if="search.team.logoUrl" class="team-logo" :src="search.team.logoUrl" :alt="`Logo de ${search.team.name}`" />
        <span class="team-name">{{ search.team.name }}</span>
        <span v-if="!search.isMine" class="team-hint">cherche un adversaire</span>
      </div>

      <dl class="facts">
        <div class="fact">
          <dt>Jour</dt>
          <dd class="capitalize">{{ formatLongDate(search.date) }}</dd>
        </div>
        <div class="fact">
          <dt>Horaire</dt>
          <dd>{{ search.startTime }} – {{ search.endTime }} ({{ slotCountLabel(search) }}), convocation à {{ search.convocationTime }}</dd>
        </div>
        <div class="fact">
          <dt>Salle</dt>
          <dd>{{ venueLabel ?? '—' }}, arène {{ search.arenaNumber }}</dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <div class="footer-actions">
        <button
          v-if="canWithdraw"
          type="button"
          class="btn btn-danger"
          :disabled="isWithdrawing"
          @click="showConfirm = true"
        >
          {{ isWithdrawing ? 'Retrait…' : 'Retirer la recherche' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="emit('close')">Fermer</button>
      </div>
    </template>
  </Modal>

  <ConfirmModal
    :open="showConfirm"
    title="Retirer la recherche"
    message="Les autres équipes ne verront plus ces créneaux. Retirer la recherche ?"
    confirm-text="Retirer"
    :danger="true"
    @confirm="withdraw"
    @cancel="showConfirm = false"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.modal-title {
  margin: 0;
  font-size: $font-size-xl;
  color: $color-white;
}

.details {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.team {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.team-logo {
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  object-fit: cover;
  background: $color-bg-secondary;
}

.team-name {
  color: $color-white;
  font-weight: 700;
  font-size: $font-size-lg;
}

.team-hint {
  color: $color-text-secondary;
}

.facts {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin: 0;
}

.fact {
  display: flex;
  flex-direction: column;
  gap: 2px;

  dt {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  dd {
    margin: 0;
    color: $color-white;
  }
}

.capitalize {
  text-transform: capitalize;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.btn-secondary {
  @include btn-base($color-text-secondary);
}

.btn-danger {
  @include btn-base($color-danger);
}
</style>
