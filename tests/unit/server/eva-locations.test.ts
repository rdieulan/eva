// Tests for turning eva.gg locations into venues
import { describe, it, expect } from 'vitest';
import { toVenues, type EvaLocation } from '../../../server/src/integrations/eva/eva-locations';

function location(overrides: Partial<EvaLocation> = {}): EvaLocation {
  return {
    id: 57,
    name: 'Saint-Quentin',
    isClosed: false,
    telephone: '+33323043668',
    externalUrl: 'https://www.eva.gg/fr-FR/locations/saint-quentin',
    address: { street: '191 rue Georges Pompidou', city: 'Saint-Quentin' },
    socialNetworks: {
      discord: 'https://discord.gg/evasaintquentin',
      facebook: null,
      instagram: 'https://www.instagram.com/eva.saintquentin/',
      x: null,
      tiktok: null,
      youtube: null,
      twitch: null,
    },
    details: { terrains: [{ id: 124, games: [{ gameId: 1 }] }] },
    ...overrides,
  };
}

describe('toVenues', () => {
  it('keeps the eva.gg id so the sync can run again, and the links the venue publishes', () => {
    expect(toVenues([location()]).venues).toEqual([{
      externalId: 57,
      name: 'Saint-Quentin',
      city: 'Saint-Quentin',
      address: '191 rue Georges Pompidou',
      phone: '+33323043668',
      arenaCount: 1,
      website: 'https://www.eva.gg/fr-FR/locations/saint-quentin',
      discord: 'https://discord.gg/evasaintquentin',
      facebook: null,
      instagram: 'https://www.instagram.com/eva.saintquentin/',
      x: null,
      tiktok: null,
      youtube: null,
      twitch: null,
    }]);
  });

  it('keeps only links it can turn into a link: absolute http(s) URLs', () => {
    const venue = toVenues([location({
      externalUrl: '  ',
      socialNetworks: {
        discord: 'evasaintquentin',
        facebook: 'javascript:alert(1)',
        instagram: ' https://www.instagram.com/eva/ ',
        x: null,
        tiktok: null,
        youtube: null,
        twitch: null,
      },
    })]).venues[0]!;

    expect(venue.website).toBeNull();
    expect(venue.discord).toBeNull();
    expect(venue.facebook).toBeNull();
    expect(venue.instagram).toBe('https://www.instagram.com/eva/');
  });

  it('copes with a location that publishes no network at all', () => {
    const venue = toVenues([location({ externalUrl: null, socialNetworks: null })]).venues[0]!;

    expect(venue.discord).toBeNull();
    expect(venue.website).toBeNull();
  });

  it('keeps the city when it differs from the venue name', () => {
    const venues = toVenues([location({
      id: 64,
      name: 'Cannes',
      address: { street: '155 chemin de font Graissan', city: 'Mougins' },
    })]).venues;

    expect(venues[0]).toMatchObject({ name: 'Cannes', city: 'Mougins' });
  });

  it('falls back to the venue name when eva.gg gives no city', () => {
    const venues = toVenues([location({
      id: 69,
      name: 'Haguenau',
      address: { street: '24 rue de Niederbronn', city: null },
    })]).venues;

    expect(venues[0]).toMatchObject({ name: 'Haguenau', city: 'Haguenau' });
  });

  it('trims the spaces eva.gg leaves around phone numbers', () => {
    expect(toVenues([location({ telephone: '+33 7 49 10 57 69 ' })]).venues[0]!.phone)
      .toBe('+33 7 49 10 57 69');
  });

  it('stores no phone rather than an empty one', () => {
    expect(toVenues([location({ telephone: '  ' })]).venues[0]!.phone).toBeNull();
    expect(toVenues([location({ telephone: null })]).venues[0]!.phone).toBeNull();
  });

  it('reports what it cannot store instead of inventing it', () => {
    const result = toVenues([
      location({ id: 1, name: 'Fermée', isClosed: true }),
      location({ id: 2, name: 'Sans adresse', address: { street: null, city: 'Lyon' } }),
      location({ id: 3, name: 'Sans rien', address: null }),
      location({ id: 4, name: 'Bonne' }),
    ]);

    expect(result.venues.map(v => v.name)).toEqual(['Bonne']);
    expect(result.skipped).toEqual([
      { name: 'Fermée', reason: 'fermée' },
      { name: 'Sans adresse', reason: 'adresse absente' },
      { name: 'Sans rien', reason: 'adresse absente' },
    ]);
  });
});

describe('toVenues — arènes', () => {
  it('counts the arenas open to the competitive game', () => {
    const venues = toVenues([location({
      details: { terrains: [
        { id: 69, games: [{ gameId: 1 }, { gameId: 5 }] },
        { id: 70, games: [{ gameId: 1 }] },
      ] },
    })]).venues;

    expect(venues[0]!.arenaCount).toBe(2);
  });

  it('ignores the arenas reserved for their other games', () => {
    const venues = toVenues([location({
      details: { terrains: [
        { id: 63, games: [{ gameId: 1 }] },
        { id: 191, games: [{ gameId: 6 }] },
      ] },
    })]).venues;

    expect(venues[0]!.arenaCount).toBe(1);
  });

  it('counts one arena when eva.gg lists none', () => {
    expect(toVenues([location({ details: { terrains: [] } })]).venues[0]!.arenaCount).toBe(1);
    expect(toVenues([location({ details: { terrains: [{ id: 1, games: [{ gameId: 6 }] }] } })]).venues[0]!.arenaCount)
      .toBe(1);
  });
});
