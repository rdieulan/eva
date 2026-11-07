// Tests for the list of venues to tick, shared by the team page, the admin and the matchmaking menu
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import VenueChecklist from '@/components/common/VenueChecklist.vue';
import type { Venue } from '@shared/types';

function venue(id: string, name: string): Venue {
  return {
    id, name, city: name, address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
    website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
  };
}

const VENUES = [venue('nimes', 'Nîmes'), venue('agen', 'Agen'), venue('lyon', 'Lyon')];

function mountList(props: Record<string, unknown> = {}, slots = {}) {
  const wrapper = mount(VenueChecklist, {
    props: { venues: VENUES, legend: 'Salles', modelValue: [], ...props },
    slots,
  });
  wrapper.setProps({ 'onUpdate:modelValue': (ids: string[]) => wrapper.setProps({ modelValue: ids }) });
  return wrapper;
}

describe('VenueChecklist', () => {
  it('keeps the ticked venues in the order they were ticked', async () => {
    const wrapper = mountList();
    const boxes = wrapper.findAll('input[type="checkbox"]');

    await boxes[2]!.setValue(true);
    await boxes[0]!.setValue(true);
    expect(wrapper.props('modelValue')).toEqual(['lyon', 'nimes']);

    await boxes[2]!.setValue(false);
    expect(wrapper.props('modelValue')).toEqual(['nimes']);
  });

  it('locks the unticked venues once the most allowed are ticked', () => {
    const wrapper = mountList({ modelValue: ['nimes', 'agen'], max: 2 });
    const boxes = wrapper.findAll('input[type="checkbox"]');

    expect(boxes[2]!.attributes('disabled')).toBeDefined();
    expect(boxes[0]!.attributes('disabled')).toBeUndefined();
  });

  it('puts what the caller gives beside each venue, outside its box', () => {
    const wrapper = mountList({}, { trailing: ({ venue: item }: { venue: Venue }) => h('button', { class: 'extra' }, item.name) });

    const rows = wrapper.findAll('.venue-option');
    expect(rows.map(row => row.find('.extra').text())).toEqual(['Nîmes', 'Agen', 'Lyon']);
    // A button inside the label would tick the venue when pressed
    expect(wrapper.find('label .extra').exists()).toBe(false);
  });

  it('says so when there is no venue to show', () => {
    const wrapper = mountList({ venues: [], emptyText: 'Rien ici.' });
    expect(wrapper.find('.venue-checklist-empty').text()).toBe('Rien ici.');
  });
});
