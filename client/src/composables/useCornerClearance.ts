// Keeps the lines of a day, its rows and the names of its roster, clear of
// the corner: the triangle in the bottom-right of the cell that shows the
// reader's status.
//
// Which lines reach the corner depends on where they end up: a day with two
// rows keeps them far above it, a full day has its last rows beside it, and
// the corner grows while the reader edits. Only the laid-out boxes know, so
// the room is measured, then handed to the stylesheet as `--clear` on each
// line.

import { onBeforeUnmount, onMounted, onUpdated, type Ref } from 'vue';

// Room left between the content of a line and the hypotenuse of the corner
export const CORNER_CLEARANCE_GAP_PX = 3;

export interface ClearanceBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Room a line must leave on its right so its content stops a hair before
 * the corner. The corner is a right triangle in the bottom-right of its box:
 * its hypotenuse runs from the top-right of the box to its bottom-left, so
 * the triangle is widest at the bottom and a line is limited at its own
 * bottom edge. A line that ends above the corner needs no room.
 */
export function cornerClearance(corner: ClearanceBox, line: ClearanceBox, gap = CORNER_CLEARANCE_GAP_PX): number {
  const depth = line.bottom - corner.top;
  if (depth <= 0) return 0;
  const legs = corner.right - corner.left;
  const hypotenuse = corner.right - Math.min(depth, legs);
  return Math.max(0, line.right - hypotenuse + gap);
}

/**
 * The box a line could fill: its own, out to the right edge of the list it
 * sits in. The room the line gives the corner, as padding or as margin, does
 * not move that edge, so the measure never chases its own result.
 */
function lineReach(line: HTMLElement): ClearanceBox {
  const box = line.getBoundingClientRect();
  const right = line.parentElement?.getBoundingClientRect().right ?? box.right;
  return { top: box.top, right, bottom: box.bottom, left: box.left };
}

/**
 * Sets `--clear`, in pixels, on every element of the cell marked
 * `data-corner-clear`, and keeps it right as the cell resizes, its content
 * changes, or its corner changes size with the theme.
 */
export function useCornerClearance(cell: Ref<HTMLElement | null | undefined>): void {
  let observer: ResizeObserver | null = null;
  let observedCorner: Element | null = null;

  function update(): void {
    const root = cell.value;
    if (!root) return;
    const corner = root.querySelector('.corner');
    const cornerBox = corner?.getBoundingClientRect();
    for (const line of root.querySelectorAll<HTMLElement>('[data-corner-clear]')) {
      const clear = cornerBox ? cornerClearance(cornerBox, lineReach(line)) : 0;
      if (clear > 0) line.style.setProperty('--clear', `${clear.toFixed(2)}px`);
      else line.style.removeProperty('--clear');
    }
    // The corner comes and goes with the day, and changes size with the theme
    if (observer && corner !== observedCorner) {
      if (observedCorner) observer.unobserve(observedCorner);
      if (corner) observer.observe(corner);
      observedCorner = corner;
    }
  }

  onMounted(() => {
    if (typeof ResizeObserver !== 'undefined' && cell.value) {
      observer = new ResizeObserver(() => update());
      observer.observe(cell.value);
    }
    update();
  });
  onUpdated(update);
  onBeforeUnmount(() => observer?.disconnect());
}
