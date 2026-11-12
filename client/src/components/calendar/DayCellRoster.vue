<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerAvailability } from '@shared/types';
import { describeAvailability, getAvailabilityClass, sortPlayersByAvailability } from '@/utils/availability';
import { formatAvailabilityHours } from '@shared/utils';

// A day while the reader gives their answers (see DayCell): who said what, a
// player a line, the most available first, then by name, a dot in the colour
// of their answer. The reader is not listed: the corner of the cell already
// says where they stand. The names reaching the corner stop before it.
const props = defineProps<{
  date: string; // YYYY-MM-DD, to name the list
  availabilities: PlayerAvailability[];
  readerId?: string;
}>();

const roster = computed(() =>
  sortPlayersByAvailability(props.availabilities.filter(player => player.playerId !== props.readerId)),
);
</script>

<template>
  <ul class="roster" :aria-label="`Disponibilités du ${date}`">
    <li
      v-for="player in roster"
      :key="player.playerId"
      class="roster-player"
      data-corner-clear
      :class="getAvailabilityClass(player.status)"
      :title="`${player.playerName} : ${describeAvailability(player.status, player.hours)}`"
    >
      <span class="roster-dot" aria-hidden="true"></span>
      <span class="roster-name">{{ player.playerName }}</span>
      <span v-if="player.status === 'PARTIAL' && player.hours" class="roster-hours">{{ formatAvailabilityHours(player.hours) }}</span>
    </li>
  </ul>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// The roster in a column, one player a line
.roster {
  --roster-font: 0.72rem; // Size of the names
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  position: relative;
  z-index: 1;
  overflow: hidden;

  @include mobile-lg {
    --roster-font: 0.6rem;
  }
}

.roster-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  // A name beside the corner stops before it (see useCornerClearance)
  padding-right: var(--clear, 0px);
  font-size: var(--roster-font);
  line-height: 1.35;
  color: $color-text-primary;
  overflow: hidden;

  @include mobile-lg {
    gap: 0.25rem;
  }
}

// A hollow dot for a player who has not answered, a full one otherwise
.roster-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: transparent;
  border: $border-thin solid $color-text-secondary;
  box-sizing: border-box;

  // Scoped to the player's own row: the cell carries an availability class too
  // (the reader's status in edit mode) and must not colour the teammates' dots
  @each $status, $color in $availability-colors {
    .roster-player.availability--#{$status} > & {
      background: $color;
      border-color: $color;
    }
  }

  @include mobile {
    width: 5px;
    height: 5px;
  }
}

.roster-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// The hours of a teammate available on part of the day, after the name, in
// its ink: the yellow of the dot says the answer, and a yellow day would drown
// yellow hours. Short of room, they give way before the name does.
.roster-hours {
  flex-shrink: 1000;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// A narrow day leaves the roster to the names
@container day-cell (max-width: 7.5rem) {
  .roster-hours {
    display: none;
  }
}
</style>
