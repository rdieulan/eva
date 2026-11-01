// The logo of the current player's team, shared by the top bar and the team page

import { ref } from 'vue';
import { fetchCurrentTeam } from '@/api';

// One value for the whole app: the top bar shows it, the team page changes it
const teamLogoUrl = ref<string | null>(null);

export function useTeamLogo() {
  async function load() {
    try {
      teamLogoUrl.value = (await fetchCurrentTeam())?.logoUrl ?? null;
    } catch {
      // Not worth an error anywhere: the bar simply shows no logo
      teamLogoUrl.value = null;
    }
  }

  function set(url: string | null) {
    teamLogoUrl.value = url;
  }

  function clear() {
    teamLogoUrl.value = null;
  }

  return { teamLogoUrl, load, set, clear };
}
