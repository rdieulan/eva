<script setup lang="ts">
// The competitions a venue's manager publishes in the venue's calendar and
// offers its teams: the days of a division of its local league, and the
// venue's tournaments. The manager gives the dates: those of a month past
// say nothing of the next ones.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { VenueCompetitionView } from '@shared/types';
import { ERROR } from '@shared/constants';
import { competitionKind, formatShortDay, toParisTime } from '@shared/utils';
import {
  createVenueCompetition,
  deleteVenueCompetition,
  fetchVenueCompetitions,
  fetchVenueDivisions,
  updateVenueCompetition,
} from '@/api';
import { useErrors } from '@/composables/useErrors';
import { describeCompetitionAnswers } from '@/utils/venue-publications';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import VenuePublicationFields from '@/components/manager/VenuePublicationFields.vue';
import VenuePublicationItem from '@/components/manager/VenuePublicationItem.vue';

const props = defineProps<{ venueId: string }>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const competitions = ref<VenueCompetitionView[]>([]);
const divisionCount = ref(0);
const isLoading = ref(true);
const isFormOpen = ref(false);
const isPublishing = ref(false);
const withdrawing = ref<VenueCompetitionView | null>(null);
// The competition being changed, in the form, rather than a new one
const editing = ref<VenueCompetitionView | null>(null);
const formRef = ref<HTMLFormElement | null>(null);

const today = toParisTime(new Date()).day;

// The form: a division's day, or a tournament of the venue
const kind = ref<'division' | 'tournament'>('division');
const division = ref(1);
const title = ref('');
const date = ref(today);
const startTime = ref('20:00');
const endTime = ref('23:00');
const description = ref('');

// The title the form offers for a division's day, kept as the manager changes the division
const suggestedTitle = computed(() => (kind.value === 'division' ? `Journée de la Division ${division.value}` : ''));
watch(suggestedTitle, (suggestion, previous) => {
  if (!title.value || title.value === previous) title.value = suggestion;
});

const canPublish = computed(() => !!title.value.trim() && !!date.value && startTime.value < endTime.value
  && (kind.value === 'tournament' || divisionCount.value > 0));

async function load() {
  clearErrors();
  try {
    const [published, divisions] = await Promise.all([fetchVenueCompetitions(props.venueId), fetchVenueDivisions(props.venueId)]);
    competitions.value = published;
    divisionCount.value = divisions.divisionCount;
  } catch (error) {
    setErrorFromException(error, ERROR.competitionsFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

// The divisions may have changed on the board since the page opened
async function readDivisionCount() {
  try {
    divisionCount.value = (await fetchVenueDivisions(props.venueId)).divisionCount;
  } catch (error) {
    setErrorFromException(error, ERROR.divisionsFetchFailed);
  }
}

// The form in sight, wherever the list was scrolled to
async function showForm() {
  isFormOpen.value = true;
  await nextTick();
  formRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function openForm() {
  await readDivisionCount();
  editing.value = null;
  if (division.value > divisionCount.value) division.value = 1;
  title.value = suggestedTitle.value;
  date.value = today;
  startTime.value = '20:00';
  endTime.value = '23:00';
  description.value = '';
  await showForm();
}

// The form on a competition published, to change it
async function edit(competition: VenueCompetitionView) {
  await readDivisionCount();
  editing.value = competition;
  kind.value = competition.division ? 'division' : 'tournament';
  if (competition.division) division.value = competition.division;
  title.value = competition.title;
  date.value = competition.date;
  startTime.value = competition.startTime;
  endTime.value = competition.endTime;
  description.value = competition.description ?? '';
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
  const competition = {
    division: kind.value === 'division' ? division.value : null,
    title: title.value.trim(),
    date: date.value,
    startTime: startTime.value,
    endTime: endTime.value,
    description: description.value.trim() || null,
  };
  try {
    const saved = changed
      ? await updateVenueCompetition(props.venueId, changed.id, competition)
      : await createVenueCompetition(props.venueId, competition);
    competitions.value = [...competitions.value.filter(candidate => candidate.id !== saved.id), saved]
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    closeForm();
  } catch (error) {
    setErrorFromException(error, changed ? ERROR.competitionUpdateFailed : ERROR.competitionSaveFailed);
  } finally {
    isPublishing.value = false;
  }
}

async function withdraw() {
  const competition = withdrawing.value;
  withdrawing.value = null;
  if (!competition) return;
  clearErrors();
  try {
    await deleteVenueCompetition(props.venueId, competition.id);
    competitions.value = competitions.value.filter(candidate => candidate.id !== competition.id);
  } catch (error) {
    setErrorFromException(error, ERROR.competitionDeleteFailed);
  }
}

onMounted(load);
</script>

<template>
  <div class="venue-competitions">
    <div class="competitions-toolbar">
      <button v-if="!isFormOpen" type="button" class="btn-publish" @click="openForm">Publier une compétition</button>
    </div>

    <form v-if="isFormOpen" ref="formRef" class="competition-form" @submit.prevent="publish">
      <p v-if="editing" class="form-hint">
        Les équipes qui l'ont reçue sont prévenues du changement, et celles qui l'ont ajoutée voient leur calendrier suivre.
      </p>

      <div class="form-kinds" role="radiogroup" aria-label="Type de compétition">
        <button type="button" class="form-kind" :class="{ active: kind === 'division' }" :aria-checked="kind === 'division'" role="radio" @click="kind = 'division'">
          Journée de division
        </button>
        <button type="button" class="form-kind" :class="{ active: kind === 'tournament' }" :aria-checked="kind === 'tournament'" role="radio" @click="kind = 'tournament'">
          Tournoi
        </button>
      </div>

      <label v-if="kind === 'division'" class="form-field">
        <span>Division</span>
        <select v-if="divisionCount" v-model.number="division">
          <option v-for="number in divisionCount" :key="number" :value="number">Division {{ number }}</option>
        </select>
        <span v-else class="form-hint">Place d'abord les équipes dans leurs divisions, ci-dessus.</span>
      </label>

      <VenuePublicationFields
        v-model:title="title"
        v-model:date="date"
        v-model:start-time="startTime"
        v-model:end-time="endTime"
        v-model:description="description"
        :min-date="today"
        :title-placeholder="kind === 'tournament' ? 'Le nom du tournoi' : ''"
        description-placeholder="Format, horaires de convocation…"
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

    <p v-if="isLoading" class="competitions-empty">Chargement…</p>
    <p v-else-if="!competitions.length" class="competitions-empty">Aucune compétition à venir.</p>
    <ol v-else class="competitions-list">
      <VenuePublicationItem
        v-for="competition in competitions"
        :key="competition.id"
        subject="competition"
        :title="competition.title"
        :kind="competitionKind(competition)"
        :date="competition.date"
        :start-time="competition.startTime"
        :end-time="competition.endTime"
        :outcome="describeCompetitionAnswers(competition.answers)"
        :description="competition.description"
        @edit="edit(competition)"
        @withdraw="withdrawing = competition"
      />
    </ol>

    <ConfirmModal
      :open="withdrawing !== null"
      title="Retirer la compétition"
      :message="withdrawing ? `Retirer « ${withdrawing.title} » du ${formatShortDay(withdrawing.date)} ?` : ''"
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
@use '@/styles/forms' as *;

@include subject-color-classes;

.venue-competitions {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.competitions-toolbar {
  display: flex;
  gap: $spacing-sm;
}

.btn-publish {
  @include btn-base($color-competition);
}

.btn-neutral {
  @include btn-base($color-text-secondary);
}

.competition-form {
  --subject-color: #{$color-competition};
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  max-width: 40rem;
  padding: $spacing-md;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-left: 4px solid $color-competition;
  border-radius: $radius-lg;
}

.form-kinds {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.form-kind {
  padding: $spacing-xs $spacing-md;
  background: transparent;
  border: $border-thin solid $color-border-light;
  border-radius: 999px;
  color: $color-text-secondary;
  font: inherit;
  cursor: pointer;

  &.active {
    border-color: $color-competition;
    background: with-alpha($color-competition, 0.12);
    color: $color-text-primary;
  }
}

.form-field {
  @include labelled-field($color-competition);
}

.form-hint {
  margin: 0;
  color: $color-text-secondary;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.competitions-empty {
  margin: 0;
  color: $color-text-secondary;
}

.competitions-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
