<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Venue } from '@shared/types';
import { SCRIM_SEARCH_VENUES_MAX, TEAM_FAVORITE_VENUES_MAX } from '@shared/constants';
import SvgIcon from '@/components/common/SvgIcon.vue';
import VenueChecklist from '@/components/common/VenueChecklist.vue';
import { formatVenueLabel, venueMatches, type MatchmakingVenues } from '@/utils/venues';

// The venues whose searches the matchmaking calendar shows, and where the
// team offers slots: a menu listing the team's affiliated venue first, then
// its favorites, then the rest of the network, a few of them ticked at once.
// A star beside a venue makes it a favorite of the team, or no longer one.
const props = defineProps<{
  venues: MatchmakingVenues;
  canEditFavorites: boolean; // The reader may change the team's favorites
  favoritesFull: boolean;    // The team has as many favorites as it may
  savingFavorites: boolean;  // A change of favorites is on its way
}>();

const venueIds = defineModel<string[]>({ required: true });

const emit = defineEmits<{
  'toggle-favorite': [venueId: string];
}>();

const isOpen = ref(false);
const query = ref('');
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const searchField = ref<HTMLInputElement | null>(null);

const ordered = computed(() => [
  ...(props.venues.affiliated ? [props.venues.affiliated] : []),
  ...props.venues.favorites,
  ...props.venues.others,
]);

const shown = computed(() => ordered.value.filter(venue => venueMatches(venue, query.value)));

// The ticked venues, in the order of the menu
const summary = computed(() =>
  ordered.value.filter(venue => venueIds.value.includes(venue.id)).map(formatVenueLabel).join(', ') || 'Choisir une salle',
);

const legend = `Salles affichées, ${SCRIM_SEARCH_VENUES_MAX} au plus`;

function isAffiliated(venue: Venue): boolean {
  return venue.id === props.venues.affiliated?.id;
}

function isFavorite(venue: Venue): boolean {
  return props.venues.favorites.some(favorite => favorite.id === venue.id);
}

function starTitle(venue: Venue): string {
  if (isFavorite(venue)) return 'Retirer des favorites de l\'équipe';
  if (props.favoritesFull) return `L'équipe a déjà ${TEAM_FAVORITE_VENUES_MAX} salles favorites`;
  return 'Ajouter aux favorites de l\'équipe';
}

async function open() {
  isOpen.value = true;
  await nextTick();
  searchField.value?.focus();
}

function close(refocus = false) {
  isOpen.value = false;
  query.value = '';
  if (refocus) trigger.value?.focus();
}

// A press anywhere else closes the menu
function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close();
}

watch(isOpen, opened => {
  if (opened) document.addEventListener('pointerdown', onPointerDown);
  else document.removeEventListener('pointerdown', onPointerDown);
});

onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown));
</script>

<template>
  <div ref="root" class="venue-menu">
    <button
      ref="trigger"
      type="button"
      class="venue-trigger"
      :class="{ open: isOpen }"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :title="summary"
      @click="isOpen ? close() : open()"
    >
      <span class="venue-trigger-label">{{ summary }}</span>
      <SvgIcon name="chevron-right" class="venue-trigger-chevron" />
    </button>

    <div v-if="isOpen" class="venue-panel" role="dialog" aria-label="Salles du calendrier" @keydown.esc.stop="close(true)">
      <input
        ref="searchField"
        v-model="query"
        type="search"
        class="venue-search"
        placeholder="Rechercher une salle"
        aria-label="Rechercher une salle"
      />
      <VenueChecklist
        v-model="venueIds"
        class="venue-list"
        :venues="shown"
        :legend="legend"
        :max="SCRIM_SEARCH_VENUES_MAX"
        empty-text="Aucune salle ne correspond."
      >
        <template #trailing="{ venue }">
          <span v-if="isAffiliated(venue)" class="venue-tag">Affiliée</span>
          <button
            v-else-if="canEditFavorites"
            type="button"
            class="venue-star"
            :class="{ 'venue-star--on': isFavorite(venue) }"
            :aria-pressed="isFavorite(venue)"
            :aria-label="starTitle(venue)"
            :title="starTitle(venue)"
            :disabled="savingFavorites || (!isFavorite(venue) && favoritesFull)"
            @click="emit('toggle-favorite', venue.id)"
          >
            <SvgIcon :name="isFavorite(venue) ? 'star' : 'star-outline'" />
          </button>
          <span v-else-if="isFavorite(venue)" class="venue-star venue-star--on" title="Favorite de l'équipe">
            <SvgIcon name="star" />
          </span>
        </template>
      </VenueChecklist>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.venue-menu {
  position: relative;
  min-width: 0;
}

.venue-trigger {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  max-width: min(420px, 100%);
  padding: 0.45rem 0.9rem 0.45rem 1rem;
  background: $color-bg-tertiary;
  border: $border-thin solid with-alpha($color-white, 0.5);
  border-radius: 999px;
  color: $color-white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover,
  &.open {
    border-color: $color-accent;
  }

  @include mobile-lg {
    padding: 0.35rem 0.7rem 0.35rem 0.8rem;
    font-size: 0.8rem;
  }
}

.venue-trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Points down, and up while the menu is open
.venue-trigger-chevron {
  flex-shrink: 0;
  transform: rotate(90deg);
  transition: transform 0.2s;

  .open & {
    transform: rotate(-90deg);
  }
}

.venue-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  width: 340px;
  max-width: calc(100vw - 2 * #{$spacing-md});
  padding: $spacing-sm;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
  box-shadow: 0 12px 32px $color-shadow;
}

.venue-search {
  width: 100%;
  padding: 0.45rem 0.7rem;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border;
  border-radius: $radius-sm;
  color: $color-white;
  font: inherit;
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: $color-accent;
  }
}

.venue-list {
  --venue-checklist-max-height: min(360px, 55vh);
}

.venue-tag {
  flex-shrink: 0;
  padding: 0.05rem 0.5rem;
  border: $border-thin solid with-alpha($color-accent, 0.6);
  border-radius: 999px;
  color: $color-accent;
  font-size: 0.7rem;
  font-weight: 600;
}

.venue-star {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-text-secondary;
  font-size: 1.05rem;

  &--on {
    color: $color-star;
  }
}

button.venue-star {
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover:not(:disabled) {
    background: with-alpha($color-white, 0.08);
    color: $color-star;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
