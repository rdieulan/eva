<script setup lang="ts">
import { ref, watch } from 'vue';
import type { VenueEventView } from '@shared/types';
import { ERROR } from '@shared/constants';
import { addVenueEventToCalendar } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { getEventTypeTitle } from '@/utils/calendar';
import Modal from '@/components/common/Modal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import EventSheet from '@/components/calendar/EventSheet.vue';

// An event of the team's venue, open to all, the team has not added: its
// sheet, the dashed note of a thing not taken yet, as its row in the day, and
// for those who make the team's events, the button that adds it to the team's
// calendar, the team's own copy
const props = defineProps<{
  event: VenueEventView | null; // Open while set
  canAdd: boolean;
}>();

const emit = defineEmits<{
  close: [];
  added: []; // Now one of the team's events
}>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const isAdding = ref(false);

// The event stays on screen while the window fades out
const shown = ref<VenueEventView | null>(props.event);
watch(() => props.event, event => {
  if (!event) return;
  shown.value = event;
  clearErrors();
});

async function add() {
  const event = props.event;
  if (!event || isAdding.value) return;
  isAdding.value = true;
  clearErrors();
  try {
    await addVenueEventToCalendar(event.id);
    emit('added');
  } catch (error) {
    setErrorFromException(error, ERROR.venueEventAddFailed);
  } finally {
    isAdding.value = false;
  }
}
</script>

<template>
  <Modal :open="event !== null" size="md" @close="emit('close')">
    <template #header>
      <span class="sheet-kind">{{ getEventTypeTitle('EVENT') }} de la salle</span>
    </template>

    <div v-if="shown" class="venue-event">
      <EventSheet
        :title="shown.title"
        :date="shown.date"
        :start-time="shown.startTime"
        :end-time="shown.endTime"
        :description="shown.description"
      >
        <template #details>
          <div class="detail-row">
            <span class="detail-label">📍 Salle</span>
            <span class="detail-value">{{ shown.venueName }}</span>
          </div>
        </template>

        <p class="not-taken">
          Publié par la salle, ouvert à tous : il n'est pas encore dans le calendrier de l'équipe.
          <template v-if="!canAdd">Ceux qui gèrent ses événements peuvent l'y ajouter.</template>
        </p>
      </EventSheet>

      <ErrorDisplay :errors="errors" />
    </div>

    <template #footer>
      <div class="footer-actions">
        <button v-if="canAdd" type="button" class="btn-add" :disabled="isAdding" @click="add">
          {{ isAdding ? 'Ajout…' : 'Ajouter à notre calendrier' }}
        </button>
        <button type="button" class="btn-close-sheet" @click="emit('close')">Fermer</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

// The kind of the sheet, in the colour of the events, as the event viewer shows it
.sheet-kind {
  flex: 1;
  color: $color-event;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

.venue-event {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

// Not taken yet: dashed, as its row in the day
.not-taken {
  margin: 0;
  padding: $spacing-sm $spacing-md;
  border: 1px dashed with-alpha($color-event, 0.55);
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: 0.9rem;
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: $spacing-sm;
  width: 100%;
}

.btn-add {
  @include btn-base($color-event);
}

.btn-close-sheet {
  @include btn-base($color-text-secondary);
}
</style>
