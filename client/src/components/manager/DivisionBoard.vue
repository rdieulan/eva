<script setup lang="ts">
// The divisions of a venue's local league, as its manager arranges them: a
// column per division, the teams with their logo and name, moved from one to
// another by dragging them, or with their arrows on a touch screen.
// competitive.eva.gg tells a month's divisions only once it is drawn: the
// board starts from the last month drawn there, the manager moves the teams
// that went up or down, and saves. Only what is saved is used.
import { computed, onMounted, ref } from 'vue';
import type { DivisionPlace, LeagueTeamSummary } from '@shared/types';
import { ERROR, LEAGUE_DIVISIONS_MAX } from '@shared/constants';
import { fetchVenueDivisions, readVenueDivisions, saveVenueDivisions } from '@/api';
import { useErrors } from '@/composables/useErrors';
import TeamLogo from '@/components/common/TeamLogo.vue';
import LeagueTeamSearch from '@/components/team/LeagueTeamSearch.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const props = defineProps<{ venueId: string }>();

const { errors, setErrorFromException, clearErrors } = useErrors();
const isLoading = ref(true);
const isSaving = ref(false);
const isReading = ref(false);
const isDirty = ref(false);
const isAdding = ref(false);
// What the last action did, said once: a read from the site, a save
const note = ref<string | null>(null);

const divisionCount = ref(0);
// Every team of the board, column by column, each column in order
const places = ref<DivisionPlace[]>([]);

// The divisions from the top one, then the teams waiting to be placed
const columns = computed(() => [
  ...Array.from({ length: divisionCount.value }, (_, index) => ({ division: index + 1 as number | null, title: `Division ${index + 1}` })),
  { division: null as number | null, title: 'À placer' },
].map(column => ({ ...column, places: places.value.filter(place => place.division === column.division) })));

function changed(message: string | null = null) {
  isDirty.value = true;
  note.value = message;
}

async function load() {
  clearErrors();
  try {
    const divisions = await fetchVenueDivisions(props.venueId);
    divisionCount.value = divisions.divisionCount;
    places.value = divisions.places;
    isDirty.value = false;
  } catch (error) {
    setErrorFromException(error, ERROR.divisionsFetchFailed);
  } finally {
    isLoading.value = false;
  }
}

// A team moved into a column, before another of its teams or at its end
function move(leagueTeamId: string, division: number | null, beforeId: string | null) {
  const place = places.value.find(candidate => candidate.leagueTeam.id === leagueTeamId);
  if (!place || beforeId === leagueTeamId) return;
  const rest = places.value.filter(candidate => candidate.leagueTeam.id !== leagueTeamId);
  let index = beforeId ? rest.findIndex(candidate => candidate.leagueTeam.id === beforeId) : -1;
  if (index < 0) {
    const last = rest.map(candidate => candidate.division).lastIndexOf(division);
    index = last < 0 ? rest.length : last + 1;
  }
  rest.splice(index, 0, { ...place, division });
  places.value = rest;
  changed();
}

// The arrows of a card: to the division above (left) or below (right), "À placer" last
function shift(place: DivisionPlace, step: -1 | 1) {
  const keys = columns.value.map(column => column.division);
  const target = keys[keys.indexOf(place.division) + step];
  if (target !== undefined) move(place.leagueTeam.id, target, null);
}

function addDivision() {
  if (divisionCount.value >= LEAGUE_DIVISIONS_MAX) return;
  divisionCount.value += 1;
  changed();
}

// The last division goes; its teams wait to be placed again
function removeLastDivision() {
  const last = divisionCount.value;
  if (!last) return;
  places.value = places.value.map(place => (place.division === last ? { ...place, division: null } : place));
  divisionCount.value = last - 1;
  changed();
}

function addTeam(leagueTeam: LeagueTeamSummary) {
  isAdding.value = false;
  if (places.value.some(place => place.leagueTeam.id === leagueTeam.id)) return;
  places.value = [...places.value, { leagueTeam, division: null }];
  changed(`${leagueTeam.name} attend dans « À placer ».`);
}

function removeTeam(place: DivisionPlace) {
  places.value = places.value.filter(candidate => candidate !== place);
  changed();
}

// The last month drawn on the site: its divisions take the board, the teams
// added by hand and missing from it wait to be placed
async function readFromSite() {
  if (isReading.value) return;
  isReading.value = true;
  clearErrors();
  note.value = null;
  try {
    const read = await readVenueDivisions(props.venueId);
    const readIds = new Set(read.places.map(place => place.leagueTeam.id));
    const kept = places.value.filter(place => !readIds.has(place.leagueTeam.id)).map(place => ({ ...place, division: null }));
    divisionCount.value = read.divisionCount;
    places.value = [...read.places, ...kept];
    changed(`Repris de ${read.tournamentName} : déplace les équipes qui sont montées ou descendues, puis enregistre.`);
  } catch (error) {
    setErrorFromException(error, ERROR.divisionsReadFailed);
  } finally {
    isReading.value = false;
  }
}

async function save() {
  if (isSaving.value) return;
  isSaving.value = true;
  clearErrors();
  try {
    const saved = await saveVenueDivisions(props.venueId, {
      divisionCount: divisionCount.value,
      places: places.value.map(place => ({ leagueTeamId: place.leagueTeam.id, division: place.division })),
    });
    divisionCount.value = saved.divisionCount;
    places.value = saved.places;
    isDirty.value = false;
    note.value = 'Divisions enregistrées.';
  } catch (error) {
    setErrorFromException(error, ERROR.divisionsSaveFailed);
  } finally {
    isSaving.value = false;
  }
}

// Dragging: the team held, and where it would land
const dragged = ref<string | null>(null);
const dropTarget = ref<{ division: number | null; beforeId: string | null } | null>(null);

function onDragStart(event: DragEvent, place: DivisionPlace) {
  dragged.value = place.leagueTeam.id;
  event.dataTransfer?.setData('text/plain', place.leagueTeam.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

// Over a card: before it in its top half, before the next one in its bottom half
function onCardDragOver(event: DragEvent, division: number | null, index: number, columnPlaces: DivisionPlace[]) {
  if (!dragged.value) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const before = event.clientY < box.top + box.height / 2 ? columnPlaces[index] : columnPlaces[index + 1];
  dropTarget.value = { division, beforeId: before?.leagueTeam.id ?? null };
}

function onColumnDragOver(division: number | null) {
  if (!dragged.value) return;
  if (dropTarget.value?.division !== division) dropTarget.value = { division, beforeId: null };
}

function onDrop() {
  if (dragged.value && dropTarget.value) move(dragged.value, dropTarget.value.division, dropTarget.value.beforeId);
  onDragEnd();
}

function onDragEnd() {
  dragged.value = null;
  dropTarget.value = null;
}

onMounted(load);
</script>

<template>
  <section class="division-board">
    <div class="board-toolbar">
      <button type="button" class="btn-read" :disabled="isReading" @click="readFromSite">
        {{ isReading ? 'Lecture…' : 'Reprendre le dernier mois tiré sur competitive.eva.gg' }}
      </button>
      <button type="button" class="btn-neutral" :disabled="isAdding" @click="isAdding = true">Ajouter une équipe</button>
      <span class="toolbar-spacer"></span>
      <button type="button" class="btn-save" :disabled="!isDirty || isSaving" @click="save">
        {{ isSaving ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </div>

    <div v-if="isAdding" class="board-add">
      <LeagueTeamSearch autofocus placeholder="Le nom d'une équipe de ligue" @select="addTeam" />
      <button type="button" class="btn-neutral" @click="isAdding = false">Annuler</button>
    </div>

    <ErrorDisplay :errors="errors" />
    <p v-if="note" class="board-note" role="status">{{ note }}</p>

    <p v-if="isLoading" class="board-empty">Chargement…</p>

    <div v-else class="board-columns">
      <div
        v-for="column in columns"
        :key="String(column.division)"
        class="board-column"
        :class="{ 'board-column--unplaced': column.division === null, over: dragged && dropTarget?.division === column.division }"
        @dragover.prevent="onColumnDragOver(column.division)"
        @drop.prevent="onDrop"
      >
        <div class="column-head">
          <h3>{{ column.title }}</h3>
          <span class="column-count">{{ column.places.length }}</span>
        </div>

        <ul class="column-teams">
          <li
            v-for="(place, index) in column.places"
            :key="place.leagueTeam.id"
            class="team-card"
            :class="{
              dragged: dragged === place.leagueTeam.id,
              'drop-before': dragged && dropTarget?.division === column.division && dropTarget?.beforeId === place.leagueTeam.id,
            }"
            draggable="true"
            @dragstart="onDragStart($event, place)"
            @dragover.prevent.stop="onCardDragOver($event, column.division, index, column.places)"
            @dragend="onDragEnd"
          >
            <TeamLogo :name="place.leagueTeam.name" :logo-url="place.leagueTeam.logoUrl" :size="32" />
            <span class="team-name">
              {{ place.leagueTeam.name }}
              <span v-if="place.leagueTeam.team" class="team-on-app" :title="`Sur l'app : ${place.leagueTeam.team.name}`">Sur l'app</span>
            </span>
            <span class="team-actions">
              <button
                type="button"
                class="team-shift"
                :disabled="column === columns[0]"
                :aria-label="`Monter ${place.leagueTeam.name}`"
                @click="shift(place, -1)"
              >‹</button>
              <button
                type="button"
                class="team-shift"
                :disabled="column === columns[columns.length - 1]"
                :aria-label="`Descendre ${place.leagueTeam.name}`"
                @click="shift(place, 1)"
              >›</button>
              <button type="button" class="team-remove" :aria-label="`Retirer ${place.leagueTeam.name}`" @click="removeTeam(place)">×</button>
            </span>
          </li>
          <li v-if="!column.places.length" class="column-empty">
            {{ column.division === null ? 'Aucune équipe à placer' : 'Glisse des équipes ici' }}
          </li>
        </ul>
      </div>
    </div>

    <div class="board-divisions">
      <button type="button" class="btn-neutral" :disabled="divisionCount >= LEAGUE_DIVISIONS_MAX" @click="addDivision">Ajouter une division</button>
      <button type="button" class="btn-neutral" :disabled="!divisionCount" @click="removeLastDivision">Retirer la dernière division</button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.division-board {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.board-toolbar,
.board-divisions,
.board-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-sm;
}

.board-add {
  align-items: flex-start;

  > :first-child {
    flex: 1;
    min-width: 16rem;
  }
}

.toolbar-spacer {
  flex: 1;
}

// Reading the site is about the league: the colour of competitions
.btn-read {
  @include btn-base($color-competition);
}

.btn-neutral {
  @include btn-base($color-text-secondary);
}

.btn-save {
  @include btn-base($color-success);
}

.board-note {
  margin: 0;
  color: $color-text-primary;
}

.board-empty {
  margin: 0;
  color: $color-text-secondary;
}

.board-columns {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(14rem, 1fr);
  gap: $spacing-md;
  overflow-x: auto;
  padding-bottom: $spacing-xs;

  // On a phone, a column nearly the screen's width, one after the other
  @include mobile-lg {
    grid-auto-columns: 85%;
    scroll-snap-type: x mandatory;

    > * {
      scroll-snap-align: start;
    }
  }
}

.board-column {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  min-height: 12rem;
  padding: $spacing-md;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-top: 3px solid $color-competition;
  border-radius: $radius-lg;
  transition: border-color 0.15s, background 0.15s;

  // The teams waiting: no division's colour yet
  &--unplaced {
    border-top-color: $color-text-secondary;
    border-style: dashed;
    border-top-style: solid;
  }

  &.over {
    background: with-alpha($color-competition, 0.08);
    border-color: $color-competition;
  }
}

.column-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;

  h3 {
    margin: 0;
    font-size: $font-size-base;
    color: $color-text-primary;
  }
}

.column-count {
  min-width: 1.6em;
  padding: 0 $spacing-xs;
  border-radius: 999px;
  background: $color-border-light;
  color: $color-text-primary;
  font-size: $font-size-sm;
  text-align: center;
}

.column-teams {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
}

.team-card {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-xs $spacing-sm;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;
  cursor: grab;

  &.dragged {
    opacity: 0.4;
  }

  // Where the team held would land
  &.drop-before {
    box-shadow: 0 -3px 0 $color-competition;
  }
}

.team-name {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  color: $color-text-primary;
  font-weight: 600;
  overflow-wrap: break-word; // A long name breaks between its words, never inside a short one
}

// A league team with a team of ours: the team's colour
.team-on-app {
  color: $color-team;
  font-size: $font-size-xs;
  font-weight: 600;
}

.team-actions {
  display: flex;
  gap: 2px;
}

.team-shift,
.team-remove {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: transparent;
  border: $border-thin solid transparent;
  border-radius: $radius-sm;
  color: $color-text-secondary;
  font: inherit;
  font-size: $font-size-base;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: $color-border-light;
    color: $color-text-primary;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

.team-remove:hover:not(:disabled) {
  color: $color-danger;
}

.column-empty {
  padding: $spacing-md $spacing-sm;
  border: $border-thin dashed $color-border-light;
  border-radius: $radius-md;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  text-align: center;
}
</style>
