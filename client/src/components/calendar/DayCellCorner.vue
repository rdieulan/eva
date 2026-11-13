<script setup lang="ts">
import { computed } from 'vue';
import type { AvailabilityHours, AvailabilityStatus } from '@shared/types';
import { describeAvailability, getAvailabilityClass, getAvailabilityDisplay, getHoursMark } from '@/utils/availability';
import SvgIcon from '@/components/common/SvgIcon.vue';

// The reader's own answer for a day, in the bottom-right corner of its cell
// (see DayCell): a triangle in the colour of the answer, with its symbol. A
// partial answer also carries when it starts, shown in place of its clock
// where the corner has room. It reads what the cell sets: its size, its rim,
// and the relief the theme gives the kind of day.
const props = defineProps<{
  status: AvailabilityStatus | null; // Null: not answered yet
  hours: AvailabilityHours | null; // When available on part of the day
}>();

const statusClass = computed(() => getAvailabilityClass(props.status));
const symbol = computed(() => getAvailabilityDisplay(props.status).symbol);
const hoursMark = computed(() => (props.status === 'PARTIAL' && props.hours ? getHoursMark(props.hours) : null));
const symbolKey = computed(() => `${statusClass.value}-${hoursMark.value?.join('') ?? ''}`);
// Hours with minutes, "21h30": a smaller size, so the lines stay inside the triangle
const isLongHoursMark = computed(() => hoursMark.value?.some(line => line.replace('–', '').length > 3) ?? false);
const title = computed(() => `Ma disponibilité : ${describeAvailability(props.status, props.hours)}`);
</script>

<template>
  <div class="corner" :class="statusClass" :title="title">
    <span class="corner-relief" aria-hidden="true">
      <span class="corner-notch">
        <span class="corner-wall corner-wall--bottom"></span>
        <span class="corner-wall corner-wall--right"></span>
        <span class="corner-wall corner-wall--diagonal"></span>
        <span class="corner-face"></span>
      </span>
    </span>
    <!-- Another answer: the new symbol springs in over the old -->
    <Transition name="symbol">
      <span :key="symbolKey" class="corner-symbol" :class="{ 'has-hours': hoursMark }">
        <SvgIcon :name="symbol.icon" />
      </span>
    </Transition>
    <!-- A partial answer's hours, a line per bound, where the triangle has room for them -->
    <Transition name="symbol">
      <span v-if="hoursMark" :key="symbolKey" class="corner-hours" :class="{ 'is-long': isLongHoursMark }">
        <span v-for="line in hoursMark" :key="line">{{ line }}</span>
      </span>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

// The legs of the reader's triangle as drawn (see .corner). Registered as a
// length so a transition can carry it from one size to the other.
@property --leg {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}

// A chamfered triangle in the bottom-right corner of the cell, cut as a
// recess in the day, or standing on it as a chip where the theme says so. The
// box itself is not clipped, so a chip inside can cast a shadow on the cell;
// the rim around the walls is the bare surface of the day. Its legs, rim and
// the curve it follows are those the cell sets (see .day-cell in DayCell).
.corner {
  position: absolute;
  bottom: 0;
  right: 0;
  // The triangle at rest and its rim around it: the box the lines of the day
  // keep clear of. It takes its new size at once when the reader starts or
  // stops editing, so the lines are measured a single time, against where the
  // triangle is going (see useCornerClearance); the triangle drawn inside
  // catches up through `--leg`.
  width: calc(var(--notch) + var(--rim) * 3.414);
  height: calc(var(--notch) + var(--rim) * 3.414);
  z-index: 2;
  pointer-events: none;

  // The legs as drawn, then the same in whole pixels for the shapes, at every
  // frame (see .day-cell for why whole pixels). Walls, face, shade and symbol
  // all read them, so they move as one. Back to rest: quick and straight.
  --leg: var(--notch);
  --drawn: round(var(--leg), 1px);
  transition: --leg 0.24s cubic-bezier(0.3, 0, 0.2, 1);

  --corner-color: #{$color-border-light}; // The reader's status, read by the face
  --bevel: #{$corner-bevel-width}; // Local copy: a theme token under its own name would be a self-reference
  // Curves of the right-angle vertex, both centred on the same point so the
  // band of the walls keeps its width through the turn: `round` for the
  // outer edge of the walls, `round-in` for the face, a wall narrower. The
  // face takes half the curve of the cell, so the triangle echoes the day;
  // where the triangle sits so close to the edges that the curve of the cell,
  // the rim away, is wider, that one wins and the rim keeps its width along
  // it. In a flat theme without rim nor walls, the face takes the curve of
  // the cell itself.
  --round: max(calc(var(--cell-radius) / 2 + var(--bevel)), calc(var(--cell-radius) - var(--cell-border) - var(--rim)));
  --round-in: calc(var(--round) - var(--bevel));
  // Geometry of the chamfer in the notch's box: a wall is `bevel` wide, and
  // along the bottom or the right edge it meets the diagonal wall
  // bevel × (1 + √2) in from the far end. `turn` is the centre of the curves
  // of the vertex, on its bisector.
  --step: calc(var(--bevel) * 2.41421);
  --far: calc(100% - var(--bevel));
  --turn: calc(100% - var(--bevel) - var(--round-in));

  @each $status, $color in $availability-colors {
    &.availability--#{$status} {
      --corner-color: #{$color};
    }
  }

  @include mobile-lg {
    --bevel: min(#{$corner-bevel-width}, 1px);
  }
}

// The relief wrapper is not clipped: its drop shadow follows the clipped
// shapes inside, which a box-shadow on a clipped box cannot do
.corner-relief {
  position: absolute;
  inset: 0;
  filter: var(--corner-cast);
}

// Editing their availability, a click changes the reader's own corner: it
// grows to twice its legs, its symbol with it, a touch past its size before
// settling; never past most of the width of the day, so a narrow day keeps
// room for its roster
.edit-mode .corner {
  --notch: min(round(calc(#{$corner-size} * 2), 1px), round(60cqi, 1px));
  transition: --leg 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);

  @include mobile-lg {
    --notch: min(round(calc(#{$corner-size} * 4 / 3), 1px), round(60cqi, 1px));
  }
}

// The notch: the triangle inside the rim, whose edges are the outer edges of
// the walls. Its own clip rounds the bottom-right vertex of everything
// inside, walls included, to follow the curve of the cell.
.corner-notch {
  position: absolute;
  bottom: var(--rim);
  right: var(--rim);
  width: var(--drawn);
  height: var(--drawn);
  clip-path: inset(0 round 0 0 var(--round) 0);

  > span {
    position: absolute;
  }
}

// The walls: three trapezoids of the bare surface of the day, along the
// bottom edge, the right edge and the hypotenuse, each under its own
// gradient, lit or shaded by the light. The bottom and right ones meet on the
// bisector of the vertex and run on under the face to the centre of its
// curve, so together they fill the turn around its rounded corner.
.corner-wall {
  inset: 0;
}

.corner-wall--bottom {
  clip-path: polygon(0 100%, 100% 100%, var(--turn) var(--turn), var(--step) var(--far));
  background-image: var(--corner-wall-bottom);
}

.corner-wall--right {
  clip-path: polygon(100% 100%, 100% 0, var(--far) var(--step), var(--turn) var(--turn));
  background-image: var(--corner-wall-right);
}

.corner-wall--diagonal {
  clip-path: polygon(0 100%, 100% 0, var(--far) var(--step), var(--step) var(--far));
  background-image: var(--corner-wall-diagonal);
}

// The face: the reader's colour, under the shadow of the walls when it is
// the floor of a recess, and faded on a day the team cannot use where the
// theme says so. Drawn over the walls, in a box that stops at their inner
// edges so its rounded corner sits inside their turn; its shade keeps the
// geometry of the notch.
.corner-face {
  inset: 0 var(--bevel) var(--bevel) 0;
  border-bottom-right-radius: var(--round-in);
  clip-path: polygon(100% var(--step), 100% 100%, var(--step) 100%);
  background-color: var(--corner-color);
  background-image: var(--corner-face-shade);
  background-size: var(--drawn) var(--drawn);
  filter: var(--corner-face-filter);
  transition: background-color 0.2s ease-out; // A click changes the status: the colour follows
}

.corner-symbol {
  position: absolute;
  // A box centred on the centroid of the face, a third of its leg in from its
  // bottom and right edges: the point that reads as the middle of a triangle.
  // The face is the triangle left inside the notch by the walls. Box and
  // glyph follow the legs of the triangle, so they grow with it.
  --face: calc(var(--drawn) - var(--bevel) * 3.414);
  --inset: calc(var(--rim) + var(--bevel) + var(--face) / 3);
  --symbol: calc(var(--drawn) * 0.32);
  bottom: var(--inset);
  right: var(--inset);
  width: var(--symbol);
  height: var(--symbol);
  transform: translate(50%, 50%);
  // The point the box is moved to, so a scale keeps the glyph on the centroid
  transform-origin: 100% 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  color: $corner-symbol-color;

  // The icon fills the box, its drawing a flex item centred in it: as a
  // block, the drawing would sit on a line of text, its baseline set by the
  // font, and fall off the centre
  .svg-icon {
    width: 100%;
    height: 100%;
  }

}

// The hours of a partial answer, right-aligned in the right angle of the face,
// a tenth of the face in from its walls: the face is wider the lower it goes,
// so the start sits above the end, both clear of the hypotenuse. Hidden where
// the triangle is too small to read them: the clock says it then.
.corner-hours {
  --face: calc(var(--drawn) - var(--bevel) * 3.414);
  position: absolute;
  right: calc(var(--rim) + var(--bevel) + var(--face) * 0.1);
  bottom: calc(var(--rim) + var(--bevel) + var(--face) * 0.1);
  z-index: 1;
  display: none;
  flex-direction: column;
  align-items: flex-end;
  font-size: calc(var(--face) * 0.2);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: $corner-symbol-color;
  font-variant-numeric: tabular-nums;
  transform-origin: 100% 100%; // The spring of a new answer starts from the right angle

  &.is-long {
    font-size: calc(var(--face) * 0.15);
  }
}

// The large corner of edit mode, on a day wide enough: the hours in place of the clock
@container day-cell (min-width: 5.6rem) {
  .day-cell.edit-mode .corner {
    .corner-symbol.has-hours {
      display: none;
    }

    .corner-hours {
      display: flex;
    }
  }
}

// A new status: its symbol springs in from small, the old one swells and
// fades. `scale` composes with the transform that centres the box.
.symbol-enter-active {
  transition: scale 0.34s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.14s ease-out;
}

.symbol-leave-active {
  transition: scale 0.16s ease-in, opacity 0.16s ease-in;
}

.symbol-enter-from {
  opacity: 0;
  scale: 0.4;
}

.symbol-leave-to {
  opacity: 0;
  scale: 1.3;
}

@media (prefers-reduced-motion: reduce) {
  .corner,
  .edit-mode .corner,
  .corner-face,
  .symbol-enter-active,
  .symbol-leave-active {
    transition: none;
  }
}
</style>
