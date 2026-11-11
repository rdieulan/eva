// Venue manager API client: the venues an account manages, their settings, the divisions of
// each one's local league as its manager arranges them, and the competitions
// the manager publishes in the venue's calendar

import type {
  ManagedVenue,
  VenueCompetitionView,
  VenueDivisions,
  VenueDivisionsRead,
  VenueEventSummary,
  VenueSettings,
} from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

const API_BASE = '/api/manager';

/** The venues the account manages, by name */
export async function fetchManagedVenues(): Promise<ManagedVenue[]> {
  return authFetch<ManagedVenue[]>(`${API_BASE}/venues`, undefined, ERROR.managedVenuesFetchFailed);
}

/** A venue's settings: its public information, as eva.gg publishes it, and its Discord channel */
export async function fetchVenueSettings(venueId: string): Promise<VenueSettings> {
  return authFetch<VenueSettings>(`${API_BASE}/venues/${encodeURIComponent(venueId)}`, undefined, ERROR.venueSettingsFetchFailed);
}

/** Read the venue again on eva.gg, once every five minutes at most; answers its settings as read */
export async function refreshVenueSettings(venueId: string): Promise<VenueSettings> {
  return authFetch<VenueSettings>(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/refresh`,
    { method: 'POST' },
    ERROR.venueRefreshFailed,
  );
}

/** Link a channel of the venue's own Discord, through its webhook: Discord takes a first message there before it is kept */
export async function linkVenueDiscord(venueId: string, webhookUrl: string): Promise<void> {
  await authFetch<{ discord: 'linked' }>(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/discord`,
    { method: 'PUT', body: JSON.stringify({ webhookUrl }) },
    ERROR.discordLinkFailed,
  );
}

/** Unlink the venue's Discord channel */
export async function unlinkVenueDiscord(venueId: string): Promise<void> {
  // Answers 204 with no body, so the JSON-parsing form of authFetch does not apply
  const response = await authFetch(`${API_BASE}/venues/${encodeURIComponent(venueId)}/discord`, { method: 'DELETE' });
  if (!response.ok) throw await ApiError.fromFailedResponse(response, ERROR.discordUnlinkFailed);
}

/** The divisions of a venue's league, as its manager last saved them */
export async function fetchVenueDivisions(venueId: string): Promise<VenueDivisions> {
  return authFetch<VenueDivisions>(`${API_BASE}/venues/${encodeURIComponent(venueId)}/divisions`, undefined, ERROR.divisionsFetchFailed);
}

/** Save a venue's divisions whole: how many, and each league team's place, column by column in order */
export async function saveVenueDivisions(
  venueId: string,
  divisions: { divisionCount: number; places: { leagueTeamId: string; division: number | null }[] },
): Promise<VenueDivisions> {
  return authFetch<VenueDivisions>(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/divisions`,
    { method: 'PUT', body: JSON.stringify(divisions) },
    ERROR.divisionsSaveFailed,
  );
}

/** The divisions of the last month drawn on competitive.eva.gg, for the board to start from; not saved */
export async function readVenueDivisions(venueId: string): Promise<VenueDivisionsRead> {
  return authFetch<VenueDivisionsRead>(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/divisions/read`,
    { method: 'POST' },
    ERROR.divisionsReadFailed,
  );
}

/** The venue's competitions to come, the soonest first */
export async function fetchVenueCompetitions(venueId: string): Promise<VenueCompetitionView[]> {
  return authFetch<VenueCompetitionView[]>(`${API_BASE}/venues/${encodeURIComponent(venueId)}/competitions`, undefined, ERROR.competitionsFetchFailed);
}

/** Publish a competition: a division's day, or a tournament of the venue */
export async function createVenueCompetition(venueId: string, competition: Omit<VenueCompetitionView, 'id' | 'answers'>): Promise<VenueCompetitionView> {
  return authFetch<VenueCompetitionView>(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/competitions`,
    { method: 'POST', body: JSON.stringify(competition) },
    ERROR.competitionSaveFailed,
  );
}

/** Withdraw a competition of the venue */
export async function deleteVenueCompetition(venueId: string, competitionId: string): Promise<void> {
  const response = await authFetch(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/competitions/${encodeURIComponent(competitionId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw await ApiError.fromFailedResponse(response, ERROR.competitionDeleteFailed);
}

/** The venue's events to come, the soonest first, and how many teams added each */
export async function fetchVenueEvents(venueId: string): Promise<VenueEventSummary[]> {
  return authFetch<VenueEventSummary[]>(`${API_BASE}/venues/${encodeURIComponent(venueId)}/events`, undefined, ERROR.venueEventsFetchFailed);
}

/** Publish an event, open to all */
export async function createVenueEvent(venueId: string, event: Omit<VenueEventSummary, 'id' | 'venueName' | 'teamsAdding'>): Promise<VenueEventSummary> {
  return authFetch<VenueEventSummary>(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/events`,
    { method: 'POST', body: JSON.stringify(event) },
    ERROR.venueEventSaveFailed,
  );
}

/** Withdraw an event of the venue */
export async function deleteVenueEvent(venueId: string, eventId: string): Promise<void> {
  const response = await authFetch(
    `${API_BASE}/venues/${encodeURIComponent(venueId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw await ApiError.fromFailedResponse(response, ERROR.venueEventDeleteFailed);
}
