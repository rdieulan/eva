// Tests for the calendar event type display helpers
import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, VOICE_MEDIUMS } from '@shared/types';
import { getEventTypeClass, getEventTypeTitle, getVoiceMediumLabel } from '@/utils/calendar';

describe('event type display', () => {
  it('gives every event type an icon-prefixed title', () => {
    expect(getEventTypeTitle('MATCH')).toBe('🎮 Match');
    expect(getEventTypeTitle('EVENT')).toBe('📅 Événement');
    expect(getEventTypeTitle('VOICE_MEETING')).toBe('🎧 Réunion vocale');
  });

  it('gives every event type a distinct CSS modifier', () => {
    const classes = EVENT_TYPES.map(getEventTypeClass);

    expect(classes).toEqual(['event-type--match', 'event-type--event', 'event-type--voice-meeting']);
    expect(new Set(classes).size).toBe(EVENT_TYPES.length);
  });
});

describe('voice medium display', () => {
  it('writes each platform the way its makers do', () => {
    expect(getVoiceMediumLabel('DISCORD')).toBe('Discord');
    expect(getVoiceMediumLabel('TEAMSPEAK')).toBe('TeamSpeak');
    expect(getVoiceMediumLabel('WHATSAPP')).toBe('WhatsApp');
    expect(getVoiceMediumLabel('GOOGLE_MEET')).toBe('Google Meet');
    expect(getVoiceMediumLabel('OTHER')).toBe('Autre');
  });

  it('names every platform, with no name used twice', () => {
    const labels = VOICE_MEDIUMS.map(getVoiceMediumLabel);

    expect(labels.every(label => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(VOICE_MEDIUMS.length);
  });
});
