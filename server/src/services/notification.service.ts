// Notifications: the information of what happened, handed to every medium that
// tells it. A feature's service says what happened and to which team; this
// file finds the players it is for, keeps the information, and hands it to
// each channel. A channel only delivers: the words come from
// describeNotification (shared/utils), the same for every medium.

import type { Prisma } from '@prisma/client';
import { prisma } from '@db/prisma';
import type { AccountPermissions, NotificationContent } from '@shared/types';
import { normalizeAccountPermissions } from '@shared/utils';
import { logger } from '@utils/logger';
import { inboxChannel } from '@services/notification-inbox.service';
import { discordChannel } from '@services/notification-discord.service';

// A permission of a member, named by its category and its name
export type PermissionRef = {
  [C in keyof AccountPermissions]: { category: C; name: keyof AccountPermissions[C] };
}[keyof AccountPermissions];

// Who in a team a notification is for
export interface NotificationAudience {
  teamId: string;
  permission?: PermissionRef; // Only the members granted it; the leader holds them all
  exceptPlayerId?: string;    // The player who did it: nobody is told what they did themselves
}

// A notification as handed to a medium
export interface NotificationDelivery {
  notificationId: string;
  content: NotificationContent;
  teamId: string;      // The team it is told to: a team-wide medium (a chat channel) would post once for it
  playerIds: string[]; // The players it is for: a personal medium (the bell, a WhatsApp message) reaches each of them
}

// A medium that tells notifications
export interface NotificationChannel {
  name: string;
  deliver(delivery: NotificationDelivery): Promise<void>;
}

//TODO The bell and the team's Discord channel deliver today; WhatsApp waits for
// a Meta business account and its framing. It will implement
// NotificationChannel and join this list, with nothing to change in the
// services that notify. No mail: the players do not read it.
const CHANNELS: NotificationChannel[] = [inboxChannel, discordChannel];

// The members of the team the audience names, minus the one who did it
async function audiencePlayers(audience: NotificationAudience): Promise<string[]> {
  const members = await prisma.player.findMany({
    where: { teamId: audience.teamId },
    select: { id: true, permissions: true, ledTeam: { select: { id: true } } },
  });
  return members
    .filter(member => member.id !== audience.exceptPlayerId)
    .filter(member => {
      const { permission } = audience;
      if (!permission || member.ledTeam) return true;
      const granted = normalizeAccountPermissions(member.permissions)[permission.category] as unknown as Record<string, boolean>;
      return granted[permission.name as string] === true;
    })
    .map(member => member.id);
}

/**
 * Tell a team what happened: the players the audience names get it through
 * every channel. Never throws: what happened stays done whether or not it
 * could be told, and a failure is logged.
 */
export async function notify(content: NotificationContent, audience: NotificationAudience): Promise<void> {
  try {
    const playerIds = await audiencePlayers(audience);
    if (!playerIds.length) return;

    const notification = await prisma.notification.create({
      data: { kind: content.kind, data: content.data as unknown as Prisma.InputJsonValue, teamId: audience.teamId },
      select: { id: true },
    });
    const delivery: NotificationDelivery = { notificationId: notification.id, content, teamId: audience.teamId, playerIds };
    for (const channel of CHANNELS) {
      try {
        await channel.deliver(delivery);
      } catch (error) {
        logger.error(`Notification channel ${channel.name} could not deliver ${content.kind}:`, error);
      }
    }
  } catch (error) {
    logger.error(`Notification ${content.kind} could not be told:`, error);
  }
}
