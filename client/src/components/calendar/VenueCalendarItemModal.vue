<script setup lang="ts">
import { ref, watch } from 'vue';
import type { VenueCalendarItem } from '@shared/types';
import { getEventTypeClass, getEventTypeTitle } from '@/utils/calendar';
import { competitionKind, describeCompetitionAnswers, describeTeamsAdding } from '@/utils/venue-publications';
import Modal from '@/components/common/Modal.vue';
import EventSheet from '@/components/calendar/EventSheet.vue';

// What a venue's calendar holds, looked at: a competition and what its teams
// answered, an event and how many teams added it, or a match and its teams,
// on the sheet of an event (see EventSheet)
const props = defineProps<{
  item: VenueCalendarItem | null; // Open while set
}>();

const emit = defineEmits<{
  close: [];
}>();

// The item stays on screen while the window fades out
const shown = ref<VenueCalendarItem | null>(props.item);
watch(() => props.item, item => {
  if (item) shown.value = item;
});
</script>

<template>
  <Modal :open="item !== null" size="md" @close="emit('close')">
    <template #header>
      <span v-if="shown" class="sheet-kind" :class="getEventTypeClass(shown.type)">{{ getEventTypeTitle(shown.type) }}</span>
    </template>

    <EventSheet
      v-if="shown"
      :title="shown.title"
      :date="shown.date"
      :start-time="shown.startTime"
      :end-time="shown.endTime"
      :description="shown.type === 'MATCH' ? null : shown.description"
    >
      <template #hours>
        <span v-if="shown.type === 'MATCH' && shown.slotCount" class="detail-tag">
          {{ shown.slotCount > 1 ? `${shown.slotCount} créneaux` : '1 créneau' }}
        </span>
      </template>

      <template #details>
        <template v-if="shown.type === 'COMPETITION'">
          <div class="detail-row">
            <span class="detail-label">🏆 Compétition</span>
            <span class="detail-value">{{ competitionKind(shown) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">📨 Réponses</span>
            <span class="detail-value">{{ describeCompetitionAnswers(shown.answers) }}</span>
          </div>
        </template>

        <div v-else-if="shown.type === 'EVENT'" class="detail-row">
          <span class="detail-label">👥 Équipes</span>
          <span class="detail-value">{{ describeTeamsAdding(shown.teamsAdding) }}</span>
        </div>

        <template v-else>
          <div class="detail-row">
            <span class="detail-label">👥 {{ shown.teams.length > 1 ? 'Équipes' : 'Équipe' }}</span>
            <span class="detail-value">{{ shown.teams.map(team => team.name).join(', ') }}</span>
          </div>
          <div v-if="shown.arenaNumber" class="detail-row">
            <span class="detail-label">📍 Arène</span>
            <span class="detail-value">Arène {{ shown.arenaNumber }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🤝 Origine</span>
            <span class="detail-value">{{ shown.fromMatchmaking ? 'Le matchmaking' : 'Saisi par l\'équipe' }}</span>
          </div>
        </template>
      </template>
    </EventSheet>

    <template #footer>
      <div class="footer-actions">
        <button type="button" class="btn-close-sheet" @click="emit('close')">Fermer</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

// The kind of what is looked at, in its colour, as the event viewer shows it
.sheet-kind {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;

  @each $type, $color in $event-type-colors {
    &.event-type--#{$type} {
      color: $color;
    }
  }
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.btn-close-sheet {
  @include btn-base($color-text-secondary);
}
</style>
