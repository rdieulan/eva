// Legal pages API client: who publishes the app, as the deployment sets it

import type { Publisher } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

/** Who publishes the app, for its legal pages; open to anyone */
export async function fetchPublisher(): Promise<Publisher> {
  const { publisher } = await authFetch<{ publisher: Publisher }>('/api/public/legal', undefined, ERROR.publisherFetchFailed);
  return publisher;
}
