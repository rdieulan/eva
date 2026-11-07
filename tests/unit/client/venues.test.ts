// Tests for the venue label shown wherever the app names a venue
import { describe, it, expect } from 'vitest';
import { formatVenueLabel } from '@/utils/venues';

describe('formatVenueLabel', () => {
  it('names a venue by its name alone, the town it is in', () => {
    expect(formatVenueLabel({ name: 'Nîmes' })).toBe('Nîmes');
    expect(formatVenueLabel({ name: 'Toulouse Blagnac' })).toBe('Toulouse Blagnac');
  });

  it('leaves out the town of its address, even when it is another one', () => {
    const avignon = { name: 'Avignon', city: 'LE PONTET' };
    const cannes = { name: 'Cannes', city: 'Mougins' };
    expect(formatVenueLabel(avignon)).toBe('Avignon');
    expect(formatVenueLabel(cannes)).toBe('Cannes');
  });

  it('drops the spaces around the name', () => {
    expect(formatVenueLabel({ name: '  Agen ' })).toBe('Agen');
  });
});
