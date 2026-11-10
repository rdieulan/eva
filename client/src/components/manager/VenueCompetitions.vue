<script setup lang="ts">
// The competitions a venue's manager publishes in the venue's calendar: the
// days of a division of its local league, and the events of the venue's own
// (a night session, a tournament). The manager gives the dates: those of a
// month past say nothing of the next ones.
import { computed, onMounted, ref, watch } from 'vue';
import type { VenueCompetitionView } from '@shared/types';
import { ERROR, VENUE_COMPETITION_TITLE_MAX } from '@shared/constants';
import { formatShortDay, toParisTime } from '@shared/utils';
import { createVenueCompetition, deleteVenueCompetition, fetchVenueCompetitions, fetchVenueDivisions } from '@/api';
import { useErrors } from '@/composables/useErrors';
import SubjectIcon from '@/components/common/SubjectIcon.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const props = defineProps<{ venueId: string }>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const competitions = ref<VenueCompetitionView[]>([]);
const divisionCount = ref(0);
const isLoading = ref(true);
const isFormOpen = ref(false);
const isPublishing = ref(false);
const withdrawing = ref<VenueCompetitionView | null>(null);

const today = toParisTime(new Date()).day;

// The form: a division's day, or an event of the venue's own
const kind = ref<'division' | 'event'>('division');
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
  && (kind.value === 'event' || divisionCount.value > 0));

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

async function openForm() {
  // The divisions may have changed on the board since the page opened
  try {
    divisionCount.value = (await fetchVenueDivisions(props.venueId)).divisionCount;
  } catch (error) {
    setErrorFromException(error, ERROR.divisionsFetchFailed);
  }
  if (division.value > divisionCount.value) division.value = 1;
  title.value = suggestedTitle.value;
  isFormOpen.value = true;
}

async function publish() {
  if (!canPublish.value || isPublishing.value) return;
  isPublishing.value = true;
  clearErrors();
  try {
    const published = await createVenueCompetition(props.venueId, {
      division: kind.value === 'division' ? division.value : null,
      title: title.value.trim(),
      date: date.value,
      startTime: startTime.value,
      endTime: endTime.value,
      description: description.value.trim() || null,
    });
    competitions.value = [...competitions.value, published]
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    isFormOpen.value = false;
    description.value = '';
  } catch (error) {
    setErrorFromException(error, ERROR.competitionSaveFailed);
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

// What the teams it went to said of it, in words
function answersOf({ answers }: VenueCompetitionView): string {
  const sent = answers.pending + answers.accepted + answers.refused;
  if (!sent) return 'Aucune équipe de l\'app n\'est concernée pour l\'instant.';
  const parts = [`Proposée à ${sent} équipe${sent > 1 ? 's' : ''}`];
  if (answers.accepted) parts.push(`${answers.accepted} l'${answers.accepted > 1 ? 'ont' : 'a'} ajoutée`);
  if (answers.refused) parts.push(`${answers.refused} refus`);
  if (answers.pending) parts.push(`${answers.pending} sans réponse`);
  return `${parts.join(' · ')}.`;
}

onMounted(load);
</script>

<template>
  <div class="venue-competitions">
    <div class="competitions-toolbar">
      <button v-if="!isFormOpen" type="button" class="btn-publish" @click="openForm">Publier une compétition</button>
    </div>

    <form v-if="isFormOpen" class="competition-form" @submit.prevent="publish">
      <div class="form-kinds" role="radiogroup" aria-label="Type de compétition">
        <button type="button" class="form-kind" :class="{ active: kind === 'division' }" :aria-checked="kind === 'division'" role="radio" @click="kind = 'division'">
          Journée de division
        </button>
        <button type="button" class="form-kind" :class="{ active: kind === 'event' }" :aria-checked="kind === 'event'" role="radio" @click="kind = 'event'">
          Événement de la salle
        </button>
      </div>

      <label v-if="kind === 'division'" class="form-field">
        <span>Division</span>
        <select v-if="divisionCount" v-model.number="division">
          <option v-for="number in divisionCount" :key="number" :value="number">Division {{ number }}</option>
        </select>
        <span v-else class="form-hint">Place d'abord les équipes dans leurs divisions, ci-dessus.</span>
      </label>

      <label class="form-field">
        <span>Titre</span>
        <input
          v-model="title"
          type="text"
          :maxlength="VENUE_COMPETITION_TITLE_MAX"
          :placeholder="kind === 'event' ? 'Nocturne, tournoi…' : ''"
        />
      </label>

      <div class="form-row">
        <label class="form-field">
          <span>Jour</span>
          <input v-model="date" type="date" :min="today" />
        </label>
        <label class="form-field">
          <span>Début</span>
          <input v-model="startTime" type="time" />
        </label>
        <label class="form-field">
          <span>Fin</span>
          <input v-model="endTime" type="time" />
        </label>
      </div>

      <label class="form-field">
        <span>Description (facultatif)</span>
        <textarea v-model="description" rows="2" placeholder="Format, horaires de convocation…"></textarea>
      </label>

      <div class="form-actions">
        <button type="button" class="btn-neutral" @click="isFormOpen = false">Annuler</button>
        <button type="submit" class="btn-publish" :disabled="!canPublish || isPublishing">
          {{ isPublishing ? 'Publication…' : 'Publier' }}
        </button>
      </div>
    </form>

    <ErrorDisplay :errors="errors" />

    <p v-if="isLoading" class="competitions-empty">Chargement…</p>
    <p v-else-if="!competitions.length" class="competitions-empty">Aucune compétition à venir.</p>
    <ol v-else class="competitions-list">
      <li v-for="competition in competitions" :key="competition.id" class="competition">
        <SubjectIcon subject="competition" size="24px" />
        <div class="competition-text">
          <div class="competition-head">
            <strong>{{ competition.title }}</strong>
            <span class="competition-kind">{{ competition.division ? `Division ${competition.division}` : 'Événement de la salle' }}</span>
          </div>
          <span class="competition-when">{{ formatShortDay(competition.date) }} · {{ competition.startTime }} – {{ competition.endTime }}</span>
          <span class="competition-answers">{{ answersOf(competition) }}</span>
          <span v-if="competition.description" class="competition-description">{{ competition.description }}</span>
        </div>
        <!-- //TODO(compétitions de salle) modifier une compétition publiée : on la retire et on la republie pour l'instant -->
        <button type="button" class="btn-withdraw" @click="withdrawing = competition">Retirer</button>
      </li>
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

.venue-competitions {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.competitions-toolbar {
  display: flex;
  gap: $spacing-sm;
}

// Publishing acts on the competitions: their colour
.btn-publish {
  @include btn-base($color-competition);
}

.btn-neutral {
  @include btn-base($color-text-secondary);
}

.btn-withdraw {
  @include btn-base($color-danger);
  padding: $spacing-xs $spacing-md;
  flex-shrink: 0;
}

.competition-form {
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

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  color: $color-text-secondary;
  font-size: $font-size-sm;

  input,
  select,
  textarea {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-secondary;
    border: $border-thin solid $color-border-light;
    border-radius: $radius-md;
    color: $color-text-primary;
    font: inherit;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-competition;
    }
  }
}

.form-hint {
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

.competition {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-left: 4px solid $color-competition;
  border-radius: $radius-lg;
}

.competition-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.competition-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: $spacing-xs $spacing-sm;

  strong {
    color: $color-text-primary;
    overflow-wrap: anywhere;
  }
}

.competition-kind {
  color: $color-competition;
  font-size: $font-size-sm;
  font-weight: 600;
}

.competition-when {
  color: $color-text-primary;
}

.competition-answers {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

.competition-description {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}
</style>
