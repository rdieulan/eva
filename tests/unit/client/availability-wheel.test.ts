// Tests for the wheel of answers: a tap picks, a press dragged and released picks, the hub opens the hours
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AvailabilityWheel, { type WheelOpening } from '@/components/calendar/AvailabilityWheel.vue';
import type { AvailabilityHours, AvailabilityStatus } from '@shared/types';

const CENTER = 300;
const RING = 75; // Into the ring of answers, between the hub and the edge

let wrapper: ReturnType<typeof mount> | null = null;

function mountWheel(opening: Partial<WheelOpening> = {}, status: AvailabilityStatus | null = 'AVAILABLE', hours: AvailabilityHours | null = null) {
  wrapper = mount(AvailabilityWheel, {
    props: { opening: { date: '2026-12-15', x: CENTER, y: CENTER, dragging: false, ...opening }, status, hours },
    global: { stubs: { Teleport: true } },
    attachTo: document.body,
  });
  return wrapper;
}

function documentPointer(type: 'pointermove' | 'pointerup', clientX: number, clientY: number) {
  document.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe('AvailabilityWheel', () => {
  it('picks the answer a tap lands on, each in its quarter, and opens the hours from the hub', async () => {
    const answers: Array<[number, number, AvailabilityStatus | null]> = [
      [CENTER, CENTER - RING, 'AVAILABLE'],
      [CENTER + RING, CENTER, 'VOICE_ONLY'],
      [CENTER, CENTER + RING, 'UNAVAILABLE'],
      [CENTER - RING, CENTER, null],
    ];
    for (const [clientX, clientY, status] of answers) {
      const wheel = mountWheel();
      await wheel.find('.wheel').trigger('pointerup', { clientX, clientY });
      expect(wheel.emitted('pick')).toEqual([[status]]);
      wheel.unmount();
    }

    const wheel = mountWheel();
    await wheel.find('.wheel').trigger('pointerup', { clientX: CENTER, clientY: CENTER });
    expect(wheel.emitted('hours')).toHaveLength(1);
    expect(wheel.emitted('pick')).toBeFalsy();
  });

  it('closes on a tap outside, and on Escape', async () => {
    const wheel = mountWheel();
    await wheel.find('.wheel-layer').trigger('pointerup', { clientX: 10, clientY: 10 });
    expect(wheel.emitted('close')).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wheel.emitted('close')).toHaveLength(2);
  });

  it('follows a press dragged over the answers, and picks the one it is released on', async () => {
    const wheel = mountWheel({ dragging: true }, null);

    documentPointer('pointermove', CENTER, CENTER + RING);
    await wheel.vm.$nextTick();
    expect(wheel.find('.sector.availability--unavailable').classes()).toContain('hovered');
    documentPointer('pointerup', CENTER, CENTER + RING);

    expect(wheel.emitted('pick')).toEqual([['UNAVAILABLE']]);
  });

  it('stays open for a tap when the press is released where it began, and closes when released outside', async () => {
    const still = mountWheel({ dragging: true });
    documentPointer('pointerup', CENTER + 2, CENTER + 1);
    expect(still.emitted()).not.toHaveProperty('pick');
    expect(still.emitted()).not.toHaveProperty('close');
    expect(still.emitted()).not.toHaveProperty('hours');
    // Now a tap picks
    await still.find('.wheel').trigger('pointerup', { clientX: CENTER + RING, clientY: CENTER });
    expect(still.emitted('pick')).toEqual([['VOICE_ONLY']]);
    still.unmount();

    const away = mountWheel({ dragging: true });
    documentPointer('pointermove', CENTER + 400, CENTER);
    documentPointer('pointerup', CENTER + 400, CENTER);
    expect(away.emitted('close')).toHaveLength(1);
  });

  it('rings the answer given, the hub with its hours for a partial one', () => {
    const plain = mountWheel({}, 'VOICE_ONLY');
    expect(plain.find('.answer.current').text()).toContain('En ligne');
    expect(plain.find('.hub').classes()).not.toContain('current');
    expect(plain.find('.hub').text()).toBe('Horaires');
    plain.unmount();

    const partial = mountWheel({}, 'PARTIAL', { startTime: '21:00', endTime: '23:00' });
    expect(partial.find('.answer.current').exists()).toBe(false);
    expect(partial.find('.hub').classes()).toContain('current');
    expect(partial.find('.hub').text()).toBe('21:00 – 23:00');
  });

  it('answers the keyboard through its buttons', async () => {
    const wheel = mountWheel();
    await wheel.findAll('button.answer')[2]!.trigger('click');
    expect(wheel.emitted('pick')).toEqual([['UNAVAILABLE']]);
    await wheel.find('button.hub').trigger('click');
    expect(wheel.emitted('hours')).toHaveLength(1);
  });

  it('stays whole on screen when it opens by an edge', () => {
    const wheel = mountWheel({ x: 5, y: 5 });
    expect(wheel.find('.wheel').attributes('style')).toContain('left: 8px');
    expect(wheel.find('.wheel').attributes('style')).toContain('top: 8px');
  });
});
