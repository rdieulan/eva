// Tests for turning eva.gg locations into venues
import { describe, it, expect } from 'vitest';
import { toVenues, type EvaLocation } from '../../../scripts/lib/eva-locations';

function location(overrides: Partial<EvaLocation> = {}): EvaLocation {
  return {
    id: 57,
    name: 'Saint-Quentin',
    isClosed: false,
    telephone: '+33323043668',
    address: { street: '191 rue Georges Pompidou', city: 'Saint-Quentin' },
    ...overrides,
  };
}

describe('toVenues', () => {
  it('keeps the eva.gg id so the sync can run again', () => {
    expect(toVenues([location()]).venues).toEqual([{
      externalId: 57,
      name: 'Saint-Quentin',
      city: 'Saint-Quentin',
      address: '191 rue Georges Pompidou',
      phone: '+33323043668',
    }]);
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
