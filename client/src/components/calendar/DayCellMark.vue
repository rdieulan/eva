<script setup lang="ts">
import type { ScrimSearch } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';
import OwnSearchMark from '@/components/calendar/OwnSearchMark.vue';

// Bottom left of a day, on the left edge of its rows, the place of what is
// ours (see DayCell): the mark of a day picked for a search, or our own search
// that day, or else the hours a full lineup meets on a day it only meets on
// part of. The corner holds the bottom right; what reaches it stops before it.
defineProps<{
  selected: boolean; // The day is picked for a search
  search: ScrimSearch | null; // Our own search that day
  lineupHours: { main: string; end: string | null } | null; // When a partial lineup meets: the start, then the rest
  lineupTitle: string; // What the team can do that day
}>();

const emit = defineEmits<{
  'open-search': [search: ScrimSearch];
}>();
</script>

<template>
  <span v-if="selected" class="selected-mark" aria-label="Jour sélectionné">✓</span>
  <OwnSearchMark
    v-else-if="search"
    class="own-search-mark"
    data-corner-clear
    :search="search"
    show-hours
    @open="ownSearch => emit('open-search', ownSearch)"
  />
  <span v-else-if="lineupHours" class="window-mark" data-corner-clear :title="lineupTitle">
    <SvgIcon name="clock" class="window-icon" />
    <span class="window-hours"><span>{{ lineupHours.main }}</span><span v-if="lineupHours.end" class="window-end">{{ lineupHours.end }}</span></span>
  </span>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// The mark of a picked day, in the square of a row (see --mark in DayCell)
.selected-mark {
  position: absolute;
  bottom: var(--pad);
  left: var(--pad);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--mark);
  height: var(--mark);
  border-radius: 50%;
  background: $color-white;
  color: $color-bg-primary;
  font-size: 0.7rem;
  font-weight: 700;

  @include mobile-lg {
    font-size: 0.6rem;
  }
}

// Our own search: the loupe emoji, drawn exactly in the square of the mark of
// a picked day. The emoji draws it from 2.2 to 29.94 units of its 32, so its
// square is that much larger, and set back by its margins; its centre stays
// that of the square, so the hours beside it sit on the row. The hours stop
// before the corner (see useCornerClearance), at the size of the rows' text.
.own-search-mark {
  --loupe: calc(var(--mark) * 32 / 27.74);
  position: absolute;
  left: calc(var(--pad) - var(--loupe) * 2.2 / 32);
  bottom: calc(var(--pad) - var(--loupe) * 2.06 / 32);
  z-index: 2;
  max-width: calc(100% - var(--pad) + var(--loupe) * 2.2 / 32 - var(--clear, 0px));
  font-size: var(--row-font);
}

// The hours a full lineup meets, like our own search
.window-mark {
  position: absolute;
  left: var(--pad);
  bottom: var(--pad);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.3em;
  max-width: calc(100% - var(--pad) * 2 - var(--clear, 0px));
  height: var(--mark);
  font-size: var(--row-font);
  color: $color-white;
  white-space: nowrap;
  overflow: hidden;
}

// In the ink of the hours: the day it marks is yellow already
.window-icon {
  flex-shrink: 0;
  width: 1.1em !important;
  height: 1.1em !important;
}

.window-hours {
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

// A narrow day keeps when the lineup meets from, a phone the clock alone, as
// our own search does (see OwnSearchMark)
@container day-cell (max-width: 8.6rem) {
  .window-end {
    display: none;
  }
}

@container day-cell (max-width: 5.6rem) {
  .window-hours {
    display: none;
  }
}
</style>
