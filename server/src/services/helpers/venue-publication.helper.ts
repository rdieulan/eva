// What a venue's manager publishes in the venue's calendar, a competition or an
// event: the same title, day, hours and description, checked the same way

import { ERROR, VENUE_PUBLICATION_DESCRIPTION_MAX, VENUE_PUBLICATION_TITLE_MAX } from '@shared/constants';
import { toParisTime } from '@shared/utils/date.utils';
import { isValidDate, isValidTime, isValidTimeRange } from './validation.helper';

/** A publication as its manager gives it */
export interface VenuePublicationInput {
  title: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  description: string | null;
}

/**
 * Check a publication: a title, a day from today in Paris on, hours that end
 * after they start, and a description of a few lines at most when there is
 * one. Answers it trimmed, or why it is refused.
 */
export function parseVenuePublication(input: Partial<VenuePublicationInput>, now: Date): { error: string } | VenuePublicationInput {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null;
  const { date, startTime, endTime } = input;
  if (
    !title || [...title].length > VENUE_PUBLICATION_TITLE_MAX
    || !isValidDate(date) || date < toParisTime(now).day
    || !isValidTime(startTime) || !isValidTime(endTime) || !isValidTimeRange(startTime, endTime)
  ) {
    return { error: ERROR.publicationInvalid };
  }
  if (description && [...description].length > VENUE_PUBLICATION_DESCRIPTION_MAX) {
    return { error: ERROR.publicationDescriptionTooLong };
  }
  return { title, date, startTime, endTime, description };
}
