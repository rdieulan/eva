// Venue manager API client: the venues an account manages, and the divisions
// of each one's local league as its manager arranges them

import type { ManagedVenue, VenueDivisions, VenueDivisionsRead } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

const API_BASE = '/api/manager';

/** The venues the account manages, by name */
export async function fetchManagedVenues(): Promise<ManagedVenue[]> {
  return authFetch<ManagedVenue[]>(`${API_BASE}/venues`, undefined, ERROR.managedVenuesFetchFailed);
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
