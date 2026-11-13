// Who publishes the app, as the deployment sets it, for the legal pages: read
// when a page opens

import { onMounted, ref } from 'vue';
import type { Publisher } from '@shared/types';
import { ERROR } from '@shared/constants';
import { fetchPublisher } from '@/api';
import { useErrors } from '@/composables/useErrors';

export function usePublisher() {
  const publisher = ref<Publisher | null>(null);
  const { errors, setErrorFromException } = useErrors();

  onMounted(async () => {
    try {
      publisher.value = await fetchPublisher();
    } catch (error) {
      setErrorFromException(error, ERROR.publisherFetchFailed);
    }
  });

  return { publisher, errors };
}
