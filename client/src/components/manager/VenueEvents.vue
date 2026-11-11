<script setup lang="ts">
// The events a venue's manager publishes in the venue's calendar, open to all,
// league teams or not and players alone: a night session, and what comes
// next. Offered to no team: the teams of the venue see them in their
// calendar and add them there if they wish.
import { computed, nextTick, onMounted, ref } from 'vue';
import type { VenueEventSummary } from '@shared/types';
import { ERROR } from '@shared/constants';
import { formatShortDay, toParisTime } from '@shared/utils';
import { createVenueEvent, deleteVenueEvent, fetchVenueEvents, updateVenueEvent } from '@/api';
import { describeTeamsAdding } from '@/utils/venue-publications';
import { useErrors } from '@/composables/useErrors';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import VenuePublicationFields from '@/components/manager/VenuePublicationFields.vue';
import VenuePublicationItem from '@/components/manager/VenuePublicationItem.vue';

const props = defineProps<{ venueId: string }>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const events = ref<VenueEventSummary[]>([]);
const isLoading = ref(true);
const isFormOpen = ref(false);
const isPublishing = ref(false);
const withdrawing = ref<VenueEventSummary | null>(null);
// The event being changed, in the form, rather than a new one
const editing = ref<VenueEventSummary | null>(null);
const formRef = ref<HTMLFormElement | null>(null);

const today = toParisTime(new Date()).day;

// The form
const title = ref('');
const date = ref(today);
const startTime = ref('21:00');
const endTime = ref('23:59');
const description = ref('');

const canPublish = computed(() => !!title.value.trim() && !!date.value && startTime.value < endTime.value);

async function load() {
  clearErrors();
  try {
    events.value = await fetchVenueEvents(props.venueId);
  } catch (error) {
    setErrorFromException(error, ERROR.venueEventsFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

// The form in sight, wherever the list was scrolled to
async function showForm() {
  isFormOpen.value = true;
  await nextTick();
  formRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function openForm() {
  editing.value = null;
  title.value = '';
  date.value = today;
  startTime.value = '21:00';
  endTime.value = '23:59';
  description.value = '';
  await showForm();
}

// The form on an event published, to change it
async function edit(event: VenueEventSummary) {
  editing.value = event;
  title.value = event.title;
  date.value = event.date;
  startTime.value = event.startTime;
  endTime.value = event.endTime;
  description.value = event.description ?? '';
  await showForm();
}

function closeForm() {
  isFormOpen.value = false;
  editing.value = null;
}

async function publish() {
  if (!canPublish.value || isPublishing.value) return;
  isPublishing.value = true;
  clearErrors();
  const changed = editing.value;
  const event = {
    title: title.value.trim(),
    date: date.value,
    startTime: startTime.value,
    endTime: endTime.value,
    description: description.value.trim() || null,
  };
  try {
    const saved = changed
      ? await updateVenueEvent(props.venueId, changed.id, event)
      : await createVenueEvent(props.venueId, event);
    events.value = [...events.value.filter(candidate => candidate.id !== saved.id), saved]
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    closeForm();
  } catch (error) {
    setErrorFromException(error, changed ? ERROR.venueEventUpdateFailed : ERROR.venueEventSaveFailed);
  } finally {
    isPublishing.value = false;
  }
}

async function withdraw() {
  const event = withdrawing.value;
  withdrawing.value = null;
  if (!event) return;
  clearErrors();
  try {
    await deleteVenueEvent(props.venueId, event.id);
    events.value = events.value.filter(candidate => candidate.id !== event.id);
  } catch (error) {
    setErrorFromException(error, ERROR.venueEventDeleteFailed);
  }
}

onMounted(load);
</script>

<template>
  <div class="venue-events">
    <div class="events-toolbar">
      <button v-if="!isFormOpen" type="button" class="btn-publish" @click="openForm">Publier un événement</button>
    </div>

    <form v-if="isFormOpen" ref="formRef" class="event-form" @submit.prevent="publish">
      <p v-if="editing" class="form-hint">Les équipes qui l'ont ajouté sont prévenues du changement, et leur calendrier suit.</p>

      <VenuePublicationFields
        v-model:title="title"
        v-model:date="date"
        v-model:start-time="startTime"
        v-model:end-time="endTime"
        v-model:description="description"
        :min-date="today"
        title-placeholder="Nocturne, soirée…"
        description-placeholder="Tarif, déroulé, à qui il s'adresse…"
      />

      <div class="form-actions">
        <button type="button" class="btn-neutral" @click="closeForm">Annuler</button>
        <button type="submit" class="btn-publish" :disabled="!canPublish || isPublishing">
          <template v-if="editing">{{ isPublishing ? 'Enregistrement…' : 'Enregistrer' }}</template>
          <template v-else>{{ isPublishing ? 'Publication…' : 'Publier' }}</template>
        </button>
      </div>
    </form>

    <ErrorDisplay :errors="errors" />

    <p v-if="isLoading" class="events-empty">Chargement…</p>
    <p v-else-if="!events.length" class="events-empty">Aucun événement à venir.</p>
    <ol v-else class="events-list">
      <VenuePublicationItem
        v-for="event in events"
        :key="event.id"
        subject="event"
        :title="event.title"
        :date="event.date"
        :start-time="event.startTime"
        :end-time="event.endTime"
        :outcome="describeTeamsAdding(event.teamsAdding)"
        :description="event.description"
        @edit="edit(event)"
        @withdraw="withdrawing = event"
      />
    </ol>

    <ConfirmModal
      :open="withdrawing !== null"
      title="Retirer l'événement"
      :message="withdrawing ? `Retirer « ${withdrawing.title} » du ${formatShortDay(withdrawing.date)} ? Il quitte aussi le calendrier des équipes qui l'avaient ajouté.` : ''"
      confirm-text="Retirer"
      :danger="true"
      @confirm="withdraw"
      @cancel="withdrawing = null"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.venue-events {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.events-toolbar {
  display: flex;
  gap: $spacing-sm;
}

.btn-publish {
  @include btn-base($color-event);
}

.btn-neutral {
  @include btn-base($color-text-secondary);
}

.event-form {
  --subject-color: #{$color-event};
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  max-width: 40rem;
  padding: $spacing-md;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-left: 4px solid $color-event;
  border-radius: $radius-lg;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.form-hint {
  margin: 0;
  color: $color-text-secondary;
}

.events-empty {
  margin: 0;
  color: $color-text-secondary;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
