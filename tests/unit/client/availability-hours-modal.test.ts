// Tests for the hours of a partial availability: from when, until when, or both
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AvailabilityHoursModal from '@/components/calendar/AvailabilityHoursModal.vue';
import type { AvailabilityHours } from '@shared/types';

function mountModal(hours: AvailabilityHours | null = null) {
  return mount(AvailabilityHoursModal, {
    props: { open: true, date: '2026-11-12', hours },
    global: { stubs: { Teleport: true } },
  });
}

function saveButton(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.findAll('button').find(button => button.text() === 'Enregistrer')!;
}

describe('AvailabilityHoursModal', () => {
  it('opens on an evening when no hours are given, and saves them', async () => {
    const wrapper = mountModal();

    expect((wrapper.find('#hours-start').element as HTMLInputElement).value).toBe('20:00');
    expect((wrapper.find('#hours-end').element as HTMLInputElement).value).toBe('23:00');
    expect(wrapper.text()).toContain('Dispo pour jouer de 20:00 à 23:00');

    await saveButton(wrapper).trigger('click');
    expect(wrapper.emitted('save')).toEqual([[{ startTime: '20:00', endTime: '23:00' }]]);
  });

  it('opens on the hours already given, only the bound they have', () => {
    const wrapper = mountModal({ startTime: null, endTime: '22:00' });

    expect(wrapper.find('#hours-start').exists()).toBe(false);
    expect((wrapper.find('#hours-end').element as HTMLInputElement).value).toBe('22:00');
    expect(wrapper.find('[role="radio"][aria-checked="true"]').text()).toBe('Jusqu\'à …');
  });

  it('keeps the start alone once the hours run from it', async () => {
    const wrapper = mountModal({ startTime: '21:00', endTime: '23:30' });

    await wrapper.findAll('[role="radio"]').find(radio => radio.text() === 'Dès …')!.trigger('click');
    expect(wrapper.find('#hours-end').exists()).toBe(false);
    expect(wrapper.text()).toContain('Dispo pour jouer à partir de 21:00');

    await saveButton(wrapper).trigger('click');
    expect(wrapper.emitted('save')).toEqual([[{ startTime: '21:00', endTime: null }]]);
  });

  it('refuses an end that does not come after the start', async () => {
    const wrapper = mountModal();

    await wrapper.find('#hours-end').setValue('19:00');

    expect(wrapper.find('[role="alert"]').text()).toBe('La fin doit venir après le début.');
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined();
    await saveButton(wrapper).trigger('click');
    expect(wrapper.emitted('save')).toBeFalsy();
  });
});
