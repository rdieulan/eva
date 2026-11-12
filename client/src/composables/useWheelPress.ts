// How a press on a day opens the wheel of the reader's answer. A tap opens it
// where it lands, for a second tap. A press held still, or dragged with a
// mouse, opens it under the pointer, and the release picks the answer it ends
// on. A finger that moves before the hold is scrolling the page: nothing opens.

import { onBeforeUnmount } from 'vue';

const HOLD_MS = 300;
const MOVE_TOLERANCE_PX = 10;
const HOLD_BUZZ_MS = 10; // A short vibration where the device has one, when the hold opens the wheel

export function useWheelPress(options: {
  enabled: () => boolean; // Whether a press opens the wheel now
  // Open the wheel at that point; dragging: the release picks the answer it ends on
  open: (x: number, y: number, dragging: boolean) => void;
}) {
  let press: { x: number; y: number; pointerType: string; timer: ReturnType<typeof setTimeout> } | null = null;

  function endPress() {
    if (press) clearTimeout(press.timer);
    press = null;
    window.removeEventListener('pointermove', onPressMove);
    window.removeEventListener('pointerup', onPressUp);
    window.removeEventListener('pointercancel', endPress);
  }

  function openWheel(x: number, y: number, dragging: boolean) {
    endPress();
    options.open(x, y, dragging);
  }

  function onPressStart(event: PointerEvent) {
    if (!options.enabled() || event.button !== 0) return;
    endPress();
    const { clientX: x, clientY: y, pointerType } = event;
    press = {
      x, y, pointerType,
      timer: setTimeout(() => {
        navigator.vibrate?.(HOLD_BUZZ_MS);
        openWheel(x, y, true);
      }, HOLD_MS),
    };
    window.addEventListener('pointermove', onPressMove);
    window.addEventListener('pointerup', onPressUp);
    window.addEventListener('pointercancel', endPress);
  }

  function onPressMove(event: PointerEvent) {
    if (!press || Math.hypot(event.clientX - press.x, event.clientY - press.y) <= MOVE_TOLERANCE_PX) return;
    if (press.pointerType === 'mouse') openWheel(press.x, press.y, true);
    else endPress();
  }

  function onPressUp(event: PointerEvent) {
    if (!press) return;
    openWheel(event.clientX, event.clientY, false);
  }

  onBeforeUnmount(endPress);

  return { onPressStart };
}
