// Notification routes - the app's bell of the signed-in player; HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { MarkNotificationsReadRequest } from '@shared/types';
import { ERROR, NOTIFICATION_INBOX_SIZE } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as notificationInboxService from '@services/notification-inbox.service';

const router = Router();

// GET /api/notifications - The latest notifications of the player's bell, and how many are unread
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    return res.status(403).json({ errors: [ERROR.playerAccountRequired] });
  }

  try {
    res.json(await notificationInboxService.getInbox(playerId));
  } catch (error) {
    apiLogger.error('Error loading notifications:', error);
    res.status(500).json({ errors: [ERROR.notificationsLoadFailed] });
  }
});

// GET /api/notifications/unread-count - How many notifications the player has not seen; an open tab asks every minute
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    return res.status(403).json({ errors: [ERROR.playerAccountRequired] });
  }

  try {
    res.json({ unreadCount: await notificationInboxService.countUnread(playerId) });
  } catch (error) {
    apiLogger.error('Error counting unread notifications:', error);
    res.status(500).json({ errors: [ERROR.notificationsLoadFailed] });
  }
});

// PUT /api/notifications/read - Mark notifications of the player's bell as seen, those the bell showed
router.put('/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    return res.status(403).json({ errors: [ERROR.playerAccountRequired] });
  }

  const { ids } = (req.body ?? {}) as MarkNotificationsReadRequest;
  const isValid = Array.isArray(ids)
    && ids.length <= NOTIFICATION_INBOX_SIZE
    && ids.every(id => typeof id === 'string' && id.length > 0);
  if (!isValid) {
    return res.status(400).json({ errors: [ERROR.notificationsReadInvalid] });
  }

  try {
    await notificationInboxService.markRead(playerId, ids);
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error marking notifications as read:', error);
    res.status(500).json({ errors: [ERROR.notificationsReadFailed] });
  }
});

export default router;
