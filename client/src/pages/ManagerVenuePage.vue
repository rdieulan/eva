<script setup lang="ts">
// The Ma salle tab of the manager's space: the venue's public information, as
// eva.gg publishes it, shown greyed since it is changed there, with a way to
// read it again once the manager did; and the channel of the venue's own
// Discord its publications are to go to
import { ref, watch } from 'vue';
import type { DiscordChannelStatus, VenueSettings } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchVenueSettings, linkVenueDiscord, refreshVenueSettings, unlinkVenueDiscord } from '@/api';
import { useErrors } from '@/composables/useErrors';
import { useManagedVenues } from '@/composables/useManagedVenues';
import ManagerShell from '@/components/manager/layout/ManagerShell.vue';
import ManagerSection from '@/components/manager/layout/ManagerSection.vue';
import DiscordChannel from '@/components/common/DiscordChannel.vue';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const { venue } = useManagedVenues();
const { errors, setErrorFromException, clearErrors } = useErrors();
const settings = ref<VenueSettings | null>(null);
const isRefreshing = ref(false);
const refreshedAt = ref<string | null>(null);

// What eva.gg publishes of a venue, in the order a player reads it
const FIELDS: { key: keyof VenueSettings; label: string }[] = [
  { key: 'name', label: 'Nom' },
  { key: 'city', label: 'Ville' },
  { key: 'address', label: 'Adresse' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'arenaCount', label: 'Arènes' },
  { key: 'website', label: 'Site' },
  { key: 'discord', label: 'Discord' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x', label: 'X' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitch', label: 'Twitch' },
];

// The section says what the channel is for: the status, only where it stands
const DISCORD_SAYS = {
  linked: 'Un salon du serveur de la salle est relié.',
  broken: 'Discord a refusé le dernier message : le webhook a sans doute été supprimé. Colle une nouvelle adresse pour reprendre.',
  none: 'Aucun salon n\'est relié pour l\'instant.',
};

async function load(venueId: string) {
  settings.value = null;
  refreshedAt.value = null;
  clearErrors();
  try {
    settings.value = await fetchVenueSettings(venueId);
  } catch (error) {
    setErrorFromException(error, ERROR.venueSettingsFetchFailed);
  }
}

watch(() => venue.value?.id, venueId => { if (venueId) void load(venueId); }, { immediate: true });

async function refresh() {
  if (!settings.value || isRefreshing.value) return;
  isRefreshing.value = true;
  clearErrors();
  try {
    settings.value = await refreshVenueSettings(settings.value.id);
    refreshedAt.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    setErrorFromException(error, ERROR.venueRefreshFailed);
  } finally {
    isRefreshing.value = false;
  }
}

function discordChanged(status: DiscordChannelStatus) {
  if (settings.value) settings.value.discordChannel = status;
}
</script>

<template>
  <ManagerShell>
    <ManagerSection title="Informations publiques">
      <template #intro>
        Ce qu'eva.gg publie de ta salle, tel que l'appli le montre aux joueurs. Ces informations se changent sur eva.gg :
        actualise ensuite pour les reprendre ici.
      </template>

      <ErrorDisplay :errors="errors" />
      <p v-if="!settings && !errors.length" class="venue-note">Chargement…</p>
      <template v-if="settings">
        <div class="venue-fields">
          <label v-for="field in FIELDS" :key="field.key" class="venue-field">
            <span>{{ field.label }}</span>
            <input type="text" :value="settings[field.key] ?? ''" placeholder="Aucun" disabled />
          </label>
        </div>

        <div class="venue-refresh">
          <button v-if="settings.isFromEva" type="button" class="btn-refresh" :disabled="isRefreshing" @click="refresh">
            {{ isRefreshing ? 'Lecture sur eva.gg…' : 'Actualiser depuis eva.gg' }}
          </button>
          <span v-if="refreshedAt" class="venue-note">Relue sur eva.gg à {{ refreshedAt }}.</span>
          <span v-if="!settings.isFromEva" class="venue-note">
            Cette salle n'est pas listée par eva.gg : l'administration la tient à jour.
          </span>
        </div>
      </template>
    </ManagerSection>

    <ManagerSection title="Discord de la salle">
      <template #intro>
        Le salon de ton serveur Discord où partiront les événements que tu publies ici : tu n'as pas à les publier deux fois.
      </template>
      <!-- //TODO(salle : publier sur son Discord) le salon se relie, mais rien n'y part encore : l'envoi des publications de la salle reste à construire -->
      <DiscordChannel
        v-if="settings"
        :status="settings.discordChannel"
        :can-manage="true"
        :says="DISCORD_SAYS"
        :link="url => linkVenueDiscord(settings!.id, url)"
        :unlink="() => unlinkVenueDiscord(settings!.id)"
        @changed="discordChanged"
      />
    </ManagerSection>
  </ManagerShell>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;

.venue-note {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}

// Two columns of fields on a wide screen, one on a phone
.venue-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-sm $spacing-md;

  @include mobile-lg {
    grid-template-columns: minmax(0, 1fr);
  }
}

.venue-field {
  display: flex;
  flex-direction: column;
  gap: 2px;

  span {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }

  // Greyed: eva.gg holds them
  input {
    padding: $spacing-sm $spacing-md;
    background: with-alpha($color-bg-secondary, 0.5);
    border: $border-thin solid $color-border;
    border-radius: $radius-md;
    color: $color-text-secondary;
    font: inherit;
    text-overflow: ellipsis;
    cursor: default;

    &::placeholder {
      color: $color-text-muted;
      font-style: italic;
    }
  }
}

.venue-refresh {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-sm $spacing-md;
}

.btn-refresh {
  @include btn-base($color-accent);
}
</style>
