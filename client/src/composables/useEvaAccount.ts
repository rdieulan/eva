// eva.gg section of the profile page: load, link and unlink the current player's eva.gg account

import { ref, computed } from 'vue';
import type { EvaAccountLink } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchMyEvaAccount, linkMyEvaAccount, unlinkMyEvaAccount } from '@/api';
import { useErrors } from '@/composables/useErrors';

export function useEvaAccount() {
  const link = ref<EvaAccountLink | null>(null);
  const username = ref(''); // The tag being typed, cleared once linked
  const isLoading = ref(false);
  const isLinking = ref(false);
  const isUnlinking = ref(false);
  const successMessage = ref('');
  const { errors, setError, setErrorFromException, clearErrors } = useErrors();

  const isBusy = computed(() => isLoading.value || isLinking.value || isUnlinking.value);

  // Day the account was linked, in the player's own timezone
  const linkedOn = computed(() =>
    link.value
      ? new Date(link.value.linkedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : null,
  );

  async function load() {
    isLoading.value = true;
    clearErrors();
    try {
      link.value = await fetchMyEvaAccount();
    } catch (e) {
      setErrorFromException(e, ERROR.evaAccountFetchFailed);
    } finally {
      isLoading.value = false;
    }
  }

  async function linkAccount() {
    clearErrors();
    successMessage.value = '';

    const tag = username.value.trim();
    if (!tag) {
      setError(ERROR.evaUsernameRequired);
      return;
    }

    isLinking.value = true;
    try {
      link.value = await linkMyEvaAccount(tag);
      username.value = '';
      successMessage.value = 'Compte eva.gg lié';
    } catch (e) {
      setErrorFromException(e, ERROR.evaAccountLinkFailed);
    } finally {
      isLinking.value = false;
    }
  }

  async function unlinkAccount() {
    clearErrors();
    successMessage.value = '';
    isUnlinking.value = true;
    try {
      await unlinkMyEvaAccount();
      link.value = null;
      successMessage.value = 'Lien eva.gg supprimé';
    } catch (e) {
      setErrorFromException(e, ERROR.evaAccountUnlinkFailed);
    } finally {
      isUnlinking.value = false;
    }
  }

  return {
    link,
    username,
    linkedOn,
    isLoading,
    isLinking,
    isUnlinking,
    isBusy,
    successMessage,
    errors,
    load,
    linkAccount,
    unlinkAccount,
  };
}
