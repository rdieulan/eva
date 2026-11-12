// Tests for the matchmaking venue menu: the venues ticked at once, the team's own first, a star to make a favorite
import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MatchmakingVenuePicker from '@/components/calendar/MatchmakingVenuePicker.vue';
import { SCRIM_SEARCH_VENUES_MAX } from '@shared/constants';
import type { Venue } from '@shared/types';
import type { MatchmakingVenues } from '@/utils/venues';

function venue(id: string, name: string, city = name): Venue {
  return {
    id, slug: id, name, city, address: '', phone: null, arenaCount: 1, hasEvaSlots: true,
    website: null, discord: null, facebook: null, instagram: null, x: null, tiktok: null, youtube: null, twitch: null,
  };
}

const NIMES = venue('nimes', 'Nîmes');
const TOULOUSE = venue('toulouse', 'Toulouse Blagnac', 'Blagnac');
const AGEN = venue('agen', 'Agen');
const LYON = venue('lyon', 'Lyon');
const MARSEILLE = venue('marseille', 'Marseille');
const METZ = venue('metz', 'Metz');

const VENUES: MatchmakingVenues = { affiliated: NIMES, favorites: [TOULOUSE], others: [AGEN, LYON, MARSEILLE, METZ] };

let mounted: ReturnType<typeof mount> | null = null;

// The menu, opened, its model following what it emits
async function open(props: Record<string, unknown> = {}) {
  const wrapper = mount(MatchmakingVenuePicker, {
    props: {
      modelValue: ['nimes'],
      venues: VENUES,
      canEditFavorites: true,
      favoritesFull: false,
      savingFavorites: false,
      ...props,
    },
    attachTo: document.body,
  });
  wrapper.setProps({ 'onUpdate:modelValue': (ids: string[]) => wrapper.setProps({ modelValue: ids }) });
  mounted = wrapper;
  await wrapper.find('.venue-trigger').trigger('click');
  await flushPromises();
  return wrapper;
}

function rows(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.venue-option');
}

function rowOf(wrapper: ReturnType<typeof mount>, name: string) {
  return rows(wrapper).find(row => row.find('.venue-name').text() === name)!;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('MatchmakingVenuePicker', () => {
  it('names the ticked venues on its button, in the order of the menu', () => {
    const wrapper = mount(MatchmakingVenuePicker, {
      props: { modelValue: ['agen', 'nimes'], venues: VENUES, canEditFavorites: true, favoritesFull: false, savingFavorites: false },
    });
    expect(wrapper.find('.venue-trigger').text()).toBe('Nîmes, Agen');

    const none = mount(MatchmakingVenuePicker, {
      props: { modelValue: [], venues: VENUES, canEditFavorites: true, favoritesFull: false, savingFavorites: false },
    });
    expect(none.find('.venue-trigger').text()).toBe('Choisir une salle');
  });

  it('lists the affiliated venue first, then the favorites, then the rest, the search field focused', async () => {
    const wrapper = await open();

    expect(rows(wrapper).map(row => row.find('.venue-name').text())).toEqual(['Nîmes', 'Toulouse Blagnac', 'Agen', 'Lyon', 'Marseille', 'Metz']);
    expect(rowOf(wrapper, 'Nîmes').find('.venue-tag').text()).toBe('Affiliée');
    expect(rowOf(wrapper, 'Nîmes').find('.venue-star').exists()).toBe(false);
    expect(rowOf(wrapper, 'Toulouse Blagnac').find('.venue-star').attributes('aria-pressed')).toBe('true');
    expect(rowOf(wrapper, 'Agen').find('.venue-star').attributes('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(wrapper.find('.venue-search').element);
  });

  it('finds venues by name or town as the reader types', async () => {
    const wrapper = await open();

    await wrapper.find('.venue-search').setValue('blagn');
    expect(rows(wrapper).map(row => row.find('.venue-name').text())).toEqual(['Toulouse Blagnac']);

    await wrapper.find('.venue-search').setValue('zzz');
    expect(wrapper.find('.venue-checklist-empty').text()).toBe('Aucune salle ne correspond.');
  });

  it('ticks several venues, a few at most', async () => {
    const wrapper = await open();

    for (const name of ['Agen', 'Lyon', 'Marseille']) {
      await rowOf(wrapper, name).find('input').setValue(true);
    }

    expect(wrapper.props('modelValue')).toEqual(['nimes', 'agen', 'lyon', 'marseille']);
    expect(wrapper.props('modelValue')).toHaveLength(SCRIM_SEARCH_VENUES_MAX);
    expect(rowOf(wrapper, 'Metz').find('input').attributes('disabled')).toBeDefined();
    expect(wrapper.find('legend').text()).toBe(`Salles affichées, ${SCRIM_SEARCH_VENUES_MAX} au plus`);
  });

  it('asks to make a venue a favorite, or no longer one, from its star', async () => {
    const wrapper = await open();

    await rowOf(wrapper, 'Agen').find('.venue-star').trigger('click');
    await rowOf(wrapper, 'Toulouse Blagnac').find('.venue-star').trigger('click');

    expect(wrapper.emitted('toggle-favorite')).toEqual([['agen'], ['toulouse']]);
    // The star is not the box: the venue stays as it was ticked
    expect(wrapper.props('modelValue')).toEqual(['nimes']);
  });

  it('keeps a new favorite out of reach once the team has as many as it may, and while a change is on its way', async () => {
    const full = await open({ favoritesFull: true });
    expect(rowOf(full, 'Agen').find('.venue-star').attributes('disabled')).toBeDefined();
    expect(rowOf(full, 'Toulouse Blagnac').find('.venue-star').attributes('disabled')).toBeUndefined();
    full.unmount();

    const saving = await open({ savingFavorites: true });
    expect(rowOf(saving, 'Toulouse Blagnac').find('.venue-star').attributes('disabled')).toBeDefined();
  });

  it('shows the favorites without a button to a reader who cannot change them', async () => {
    const wrapper = await open({ canEditFavorites: false });

    expect(wrapper.find('button.venue-star').exists()).toBe(false);
    expect(rowOf(wrapper, 'Toulouse Blagnac').find('.venue-star--on').exists()).toBe(true);
    expect(rowOf(wrapper, 'Agen').find('.venue-star').exists()).toBe(false);
  });

  it('closes on Escape, and on a press outside', async () => {
    const wrapper = await open();

    await wrapper.find('.venue-panel').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('.venue-panel').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.find('.venue-trigger').element);

    await wrapper.find('.venue-trigger').trigger('click');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('.venue-panel').exists()).toBe(false);
  });
});
