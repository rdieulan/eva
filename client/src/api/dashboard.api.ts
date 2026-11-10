// Home dashboard API client: what the player has to do soon, and the team's
// league registration read again at once

import type { Dashboard } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

/** What the player has to do soon, the most pressing first; with nothing to do, the team's next match */
export async function fetchDashboard(): Promise<Dashboard> {
  return authFetch<Dashboard>('/api/dashboard', undefined, ERROR.dashboardFetchFailed);
}

/** Read the team's league registration again at once; answers the months it is registered to */
export async function checkLeagueRegistration(): Promise<string[]> {
  const { registered } = await authFetch<{ registered: string[] }>(
    '/api/dashboard/league-registration/check',
    { method: 'POST' },
    ERROR.leagueCheckFailed,
  );
  return registered;
}
