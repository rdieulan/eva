<script setup lang="ts">
// Making a team, the player its leader. Coming from a league team of the
// directory (?ligue=), the team is named after it, takes its logo, and is
// linked to it: whoever finds that league team then finds this team. The
// venue of its local league is proposed once the site has told it.
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';
import { createTeam, fetchLeagueTeam, fetchLeagueVenueProposal, fetchVenues } from '@/api';
import { validateTeamName } from '@shared/utils';
import { ERROR } from '@shared/constants';
import type { LeagueTeamSummary, LeagueVenueProposal, Venue } from '@shared/types';
import { formatVenueLabel } from '@/utils/venues';
import { formatMemberCount } from '@/utils/league';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';
import TeamLogo from '@/components/common/TeamLogo.vue';

const route = useRoute();
const router = useRouter();
const { hasTeam, refreshAccount } = useAuth();


// State
const venues = ref<Venue[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const { errors, setErrors, setErrorFromException, clearErrors } = useErrors();

// Form
const teamName = ref('');
const selectedVenueId = ref<string | null>(null);
// The league team the team is made from, when the player picked one
const leagueTeam = ref<LeagueTeamSummary | null>(null);
// The venue of its local league, once the site told it, and whether the player picked one already
const venueProposal = ref<LeagueVenueProposal | null>(null);
const hasPickedVenue = ref(false);

// The league team named by the address, its name the team's to start with
async function loadLeagueTeam() {
  const id = route.query.ligue;
  if (typeof id !== 'string' || !id) return;
  try {
    leagueTeam.value = await fetchLeagueTeam(id);
    teamName.value = leagueTeam.value.name;
    if (leagueTeam.value.team) setErrors([ERROR.leagueTeamTaken]);
    else void proposeVenue(id);
  } catch (e) {
    setErrorFromException(e, ERROR.leagueTeamNotFound);
  }
}

// The venue of the league team's local league, read from its tournaments on
// the site: it may come after the page shows, and never replaces a venue the
// player picked meanwhile. Without it, the player picks as before.
async function proposeVenue(leagueTeamId: string) {
  try {
    const proposal = await fetchLeagueVenueProposal(leagueTeamId);
    if (!proposal || hasPickedVenue.value) return;
    venueProposal.value = proposal;
    selectedVenueId.value = proposal.venueId;
  } catch {
    // No proposal: the field stays as the player leaves it
  }
}

// Load venues
onMounted(async () => {
  // Redirect if already has a team
  if (hasTeam.value) {
    router.replace('/team');
    return;
  }

  try {
    const [loadedVenues] = await Promise.all([fetchVenues(), loadLeagueTeam()]);
    venues.value = loadedVenues;
  } catch (e) {
    console.error('Error loading venues:', e);
  } finally {
    isLoading.value = false;
  }
});

// Submit form
async function handleSubmit() {
  const validation = validateTeamName(teamName.value);
  if (validation !== true) {
    setErrors(validation);
    return;
  }

  isSubmitting.value = true;
  clearErrors();

  try {
    const created = await createTeam({
      name: teamName.value.trim(),
      venueId: selectedVenueId.value,
      leagueTeamId: leagueTeam.value?.id ?? null,
    });

    // Refresh account data to update teamId and permissions
    await refreshAccount();

    // The team page says so when the league logo could not come along
    router.push(created.logoCopied === false ? { path: '/team', query: { logo: 'manquant' } } : '/team');
  } catch (e) {
    setErrorFromException(e, ERROR.teamCreationFailed);
  } finally {
    isSubmitting.value = false;
  }
}

// Go back
function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="create-team-page">
    <div class="create-team-card">
      <h1>Créer une équipe</h1>
      <p class="description">
        Tu deviens le leader de l'équipe, avec toutes les permissions.
      </p>

      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Chargement...</p>
      </div>

      <form v-else @submit.prevent="handleSubmit" class="create-form">
        <ErrorDisplay :errors="errors" />

        <div v-if="leagueTeam" class="league-team">
          <TeamLogo :name="leagueTeam.name" :logo-url="leagueTeam.logoUrl" :size="56" />
          <div class="league-team-text">
            <strong>{{ leagueTeam.name }}</strong>
            <span>Équipe de ligue · {{ formatMemberCount(leagueTeam.memberCount) }}</span>
            <span>{{ leagueTeam.logoUrl ? 'Son logo est repris pour ton équipe.' : 'Elle n\'a pas de logo : tu pourras en ajouter un.' }}</span>
          </div>
        </div>

        <div class="form-group">
          <label for="team-name">Nom de l'équipe *</label>
          <input
            id="team-name"
            v-model="teamName"
            type="text"
            placeholder="Nom de ton équipe"
            :disabled="isSubmitting"
            autofocus
          />
        </div>

        <div class="form-group">
          <label for="team-venue">Salle affiliée</label>
          <select id="team-venue" v-model="selectedVenueId" :disabled="isSubmitting" @change="hasPickedVenue = true">
            <option :value="null">Non spécifiée</option>
            <option v-for="venue in venues" :key="venue.id" :value="venue.id">
              {{ formatVenueLabel(venue) }}
            </option>
          </select>
          <p v-if="venueProposal && selectedVenueId === venueProposal.venueId" class="venue-hint">
            La salle de sa ligue sur competitive.eva.gg ({{ venueProposal.leagueName }})
          </p>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="goBack" :disabled="isSubmitting">
            Annuler
          </button>
          <button type="submit" class="btn-create" :disabled="isSubmitting || !!leagueTeam?.team">
            {{ isSubmitting ? 'Création...' : 'Créer l\'équipe' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.create-team-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  width: 100%;
  padding: $spacing-lg;
  flex: 1;
}

.create-team-card {
  background: $color-bg-secondary;
  border: $border-thin solid $color-border;
  border-radius: $radius-lg;
  padding: $spacing-xl;
  max-width: 450px;
  width: 100%;

  h1 {
    margin: 0 0 $spacing-xs;
    color: $color-text-primary;
    font-size: $font-size-xl;
    text-align: center;
  }

  .description {
    margin: 0 0 $spacing-lg;
    color: $color-text-secondary;
    text-align: center;
    font-size: $font-size-sm;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid $color-border;
    border-top-color: $color-accent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

// The league team the team is made from
.league-team {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
}

.league-team-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
    background: $color-bg-tertiary;
    border: $border-thin solid $color-border;
    border-radius: $radius-md;
    color: $color-text-primary;
    font-size: $font-size-base;

    &:focus {
      outline: none;
      border-color: $color-accent;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.venue-hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-xs;
  overflow-wrap: anywhere;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.btn-cancel,
.btn-create {
  @include btn-base($color-accent);
}

.btn-cancel {
  @include btn-base($color-danger);
}

.btn-create {
  @include btn-base($color-success);
}
</style>
