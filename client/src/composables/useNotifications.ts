// The player's bell: how many notifications are unread, kept up to date while
// a tab shows the app, and the latest ones when the bell opens

import { ref } from 'vue';
import type { InboxNotification } from '@shared/types';
import { NOTIFICATION_POLL_INTERVAL_MS } from '@shared/constants';
import { fetchNotifications, fetchUnreadNotificationCount, markNotificationsRead } from '@/api';

// One bell for the whole app
const unreadCount = ref(0);
const notifications = ref<InboxNotification[]>([]);
const isLoading = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

async function refreshCount(): Promise<void> {
  try {
    unreadCount.value = await fetchUnreadNotificationCount();
  } catch {
    // Not worth an error anywhere: the count stays as it was until the next try
  }
}

// A tab shown again asks at once; a hidden tab asks nothing
function refreshWhenVisible(): void {
  if (document.visibilityState === 'visible') void refreshCount();
}

export function useNotifications() {
  // Follow the count: at once, then every minute while the tab is shown, and whenever it is shown again
  function start(): void {
    if (timer) return;
    void refreshCount();
    timer = setInterval(refreshWhenVisible, NOTIFICATION_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
  }

  // Stop following, and forget the bell: another account may sign in
  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', refreshWhenVisible);
    unreadCount.value = 0;
    notifications.value = [];
  }

  // Opening the bell reads it: the latest notifications, the unread ones then
  // marked as seen. They keep showing as new until the bell opens again.
  async function open(): Promise<void> {
    isLoading.value = true;
    try {
      const inbox = await fetchNotifications();
      notifications.value = inbox.notifications;
      unreadCount.value = inbox.unreadCount;
      const unread = inbox.notifications.filter(notification => !notification.isRead).map(notification => notification.id);
      if (unread.length) {
        await markNotificationsRead(unread);
        unreadCount.value = Math.max(0, inbox.unreadCount - unread.length);
      }
    } finally {
      isLoading.value = false;
    }
  }

  return { unreadCount, notifications, isLoading, start, stop, open };
}
