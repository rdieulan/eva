// Subscription section of the profile page: load, edit and save the current player's subscription

import { ref, computed } from 'vue';
import type { PlayerSubscription, SubscriptionTier } from '@shared/types';
import { ERROR } from '@shared/constants';
import { getNextSubscriptionRenewal } from '@shared/utils';
import { fetchMySubscription, updateMySubscription } from '@/api';
import { formatDateStr } from '@/utils/calendar';
import { useErrors } from '@/composables/useErrors';

export function useSubscription() {
  const tier = ref<SubscriptionTier | null>(null);
  const renewalDate = ref(''); // '' when unset, as bound to <input type="date">
  const isLoading = ref(false);
  const isSaving = ref(false);
  const successMessage = ref('');
  const { errors, setErrorFromException, clearErrors } = useErrors();

  // Next renewal counted from today in the player's own timezone
  const nextRenewalDate = computed(() =>
    renewalDate.value ? getNextSubscriptionRenewal(renewalDate.value, formatDateStr(new Date())) : null,
  );

  function apply(subscription: PlayerSubscription) {
    tier.value = subscription.tier;
    renewalDate.value = subscription.renewalDate ?? '';
  }

  async function load() {
    isLoading.value = true;
    clearErrors();
    try {
      apply(await fetchMySubscription());
    } catch (e) {
      setErrorFromException(e, ERROR.subscriptionFetchFailed);
    } finally {
      isLoading.value = false;
    }
  }

  async function save() {
    isSaving.value = true;
    clearErrors();
    successMessage.value = '';
    try {
      apply(await updateMySubscription({
        tier: tier.value,
        renewalDate: renewalDate.value || null,
      }));
      successMessage.value = 'Abonnement enregistré';
    } catch (e) {
      setErrorFromException(e, ERROR.subscriptionUpdateFailed);
    } finally {
      isSaving.value = false;
    }
  }

  return {
    tier,
    renewalDate,
    nextRenewalDate,
    isLoading,
    isSaving,
    successMessage,
    errors,
    load,
    save,
  };
}
