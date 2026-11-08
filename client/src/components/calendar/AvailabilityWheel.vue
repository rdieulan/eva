<script lang="ts">
// Where the wheel of answers opens: on a day, at a point of the screen. A tap
// opens it for a second tap; a press still down opens it under the pointer,
// and the release picks the answer it ends on.
export interface WheelOpening {
  date: string; // YYYY-MM-DD
  x: number;
  y: number;
  dragging: boolean; // Opened by a press still down: the release picks
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SvgIcon from '@/components/common/SvgIcon.vue';
import type { AvailabilityHours, AvailabilityStatus } from '@shared/types';
import { formatAvailabilityHours } from '@shared/utils';
import { getAvailabilityClass, getAvailabilityDisplay } from '@/utils/availability';

// The wheel's geometry, in px: the ring of answers around the hub of the hours
const RADIUS = 108;
const HUB_RADIUS = 40;
const RING_INNER = HUB_RADIUS + 6;
const SECTOR_GAP_DEG = 3;
const EDGE_MARGIN = 8; // Kept from the edges of the screen

// The four answers around the hub, clockwise from the top, each its quarter
const OPTIONS: { status: AvailabilityStatus | null; angle: number }[] = [
  { status: 'AVAILABLE', angle: -90 },
  { status: 'VOICE_ONLY', angle: 0 },
  { status: 'UNAVAILABLE', angle: 90 },
  { status: null, angle: 180 },
];

type Zone = { kind: 'option'; index: number } | { kind: 'hub' } | null;

const props = defineProps<{
  opening: WheelOpening;
  status: AvailabilityStatus | null; // The reader's answer for that day
  hours: AvailabilityHours | null;   // Its hours, when partial
}>();

const emit = defineEmits<{
  pick: [status: AvailabilityStatus | null];
  hours: []; // The hub: hours of a partial availability
  close: [];
}>();

const dragging = ref(props.opening.dragging);
const hovered = ref<Zone>(null);
const root = ref<HTMLElement | null>(null);

// Centred where it opened, kept whole on screen
const center = computed(() => {
  const clamp = (value: number, size: number) => Math.min(Math.max(value, RADIUS + EDGE_MARGIN), size - RADIUS - EDGE_MARGIN);
  return { x: clamp(props.opening.x, window.innerWidth), y: clamp(props.opening.y, window.innerHeight) };
});

function polar(angleDeg: number, radius: number): [number, number] {
  const angle = (angleDeg * Math.PI) / 180;
  return [RADIUS + radius * Math.cos(angle), RADIUS + radius * Math.sin(angle)];
}

// A quarter of the ring, from 45° before its angle to 45° after, a hair apart from the next
function sectorPath(angle: number): string {
  const from = angle - 45 + SECTOR_GAP_DEG / 2;
  const to = angle + 45 - SECTOR_GAP_DEG / 2;
  const [ox1, oy1] = polar(from, RADIUS);
  const [ox2, oy2] = polar(to, RADIUS);
  const [ix2, iy2] = polar(to, RING_INNER);
  const [ix1, iy1] = polar(from, RING_INNER);
  return `M${ox1},${oy1} A${RADIUS},${RADIUS} 0 0 1 ${ox2},${oy2} L${ix2},${iy2} A${RING_INNER},${RING_INNER} 0 0 0 ${ix1},${iy1} Z`;
}

const options = computed(() => OPTIONS.map(({ status, angle }, index) => {
  const [x, y] = polar(angle, (RADIUS + RING_INNER) / 2);
  const display = getAvailabilityDisplay(status);
  return { status, index, path: sectorPath(angle), x, y, display, statusClass: getAvailabilityClass(status) };
}));

const isPartial = computed(() => props.status === 'PARTIAL');
const hubLabel = computed(() => (isPartial.value && props.hours ? formatAvailabilityHours(props.hours) : 'Horaires'));

// What lies under a point of the screen: an answer, the hub, or nothing
function zoneAt(clientX: number, clientY: number): Zone {
  const dx = clientX - center.value.x;
  const dy = clientY - center.value.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= HUB_RADIUS) return { kind: 'hub' };
  if (distance < RING_INNER || distance > RADIUS) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const index = OPTIONS.findIndex(option => {
    const delta = ((angle - option.angle + 540) % 360) - 180;
    return Math.abs(delta) <= 45;
  });
  return { kind: 'option', index };
}

function act(zone: Zone) {
  if (!zone) return;
  if (zone.kind === 'hub') emit('hours');
  else emit('pick', OPTIONS[zone.index]!.status);
}

function isHovered(index: number): boolean {
  return hovered.value?.kind === 'option' && hovered.value.index === index;
}

// Opened by a press: the pointer moves over the answers, the release picks.
// Released on the hub without a move, the wheel stays for a tap; released
// outside, it closes.
let moved = false;

function onMove(event: PointerEvent) {
  const zone = zoneAt(event.clientX, event.clientY);
  if (dragging.value && zone?.kind !== 'hub') moved = true;
  hovered.value = zone;
}

function onUp(event: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  const zone = zoneAt(event.clientX, event.clientY);
  hovered.value = null;
  if (zone?.kind === 'option') act(zone);
  else if (zone?.kind === 'hub' && moved) act(zone);
  else if (!zone) emit('close');
}

// A finger held on the wheel moves over the answers: the page does not scroll under it
function holdPage(event: TouchEvent) {
  if (dragging.value) event.preventDefault();
}

// A tap: on an answer or the hub, it acts; anywhere else, it closes
function onTap(event: PointerEvent) {
  if (dragging.value) return;
  const zone = zoneAt(event.clientX, event.clientY);
  if (zone) act(zone);
  else emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

// The buttons carry the answers for the keyboard; a pointer goes through the geometry
function keyboardPick(event: MouseEvent, zone: Zone) {
  if (event.detail === 0) act(zone);
}

onMounted(() => {
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('touchmove', holdPage, { passive: false });
  document.addEventListener('keydown', onKeydown);
  if (!dragging.value) root.value?.querySelector<HTMLElement>('.answer.current, .hub')?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerup', onUp);
  document.removeEventListener('touchmove', holdPage);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div class="wheel-layer" @pointerup.self="onTap">
      <div
        ref="root"
        class="wheel"
        role="menu"
        aria-label="Ma disponibilité"
        :style="{ left: `${center.x - RADIUS}px`, top: `${center.y - RADIUS}px`, width: `${RADIUS * 2}px`, height: `${RADIUS * 2}px` }"
        @pointerup="onTap"
      >
        <svg class="ring" :viewBox="`0 0 ${RADIUS * 2} ${RADIUS * 2}`" aria-hidden="true">
          <circle class="ring-shadow" :cx="RADIUS" :cy="RADIUS" :r="RADIUS - 1" />
          <path
            v-for="option in options"
            :key="option.index"
            class="sector"
            :class="[option.statusClass, { current: option.status === status && !isPartial, hovered: isHovered(option.index) }]"
            :d="option.path"
          />
        </svg>

        <button
          v-for="option in options"
          :key="`answer-${option.index}`"
          type="button"
          class="answer"
          role="menuitemradio"
          :class="[option.statusClass, { current: option.status === status && !isPartial, hovered: isHovered(option.index) }]"
          :aria-checked="option.status === status && !isPartial"
          :title="option.display.title"
          :style="{ left: `${option.x}px`, top: `${option.y}px` }"
          @click="event => keyboardPick(event, { kind: 'option', index: option.index })"
        >
          <span class="answer-symbol">
            <SvgIcon v-if="'icon' in option.display.symbol" :name="option.display.symbol.icon" />
            <template v-else>{{ option.display.symbol.text }}</template>
          </span>
          <span class="answer-label">{{ option.display.label }}</span>
        </button>

        <button
          type="button"
          class="hub"
          role="menuitemradio"
          :class="{ current: isPartial, hovered: hovered?.kind === 'hub' }"
          :aria-checked="isPartial"
          title="Dispo pour jouer sur une partie de la journée : choisir les horaires"
          @click="event => keyboardPick(event, { kind: 'hub' })"
        >
          <SvgIcon name="clock" class="hub-icon" />
          <span class="hub-label">{{ hubLabel }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

$wheel-layer: 950; // Over the page and the bell's list, under any modal (Modal.vue opens them from 1000)

.wheel-layer {
  position: fixed;
  inset: 0;
  z-index: $wheel-layer;
  touch-action: none;
}

.wheel {
  position: fixed;
  cursor: pointer;
  animation: wheel-in 0.14s ease-out;
  user-select: none;
  -webkit-user-select: none;
}

@keyframes wheel-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}

.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ring-shadow {
  fill: with-alpha($color-bg-primary, 0.82);
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.55));
}

// Each answer in its colour, quiet until the pointer is on it; the one given is ringed
.sector {
  fill: $color-border;
  fill-opacity: 0.55;
  stroke: transparent;
  stroke-width: 3;
  transition: fill-opacity 0.12s ease-out, stroke 0.12s ease-out;

  @each $status, $color in $availability-colors {
    &.availability--#{$status} {
      fill: $color;
    }
  }

  &.availability--unset {
    fill: $color-text-secondary;
  }

  &.hovered {
    fill-opacity: 0.95;
  }

  &.current {
    stroke: $color-white;
  }
}

.answer {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: none;
  background: transparent;
  color: $color-white;
  font-size: 0.78rem;
  font-weight: 600;
  pointer-events: none; // A pointer acts through the geometry of the ring
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);

  &:focus-visible {
    outline: 2px solid $color-white;
    outline-offset: 4px;
    border-radius: $radius-sm;
  }
}

.answer-label {
  white-space: nowrap;
}

.answer-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.1rem;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1;

  .svg-icon {
    width: 1.05rem;
    height: 1.05rem;
  }
}

.hub {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 80px;
  height: 80px;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 6px;
  border: 3px solid with-alpha($color-conditional, 0.5);
  border-radius: 50%;
  background: with-alpha($color-conditional, 0.18);
  color: $color-white;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  pointer-events: none;
  transition: background 0.12s ease-out, border-color 0.12s ease-out;

  &.hovered {
    background: with-alpha($color-conditional, 0.45);
  }

  &.current {
    border-color: $color-white;
    background: with-alpha($color-conditional, 0.4);
  }

  &:focus-visible {
    outline: 2px solid $color-white;
    outline-offset: 3px;
  }
}

.hub-icon {
  width: 1.15rem !important;
  height: 1.15rem !important;
  color: $color-conditional;
}

.hub-label {
  max-width: 100%;
}
</style>
