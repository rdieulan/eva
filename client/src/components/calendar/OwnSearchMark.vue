<script setup lang="ts">
import { computed } from 'vue';
import type { ScrimSearch } from '@shared/types';
import magnifierUrl from '@/assets/icons/magnifier.svg';
import { ownSearchLabel, pendingProposalCount } from '@/utils/scrims';

// Our own search on a day: the loupe of the search button, the 🔎 emoji, drawn
// in the square of the tick of a picked day (see DayCell), the count of the
// teams waiting for our answer in the centre of its glass once some did. On
// the row the day keeps for it, the hours the search offers follow it, where
// they fit. Its words are in its tooltip. A click opens the search, and goes
// no further.
//
// The emoji is the Fluent design, kept as a picture rather than as text, so it
// is the same on every system and its glass sits where the count expects it.
const props = defineProps<{
  search: ScrimSearch;
  showHours?: boolean; // The hours of the search beside the loupe
}>();

const emit = defineEmits<{
  open: [search: ScrimSearch];
}>();

const pendingCount = computed(() => pendingProposalCount(props.search));
const label = computed(() => ownSearchLabel(props.search));

function open(e: MouseEvent) {
  e.stopPropagation();
  emit('open', props.search);
}
</script>

<template>
  <button type="button" class="own-search" :class="{ 'has-pending': pendingCount }" :title="label" :aria-label="label" @click="open">
    <span class="own-search-loupe">
      <img class="own-search-icon" :src="magnifierUrl" alt="" draggable="false" />
      <span v-if="pendingCount" class="own-search-count" aria-hidden="true">{{ pendingCount }}</span>
    </span>
    <span v-if="showHours" class="own-search-hours" aria-hidden="true"><span class="own-search-start">{{ search.startTime }}</span><span class="own-search-end"> – {{ search.endTime }}</span></span>
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.own-search {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;

  &:hover {
    filter: brightness(1.12);
  }
}

// The emoji is drawn in a square of 32 units, its glass centred at 19.09 by
// 12.98 units from the top left, 9.06 units of radius. `--loupe`, the side of
// that square, is set by whoever places the mark; every measure below is a
// share of it.
.own-search-loupe {
  position: relative;
  flex-shrink: 0;
  width: var(--loupe);
  height: var(--loupe);
}

.own-search-icon {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}

// The count in the centre of the glass, dark on its light blue
.own-search-count {
  position: absolute;
  left: calc(var(--loupe) * 19.09 / 32);
  top: calc(var(--loupe) * 12.98 / 32);
  transform: translate(-50%, -50%);
  color: $color-bg-primary;
  font-size: calc(var(--loupe) * 0.4);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

// The hours, as a row of the day writes its time
.own-search-hours {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  color: $color-text-muted;
  font-weight: 600;
  line-height: 1.3;
}

// A day too narrow for the whole span keeps its start; narrower still, the
// loupe alone. The widths are those of the day's content where the corner is
// the largest, so the hours never get cut.
@container day-cell (max-width: 8.6rem) {
  .own-search-end {
    display: none;
  }
}

@container day-cell (max-width: 5.6rem) {
  .own-search-hours {
    display: none;
  }
}
</style>
