// Notifications API client: the bell of the signed-in player

import type { MarkNotificationsReadRequest, NotificationInbox } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

const API_BASE = '/api/notifications';

/**
 * The latest notifications of the player's bell, newest first, and how many are unread
 */
export async function fetchNotifications(): Promise<NotificationInbox> {
  return authFetch<NotificationInbox>(API_BASE, undefined, ERROR.notificationsLoadFailed);
}

/**
 * How many notifications the player has not seen
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { unreadCount } = await authFetch<{ unreadCount: number }>(`${API_BASE}/unread-count`, undefined, ERROR.notificationsLoadFailed);
  return unreadCount;
}

/**
 * Mark notifications of the player's bell as seen
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  const body: MarkNotificationsReadRequest = { ids };
  // Answers 204 with no body, so the JSON-parsing form of authFetch does not apply
  const response = await authFetch(`${API_BASE}/read`, { method: 'PUT', body: JSON.stringify(body) });
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.notificationsReadFailed);
  }
}
