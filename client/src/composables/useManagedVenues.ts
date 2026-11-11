// The venues the session's manager manages, and the one in sight: shared by
// every tab of the manager's space, so that going from tab to tab keeps the
// venue. Read once per manager; another manager signing in reads their own.
import { computed, ref } from 'vue';
import type { ManagedVenue } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchManagedVenues } from '@/api';
import { ApiError } from '@/api/error';
import { useAuth } from '@/composables/useAuth';

const venues = ref<ManagedVenue[]>([]);
const venueId = ref<string | null>(null);
const isLoading = ref(false);
const errors = ref<string[]>([]);
// The manager the venues were read for
let readFor: string | null = null;

export function useManagedVenues() {
  const { account } = useAuth();

  const venue = computed(() => venues.value.find(candidate => candidate.id === venueId.value) ?? null);

  async function load() {
    const managerId = account.value?.managerId ?? null;
    if (!managerId || (readFor === managerId && !errors.value.length)) return;
    isLoading.value = true;
    errors.value = [];
    try {
      venues.value = await fetchManagedVenues();
      readFor = managerId;
      if (!venues.value.some(candidate => candidate.id === venueId.value)) venueId.value = venues.value[0]?.id ?? null;
    } catch (error) {
      errors.value = error instanceof ApiError ? error.errors : [ERROR.managedVenuesFetchFailed];
    } finally {
      isLoading.value = false;
    }
  }

  function select(id: string) {
    if (venues.value.some(candidate => candidate.id === id)) venueId.value = id;
  }

  return { venues, venue, isLoading, errors, load, select };
}
