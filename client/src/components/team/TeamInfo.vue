<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Venue } from '@shared/types';
import { TEAM_LOGO_MIME_TYPES, TEAM_FAVORITE_VENUES_MAX } from '@shared/constants';
import SvgIcon from '@/components/common/SvgIcon.vue';
import VenueChecklist from '@/components/common/VenueChecklist.vue';
import { formatVenueLabel } from '@/utils/venues';

interface TeamData {
  id: string;
  name: string;
  logoUrl: string | null;
  venueId?: string;
  favoriteVenueIds: string[];
  leader: { id: string; name: string } | null;
}

const props = defineProps<{
  team: TeamData;
  venues: Venue[];
  canManageTeam: boolean;
  isLeader: boolean;
}>();

const emit = defineEmits<{
  save: [data: { name: string; venueId: string | null; favoriteVenueIds: string[] }];
  uploadLogo: [file: File];
  removeLogo: [];
  deleteTeam: [];
  leaveTeam: [];
}>();

// What the file picker offers by default; the server checks the real content anyway
const LOGO_ACCEPT = TEAM_LOGO_MIME_TYPES.join(',');

// Letters standing in for a team without a logo
const teamInitials = computed(() =>
  props.team.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join(''),
);

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

// Start editing
function startEdit() {
  editName.value = props.team.name;
  editVenueId.value = props.team.venueId ?? null;
  editFavoriteVenueIds.value = [...props.team.favoriteVenueIds];
  isEditing.value = true;
}

// Cancel editing
function cancelEdit() {
  isEditing.value = false;
}

// Save changes
function saveChanges() {
  emit('save', {
    name: editName.value,
    venueId: editVenueId.value,
    favoriteVenueIds: editFavoriteVenueIds.value,
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
      <img v-if="team.logoUrl" class="team-logo-image" :src="team.logoUrl" :alt="`Logo de ${team.name}`" />
      <div v-else class="team-logo-placeholder" aria-hidden="true">{{ teamInitials }}</div>

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
      <div class="form-actions">
        <button class="btn-cancel" @click="cancelEdit">Annuler</button>
        <button class="btn-save" @click="saveChanges">Enregistrer</button>
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
        </span>
      </div>
      <div class="info-item">
        <label>Salles favorites</label>
        <span v-if="favoriteVenueNames.length === 0" class="info-empty">Aucune</span>
        <span v-else>{{ favoriteVenueNames.join(', ') }}</span>
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
  border: 1px solid $color-border-light;
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

.team-logo-image,
.team-logo-placeholder {
  width: 72px;
  height: 72px;
  border-radius: $radius-md;
  border: 1px solid $color-border-light;
  flex-shrink: 0;
}

.team-logo-image {
  object-fit: cover;
  background: $color-bg-secondary;
}

.team-logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($color-accent, 0.15);
  color: $color-accent;
  font-size: 1.5rem;
  font-weight: 700;
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
    border: 1px solid $color-border-light;
    border-radius: $radius-md;
    color: $color-white;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }
  }
}

.form-actions {
  display: flex;
  gap: $spacing-sm;
  justify-content: flex-end;
}

.btn-cancel {
  @include btn-base($color-danger);
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
  background: rgba($color-accent, 0.2);
  color: $color-accent;
  font-size: $font-size-xs;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    background: rgba($color-accent, 0.35);
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
