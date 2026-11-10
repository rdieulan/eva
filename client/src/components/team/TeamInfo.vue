<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Venue } from '@shared/types';
import {
  AVAILABILITY_HORIZON_MAX_DAYS,
  AVAILABILITY_HORIZON_MIN_DAYS,
  ERROR,
  TEAM_FAVORITE_VENUES_MAX,
  TEAM_LOGO_MIME_TYPES,
} from '@shared/constants';
import SvgIcon from '@/components/common/SvgIcon.vue';
import TeamLogo from '@/components/common/TeamLogo.vue';
import VenueChecklist from '@/components/common/VenueChecklist.vue';
import { formatVenueLabel } from '@/utils/venues';

interface TeamData {
  id: string;
  name: string;
  logoUrl: string | null;
  venueId?: string;
  favoriteVenueIds: string[];
  availabilityHorizonDays: number;
  leader: { id: string; name: string } | null;
}

const props = defineProps<{
  team: TeamData;
  venues: Venue[];
  canManageTeam: boolean;
  isLeader: boolean;
}>();

const emit = defineEmits<{
  save: [data: { name: string; venueId: string | null; favoriteVenueIds: string[]; availabilityHorizonDays: number }];
  uploadLogo: [file: File];
  removeLogo: [];
  deleteTeam: [];
  leaveTeam: [];
}>();

// What the file picker offers by default; the server checks the real content anyway
const LOGO_ACCEPT = TEAM_LOGO_MIME_TYPES.join(',');

const logoInput = ref<HTMLInputElement | null>(null);

function pickLogo() {
  logoInput.value?.click();
}

function handleLogoChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Reset so choosing the same file again still fires a change
  input.value = '';
  if (file) emit('uploadLogo', file);
}

// The venue the team is affiliated with, when it is known
const teamVenue = computed(() => props.venues.find(v => v.id === props.team.venueId) ?? null);

// Computed venue name
const venueName = computed(() => {
  if (!props.team.venueId) return 'Non affiliée';
  return teamVenue.value ? formatVenueLabel(teamVenue.value) : 'Inconnue';
});

// The favorite venues as named in the display, in the team's order
const favoriteVenueNames = computed(() =>
  props.team.favoriteVenueIds
    .map(id => props.venues.find(v => v.id === id))
    .filter((venue): venue is Venue => venue !== undefined)
    .map(formatVenueLabel),
);

// Edit mode state
const isEditing = ref(false);
const editName = ref('');
const editVenueId = ref<string | null>(null);
const editFavoriteVenueIds = ref<string[]>([]);
// An empty field reads as an empty string, whatever its type
const editHorizonDays = ref<number | ''>(0);

// Whole days, within the bounds the server keeps too
const isHorizonValid = computed(() =>
  Number.isInteger(editHorizonDays.value)
    && Number(editHorizonDays.value) >= AVAILABILITY_HORIZON_MIN_DAYS
    && Number(editHorizonDays.value) <= AVAILABILITY_HORIZON_MAX_DAYS,
);

// Start editing
function startEdit() {
  editName.value = props.team.name;
  editVenueId.value = props.team.venueId ?? null;
  editFavoriteVenueIds.value = [...props.team.favoriteVenueIds];
  editHorizonDays.value = props.team.availabilityHorizonDays;
  isEditing.value = true;
}

// Cancel editing
function cancelEdit() {
  isEditing.value = false;
}

// Save changes
function saveChanges() {
  if (!isHorizonValid.value) return;
  emit('save', {
    name: editName.value,
    venueId: editVenueId.value,
    favoriteVenueIds: editFavoriteVenueIds.value,
    availabilityHorizonDays: Number(editHorizonDays.value),
  });
  isEditing.value = false;
}
</script>

<template>
  <section class="team-info">
    <div class="section-header">
      <h2>Informations</h2>
      <button v-if="canManageTeam && !isEditing" class="btn-edit" @click="startEdit">
        <SvgIcon name="edit" />
        Modifier
      </button>
    </div>

    <!-- Logo: shown to everyone, changed by whoever manages the team -->
    <div class="team-logo">
      <TeamLogo :name="team.name" :logo-url="team.logoUrl" :size="72" />

      <div v-if="canManageTeam" class="team-logo-actions">
        <input
          ref="logoInput"
          class="team-logo-input"
          type="file"
          :accept="LOGO_ACCEPT"
          @change="handleLogoChosen"
        />
        <button type="button" class="btn-logo" @click="pickLogo">
          {{ team.logoUrl ? 'Changer le logo' : 'Ajouter un logo' }}
        </button>
        <button v-if="team.logoUrl" type="button" class="btn-logo btn-logo--remove" @click="emit('removeLogo')">
          Retirer
        </button>
      </div>
    </div>

    <div v-if="isEditing" class="edit-form">
      <div class="form-group">
        <label>Nom de l'équipe</label>
        <input v-model="editName" type="text" placeholder="Nom de l'équipe" />
      </div>
      <div class="form-group">
        <label>Salle affiliée</label>
        <select v-model="editVenueId">
          <option :value="null">Non affiliée</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">
            {{ formatVenueLabel(venue) }}
          </option>
        </select>
      </div>
      <VenueChecklist
        v-model="editFavoriteVenueIds"
        :venues="venues"
        :max="TEAM_FAVORITE_VENUES_MAX"
        :legend="`Salles favorites (${TEAM_FAVORITE_VENUES_MAX} au plus)`"
      />
      <div class="form-group">
        <label for="team-horizon">Dispos demandées sur</label>
        <div class="form-inline">
          <input
            id="team-horizon"
            v-model.number="editHorizonDays"
            class="form-days"
            type="number"
            inputmode="numeric"
            :min="AVAILABILITY_HORIZON_MIN_DAYS"
            :max="AVAILABILITY_HORIZON_MAX_DAYS"
            step="1"
            aria-describedby="team-horizon-hint"
          />
          <span>jours</span>
        </div>
        <p id="team-horizon-hint" class="form-hint" :class="{ invalid: !isHorizonValid }">
          {{ isHorizonValid
            ? 'L\'accueil rappelle à chaque joueur les jours sans dispos sur cette période, aujourd\'hui compris.'
            : ERROR.availabilityHorizonInvalid }}
        </p>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" @click="cancelEdit">Annuler</button>
        <button class="btn-save" :disabled="!isHorizonValid" @click="saveChanges">Enregistrer</button>
      </div>
    </div>

    <div v-else class="info-display">
      <div class="info-item">
        <label>Nom</label>
        <span>{{ team.name }}</span>
      </div>
      <div class="info-item">
        <label>Salle affiliée</label>
        <span>
          {{ venueName }}
          <a
            v-if="teamVenue?.discord"
            class="venue-link"
            :href="teamVenue.discord"
            target="_blank"
            rel="noopener noreferrer"
          >Discord</a>
          <RouterLink
            v-if="teamVenue"
            class="venue-link"
            :to="{ name: 'venue-board', params: { slug: teamVenue.slug } }"
            title="Le tableau public des recherches de la salle, à partager"
          >Scrims</RouterLink>
        </span>
      </div>
      <div class="info-item">
        <label>Salles favorites</label>
        <span v-if="favoriteVenueNames.length === 0" class="info-empty">Aucune</span>
        <span v-else>{{ favoriteVenueNames.join(', ') }}</span>
      </div>
      <div class="info-item">
        <label>Dispos demandées sur</label>
        <span>{{ team.availabilityHorizonDays }} jours</span>
      </div>
      <div class="info-item">
        <label>Leader</label>
        <span>{{ team.leader?.name ?? '—' }}</span>
      </div>

      <!-- Delete team button (Leader only) -->
      <button
        v-if="isLeader"
        class="btn-delete-team"
        @click="$emit('deleteTeam')"
      >
        <SvgIcon name="trash" />
        Supprimer l'équipe
      </button>

      <!-- Leave team button (Non-leader members only) -->
      <button
        v-if="!isLeader"
        class="btn-leave-team"
        @click="$emit('leaveTeam')"
      >
        <SvgIcon name="close" />
        Quitter l'équipe
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.team-info {
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  height: fit-content;
}

.team-logo {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-md;
}

.team-logo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

// Driven by the button next to it; the native control stays out of the way
.team-logo-input {
  display: none;
}

.btn-logo {
  @include btn-base($color-accent);
  padding: $spacing-xs $spacing-md;
  font-size: $font-size-sm;

  &--remove {
    @include btn-base($color-danger);
    padding: $spacing-xs $spacing-md;
    font-size: $font-size-sm;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  h2 {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-white;
  }
}

.btn-edit {
  @include btn-base($color-edit);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  input, select {
    padding: $spacing-sm $spacing-md;
    background: $color-bg-secondary;
    border: $border-thin solid $color-border-light;
    border-radius: $radius-md;
    color: $color-white;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

// A number and its unit on one line
.form-inline {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  span {
    color: $color-text-primary;
  }
}

.form-group .form-days {
  width: 6rem;
}

.form-hint {
  margin: 0;
  font-size: $font-size-xs;
  color: $color-text-secondary;

  &.invalid {
    color: $color-danger;
  }
}

.form-actions {
  display: flex;
  gap: $spacing-sm;
  justify-content: flex-end;
}

.btn-cancel {
  @include btn-base($color-text-secondary);
}

.btn-save {
  @include btn-base($color-success);
}

.info-display {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.venue-link {
  margin-left: $spacing-sm;
  padding: 2px 8px;
  border-radius: $radius-sm;
  background: with-alpha($color-accent, 0.2);
  color: $color-accent;
  font-size: $font-size-xs;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    background: with-alpha($color-accent, 0.35);
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  label {
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  span {
    font-size: $font-size-base;
    color: $color-white;
  }

  .info-empty {
    color: $color-text-secondary;
    font-style: italic;
  }
}

.btn-delete-team,
.btn-leave-team {
  @include btn-base($color-danger);
  margin-top: $spacing-lg;
  width: fit-content;
}
</style>
