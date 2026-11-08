// The app's bell: the notifications delivered to each player, whether they
// saw them, kept a month (NOTIFICATION_RETENTION_DAYS)

import { prisma } from '@db/prisma';
import type { InboxNotification, NotificationContent, NotificationInbox } from '@shared/types';
import { NOTIFICATION_INBOX_SIZE, NOTIFICATION_RETENTION_DAYS } from '@shared/constants';
import type { NotificationChannel } from '@services/notification.service';
import { logger } from '@utils/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

// How often the notifications past the retention are deleted
export const NOTIFICATION_PURGE_INTERVAL_MS = 60 * 60 * 1000;

// The bell as a medium: one inbox entry per player
export const inboxChannel: NotificationChannel = {
  name: 'inbox',
  async deliver({ notificationId, playerIds }) {
    await prisma.notificationInboxEntry.createMany({
      data: playerIds.map(playerId => ({ notificationId, playerId })),
      skipDuplicates: true,
    });
  },
};

/** How many notifications of a player's bell they have not seen */
export async function countUnread(playerId: string): Promise<number> {
  return prisma.notificationInboxEntry.count({ where: { playerId, readAt: null } });
}

/** The latest notifications of a player's bell, newest first, and how many they have not seen */
export async function getInbox(playerId: string): Promise<NotificationInbox> {
  const [entries, unreadCount] = await Promise.all([
    prisma.notificationInboxEntry.findMany({
      where: { playerId },
      orderBy: [{ notification: { createdAt: 'desc' } }, { notificationId: 'desc' }],
      take: NOTIFICATION_INBOX_SIZE,
      select: { readAt: true, notification: { select: { id: true, kind: true, data: true, createdAt: true } } },
    }),
    countUnread(playerId),
  ]);

  const notifications = entries.map((entry): InboxNotification => {
    const { id, kind, data, createdAt } = entry.notification;
    // Stored by notify() from a NotificationContent: its kind and its data go together
    const content = { kind, data } as unknown as NotificationContent;
    return { ...content, id, createdAt: createdAt.toISOString(), isRead: entry.readAt !== null };
  });
  return { notifications, unreadCount };
}

/** Mark notifications of a player's bell as seen; nobody else's entries are touched */
export async function markRead(playerId: string, notificationIds: string[]): Promise<void> {
  await prisma.notificationInboxEntry.updateMany({
    where: { playerId, notificationId: { in: notificationIds }, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Delete the notifications past the retention, with their inbox entries; answers how many went */
export async function purgeOldNotifications(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS);
  const purged = await prisma.notification.deleteMany({ where: { createdAt: { lt: before } } });
  return purged.count;
}

/** Delete old notifications every hour */
export function startNotificationPurge(): void {
  setInterval(() => {
    purgeOldNotifications()
      .then(count => {
        if (count) logger.info(`Notifications past their retention deleted: ${count}`);
      })
      .catch(error => logger.error('Notification purge failed', error));
  }, NOTIFICATION_PURGE_INTERVAL_MS);
}
