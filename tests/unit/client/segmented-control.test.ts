// Tests for the segmented control: a choice among a few options, one lit
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SegmentedControl from '@/components/common/SegmentedControl.vue';

const OPTIONS = [
  { value: 1, label: '1 créneau', hint: '40 min' },
  { value: 2, label: '2 créneaux', hint: '1h20' },
];

function mountControl(props: Record<string, unknown> = {}) {
  return mount(SegmentedControl, {
    props: { options: OPTIONS, label: 'Durée', modelValue: 2, ...props },
  });
}

describe('SegmentedControl', () => {
  it('shows each option with its hint, the chosen one lit, under a name for screen readers', () => {
    const wrapper = mountControl();

    expect(wrapper.attributes('role')).toBe('radiogroup');
    expect(wrapper.attributes('aria-label')).toBe('Durée');
    const buttons = wrapper.findAll('button');
    expect(buttons.map(button => button.text())).toEqual(['1 créneau40 min', '2 créneaux1h20']);
    expect(buttons[1]!.classes()).toContain('active');
    expect(buttons[1]!.attributes('aria-checked')).toBe('true');
    expect(buttons[0]!.attributes('aria-checked')).toBe('false');
  });

  it('hands back the option clicked', async () => {
    const wrapper = mountControl();

    await wrapper.findAll('button')[0]!.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[1]]);
  });

  it('takes no click while disabled', () => {
    const wrapper = mountControl({ disabled: true });

    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true);
  });
});
