// Tests for the calendar event type display helpers
import { describe, it, expect } from 'vitest';
import { EVENT_TYPES } from '@shared/types';
import { getEventTypeClass, getEventTypeTitle } from '@/utils/calendar';

describe('event type display', () => {
  it('gives every event type an icon-prefixed title', () => {
    expect(getEventTypeTitle('MATCH')).toBe('🎮 Match');
    expect(getEventTypeTitle('EVENT')).toBe('📅 Événement');
    expect(getEventTypeTitle('DISCORD')).toBe('🎧 Discord');
  });

  it('gives every event type a distinct CSS modifier', () => {
    const classes = EVENT_TYPES.map(getEventTypeClass);

    expect(classes).toEqual(['event-type--match', 'event-type--event', 'event-type--discord']);
    expect(new Set(classes).size).toBe(EVENT_TYPES.length);
  });
});
