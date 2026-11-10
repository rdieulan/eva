// Tests for the calendar event helpers: how each kind of event shows, and the order of a day
import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, VOICE_MEDIUMS } from '@shared/types';
import type { CalendarEvent } from '@shared/types';
import { getEventTypeClass, getEventTypeTitle, getVoiceMediumLabel, sortEventsByTime } from '@/utils/calendar';

describe('event type display', () => {
  it('gives every event type an icon-prefixed title', () => {
    expect(getEventTypeTitle('MATCH')).toBe('🎮 Match');
    expect(getEventTypeTitle('COMPETITION')).toBe('🏆 Compétition');
    expect(getEventTypeTitle('EVENT')).toBe('📅 Événement');
    expect(getEventTypeTitle('VOICE_MEETING')).toBe('🎧 Réunion vocale');
  });

  it('gives every event type a distinct CSS modifier', () => {
    const classes = EVENT_TYPES.map(getEventTypeClass);

    expect(classes).toEqual(['event-type--match', 'event-type--competition', 'event-type--event', 'event-type--voice-meeting']);
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

describe('events of a day', () => {
  it('come in the order they happen, in a new array', () => {
    const at = (startTime: string): CalendarEvent => ({
      id: startTime, date: '2030-06-10', startTime, endTime: '23:30', type: 'EVENT', title: startTime,
      evaSlotIds: [], createdById: 'p0', createdAt: '',
    });
    const events = [at('21:00'), at('09:30'), at('14:00')];

    expect(sortEventsByTime(events).map(event => event.startTime)).toEqual(['09:30', '14:00', '21:00']);
    expect(events.map(event => event.startTime)).toEqual(['21:00', '09:30', '14:00']);
  });
});
