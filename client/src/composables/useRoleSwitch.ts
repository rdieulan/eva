// Acting as one of the account's roles: player always, venue manager and admin
// when given by invitation. Switching changes this session only, and the app
// reloads on the role's own pages, so each role keeps to its own.
import { computed } from 'vue';
import type { AccountType } from '@shared/types';
import { ERROR } from '@shared/constants';
import { switchRole } from '@/api/auth.api';
import { landingPathForAccount } from '@/utils/landing';
import { useAuth } from '@/composables/useAuth';
import { useErrors } from '@/composables/useErrors';

/** What each role is, as the switches name it: a word, and what it opens */
export const ROLE_LABELS: Record<AccountType, { label: string; hint: string }> = {
  player: { label: 'Joueur', hint: 'Ton équipe, son calendrier, le matchmaking' },
  manager: { label: 'Gérant', hint: 'Les salles que tu gères' },
  admin: { label: 'Administrateur', hint: 'Les salles, les gérants, les administrateurs' },
};

export function useRoleSwitch() {
  const { account, setAuth } = useAuth();
  const { errors, setErrorFromException, clearErrors } = useErrors();

  const roles = computed(() => account.value?.roles ?? []);
  const current = computed(() => account.value?.accountType ?? null);

  async function actAs(role: AccountType) {
    if (role === current.value) return;
    clearErrors();
    try {
      const switched = await switchRole(role);
      setAuth(switched);
      // Hard-navigate to the role's landing page so all component state is
      // dropped and the global guards re-run against the role now acted as
      window.location.href = landingPathForAccount(switched);
    } catch (error) {
      setErrorFromException(error, ERROR.roleSwitchFailed);
    }
  }

  return { roles, current, actAs, errors };
}
