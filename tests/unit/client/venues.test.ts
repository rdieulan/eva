// Tests for the venue label shown in the pickers and the event screens
import { describe, it, expect } from 'vitest';
import { formatVenueLabel } from '@/utils/venues';

describe('formatVenueLabel', () => {
  it('drops the city when the venue is named after it', () => {
    expect(formatVenueLabel({ name: 'Agen', city: 'Agen' })).toBe('Agen');
  });

  it('ignores accents and case, the way a reader does', () => {
    expect(formatVenueLabel({ name: 'Nîmes', city: 'Nimes' })).toBe('Nîmes');
    expect(formatVenueLabel({ name: 'Brest', city: 'BREST' })).toBe('Brest');
    expect(formatVenueLabel({ name: 'Savigny Le Temple', city: 'SAVIGNY LE TEMPLE' }))
      .toBe('Savigny Le Temple');
  });

  it('drops the city when the name already says it', () => {
    expect(formatVenueLabel({ name: 'Toulouse Blagnac', city: 'Blagnac' })).toBe('Toulouse Blagnac');
    expect(formatVenueLabel({ name: 'Bordeaux-Lac', city: 'Bordeaux' })).toBe('Bordeaux-Lac');
  });

  it('keeps the city when the arena sits in another town', () => {
    expect(formatVenueLabel({ name: 'Cannes', city: 'Mougins' })).toBe('Cannes - Mougins');
    expect(formatVenueLabel({ name: 'Avignon', city: 'LE PONTET' })).toBe('Avignon - LE PONTET');
  });

  it('keeps the city when it is the more precise town', () => {
    expect(formatVenueLabel({ name: 'Metz', city: 'Moulins-lès-Metz' })).toBe('Metz - Moulins-lès-Metz');
    expect(formatVenueLabel({ name: 'Valence', city: 'Portes-lès-Valence' }))
      .toBe('Valence - Portes-lès-Valence');
  });
});
