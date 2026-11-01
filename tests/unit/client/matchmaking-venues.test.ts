// Tests for the venues the matchmaking picker offers
import { describe, it, expect } from 'vitest';
import { splitMatchmakingVenues } from '@/utils/venues';
import type { Venue } from '@shared/types';

function venue(id: string, name: string, hasEvaSlots = true): Venue {
  return {
    id,
    name,
    city: name,
    address: '',
    phone: null,
    arenaCount: 1,
    hasEvaSlots,
    website: null,
    discord: null,
    facebook: null,
    instagram: null,
    x: null,
    tiktok: null,
    youtube: null,
    twitch: null,
  };
}

const NIMES = venue('nimes', 'Nîmes');
const TOULOUSE = venue('toulouse', 'Toulouse Blagnac');
const AGEN = venue('agen', 'Agen');
const LYON = venue('lyon', 'Lyon');
const HAND_MADE = venue('hand', 'Salle à la main', false);

describe('splitMatchmakingVenues', () => {
  it('puts the affiliated venue first, then the favorites in the team order', () => {
    const { quick } = splitMatchmakingVenues(
      [AGEN, LYON, NIMES, TOULOUSE],
      { venueId: 'nimes', favoriteVenueIds: ['toulouse', 'agen'] },
    );
    expect(quick.map(v => v.id)).toEqual(['nimes', 'toulouse', 'agen']);
  });

  it('does not repeat the affiliated venue when it is also a favorite', () => {
    const { quick } = splitMatchmakingVenues([NIMES, AGEN], { venueId: 'nimes', favoriteVenueIds: ['nimes', 'agen'] });
    expect(quick.map(v => v.id)).toEqual(['nimes', 'agen']);
  });

  it('lists the rest of the network alphabetically', () => {
    const { others } = splitMatchmakingVenues([TOULOUSE, NIMES, AGEN, LYON], { venueId: 'nimes', favoriteVenueIds: [] });
    expect(others.map(v => v.id)).toEqual(['agen', 'lyon', 'toulouse']);
  });

  it('leaves out venues that have no slots on eva.gg, even as favorites', () => {
    const { quick, others } = splitMatchmakingVenues([HAND_MADE, NIMES], { venueId: 'hand', favoriteVenueIds: ['hand'] });
    expect(quick).toEqual([]);
    expect(others.map(v => v.id)).toEqual(['nimes']);
  });

  it('works without a team', () => {
    const { quick, others } = splitMatchmakingVenues([NIMES], null);
    expect(quick).toEqual([]);
    expect(others.map(v => v.id)).toEqual(['nimes']);
  });
});
