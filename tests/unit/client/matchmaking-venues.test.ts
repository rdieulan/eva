// Tests for the venues the matchmaking menu lists, and how a typed name finds them
import { describe, it, expect } from 'vitest';
import { groupMatchmakingVenues, venueMatches } from '@/utils/venues';
import type { Venue } from '@shared/types';

function venue(id: string, name: string, hasEvaSlots = true, city = name): Venue {
  return {
    id,
    name,
    city,
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
const TOULOUSE = venue('toulouse', 'Toulouse Blagnac', true, 'Blagnac');
const AGEN = venue('agen', 'Agen');
const LYON = venue('lyon', 'Lyon');
const HAND_MADE = venue('hand', 'Salle à la main', false);

describe('groupMatchmakingVenues', () => {
  it('puts the affiliated venue first, then the favorites in the team order, then the rest alphabetically', () => {
    const { affiliated, favorites, others } = groupMatchmakingVenues(
      [LYON, TOULOUSE, AGEN, NIMES],
      { venueId: 'nimes', favoriteVenueIds: ['toulouse'] },
    );
    expect(affiliated?.id).toBe('nimes');
    expect(favorites.map(v => v.id)).toEqual(['toulouse']);
    expect(others.map(v => v.id)).toEqual(['agen', 'lyon']);
  });

  it('keeps the favorites in the order the team gave them', () => {
    const { favorites } = groupMatchmakingVenues([AGEN, LYON, TOULOUSE], { venueId: null, favoriteVenueIds: ['toulouse', 'agen'] });
    expect(favorites.map(v => v.id)).toEqual(['toulouse', 'agen']);
  });

  it('does not repeat the affiliated venue when it is also a favorite', () => {
    const { affiliated, favorites } = groupMatchmakingVenues([NIMES, AGEN], { venueId: 'nimes', favoriteVenueIds: ['nimes', 'agen'] });
    expect(affiliated?.id).toBe('nimes');
    expect(favorites.map(v => v.id)).toEqual(['agen']);
  });

  it('leaves out venues that have no slots on eva.gg, even as the team\'s own', () => {
    const { affiliated, favorites, others } = groupMatchmakingVenues([HAND_MADE, NIMES], { venueId: 'hand', favoriteVenueIds: ['hand'] });
    expect(affiliated).toBeNull();
    expect(favorites).toEqual([]);
    expect(others.map(v => v.id)).toEqual(['nimes']);
  });

  it('works without a team', () => {
    const { affiliated, favorites, others } = groupMatchmakingVenues([NIMES], null);
    expect(affiliated).toBeNull();
    expect(favorites).toEqual([]);
    expect(others.map(v => v.id)).toEqual(['nimes']);
  });
});

describe('venueMatches', () => {
  it('finds a venue by its name or its town, accents and case aside', () => {
    expect(venueMatches(NIMES, 'nimes')).toBe(true);
    expect(venueMatches(NIMES, 'NÎM')).toBe(true);
    expect(venueMatches(TOULOUSE, 'blagnac')).toBe(true);
    expect(venueMatches(TOULOUSE, 'lyon')).toBe(false);
  });

  it('lets every venue through when nothing is typed', () => {
    expect(venueMatches(AGEN, '')).toBe(true);
    expect(venueMatches(AGEN, '   ')).toBe(true);
  });
});
