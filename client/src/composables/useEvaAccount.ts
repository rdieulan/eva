// The current player's eva.gg account, for the profile and the walk-through:
// load it, link one, change it for another. A player never goes without one:
// there is no unlinking, only an administrator frees an account.

import { ref, computed } from 'vue';
import type { EvaAccountLink } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchMyEvaAccount, linkMyEvaAccount } from '@/api';
import { useErrors } from '@/composables/useErrors';

export function useEvaAccount() {
  const link = ref<EvaAccountLink | null>(null);
  const username = ref(''); // The tag being typed, cleared once linked
  const isChanging = ref(false); // The linked account being changed for another
  const isLoading = ref(false);
  const isLinking = ref(false);
  const successMessage = ref('');
  const { errors, setError, setErrorFromException, clearErrors } = useErrors();

  const isBusy = computed(() => isLoading.value || isLinking.value);

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

  // Link the tag typed, in place of the account linked before if there is one
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
      const wasLinked = link.value !== null;
      link.value = await linkMyEvaAccount(tag);
      username.value = '';
      isChanging.value = false;
      successMessage.value = wasLinked ? 'Compte eva.gg changé' : 'Compte eva.gg lié';
    } catch (e) {
      setErrorFromException(e, ERROR.evaAccountLinkFailed);
    } finally {
      isLinking.value = false;
    }
  }

  // Change the linked account for another: the one linked stays until the new one is
  function startChange() {
    clearErrors();
    successMessage.value = '';
    username.value = '';
    isChanging.value = true;
  }

  function cancelChange() {
    clearErrors();
    username.value = '';
    isChanging.value = false;
  }

  return {
    link,
    username,
    linkedOn,
    isLoading,
    isLinking,
    isChanging,
    isBusy,
    successMessage,
    errors,
    load,
    linkAccount,
    startChange,
    cancelChange,
  };
}
