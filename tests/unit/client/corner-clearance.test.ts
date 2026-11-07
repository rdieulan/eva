// The lines of a day stop before the corner in its bottom-right
import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h, ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { cornerClearance, CORNER_CLEARANCE_GAP_PX, useCornerClearance, type ClearanceBox } from '@/composables/useCornerClearance';

// A corner of 44px legs in the bottom-right of a 165 x 100 cell
const CORNER: ClearanceBox = { top: 56, right: 165, bottom: 100, left: 121 };

describe('cornerClearance', () => {
  it('leaves no room to a line that ends above the corner', () => {
    expect(cornerClearance(CORNER, { top: 30, right: 157, bottom: 50, left: 8 })).toBe(0);
    expect(cornerClearance(CORNER, { top: 36, right: 157, bottom: 56, left: 8 })).toBe(0);
  });

  it('leaves the room up to the hypotenuse at the bottom edge of the line, and the gap', () => {
    // 20px into the corner, the hypotenuse is 20px in from its right edge
    expect(cornerClearance(CORNER, { top: 56, right: 157, bottom: 76, left: 8 }))
      .toBe(157 - (165 - 20) + CORNER_CLEARANCE_GAP_PX);
  });

  it('never asks for more than the full width of the corner', () => {
    expect(cornerClearance(CORNER, { top: 90, right: 157, bottom: 110, left: 8 }))
      .toBe(157 - (165 - 44) + CORNER_CLEARANCE_GAP_PX);
  });

  it('leaves no room to a line that ends left of the corner', () => {
    expect(cornerClearance(CORNER, { top: 80, right: 100, bottom: 92, left: 8 })).toBe(0);
  });
});

describe('useCornerClearance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The lines sit in a list that reaches the right padding of the cell
  const BOXES: Record<string, ClearanceBox> = {
    corner: CORNER,
    list: { top: 8, right: 157, bottom: 92, left: 8 },
    'line-high': { top: 8, right: 157, bottom: 28, left: 8 },
    'line-low': { top: 70, right: 157, bottom: 90, left: 8 },
  };

  function mountHost(withCorner: boolean, boxes: Record<string, ClearanceBox> = BOXES) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const box = boxes[this.classList[0] ?? ''] ?? { top: 0, right: 0, bottom: 0, left: 0 };
      return { ...box, x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top, toJSON: () => box } as DOMRect;
    });
    const Host = defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        useCornerClearance(root);
        return () => h('div', { ref: root }, [
          withCorner ? h('div', { class: 'corner' }) : null,
          h('div', { class: 'list' }, [
            h('div', { class: 'line-high', 'data-corner-clear': '' }),
            h('div', { class: 'line-low', 'data-corner-clear': '' }),
          ]),
        ]);
      },
    });
    return mount(Host, { attachTo: document.body });
  }

  it('hands its room to a line that reaches the corner, none to a line above it', async () => {
    const wrapper = mountHost(true);
    await nextTick();

    const expected = cornerClearance(CORNER, BOXES['line-low']!);
    expect(wrapper.find('.line-low').element.getAttribute('style')).toContain(`--clear: ${expected.toFixed(2)}px`);
    expect(wrapper.find('.line-high').element.getAttribute('style') ?? '').not.toContain('--clear');
    wrapper.unmount();
  });

  it('measures a line out to the edge of its list, so a line already narrowed for the corner keeps its room', async () => {
    const narrowed = { ...BOXES, 'line-low': { ...BOXES['line-low']!, right: 140 } };
    const wrapper = mountHost(true, narrowed);
    await nextTick();

    const expected = cornerClearance(CORNER, BOXES['line-low']!);
    expect(wrapper.find('.line-low').element.getAttribute('style')).toContain(`--clear: ${expected.toFixed(2)}px`);
    wrapper.unmount();
  });

  it('leaves every line free on a day without corner', async () => {
    const wrapper = mountHost(false);
    await nextTick();

    expect(wrapper.find('.line-low').element.getAttribute('style') ?? '').not.toContain('--clear');
    expect(wrapper.find('.line-high').element.getAttribute('style') ?? '').not.toContain('--clear');
    wrapper.unmount();
  });
});
