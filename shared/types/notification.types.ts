// Notifications: what happened, told to the players of a team. Information
// only: each medium (the app's bell today; mail, Discord or WhatsApp later)
// tells it its own way, from the same facts and in the same words
// (describeNotification, shared/utils).

import type { ScrimDeclineReason } from './scrim.types';

/**
 * What a notification tells. Mirrors the NotificationKind enum in
 * prisma/schema.prisma.
 */
export const NOTIFICATION_KINDS = [
  'SCRIM_PROPOSAL_RECEIVED',
  'SCRIM_MATCH_MADE',
  'SCRIM_PROPOSAL_DECLINED',
  'SCRIM_SEARCH_WITHDRAWN',
  'SCRIM_MATCH_CANCELLED',
  'SCRIM_SEARCH_EXPIRED',
] as const;

export type NotificationKind = typeof NOTIFICATION_KINDS[number];

/** Where and when a match is, or would be, played */
export interface ScrimMatchFacts {
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:mm
  endTime: string;            // HH:mm
  venueId: string;
  venueName: string;
  arenaNumber: number | null; // Named when the venue has more than one arena
}

/** What a notification tells, kind by kind: the facts it needs, as they were when it happened */
export type NotificationContent =
  | { kind: 'SCRIM_PROPOSAL_RECEIVED'; data: ScrimMatchFacts & { searchId: string; teamName: string; message: string | null } }
  | { kind: 'SCRIM_MATCH_MADE'; data: ScrimMatchFacts & { eventId: string; opponentName: string } }
  | { kind: 'SCRIM_PROPOSAL_DECLINED'; data: ScrimMatchFacts & { searchId: string; teamName: string; reason: ScrimDeclineReason } }
  | { kind: 'SCRIM_SEARCH_WITHDRAWN'; data: ScrimMatchFacts & { teamName: string } }
  | { kind: 'SCRIM_MATCH_CANCELLED'; data: ScrimMatchFacts & { opponentName: string; byOpponent: boolean } }
  | { kind: 'SCRIM_SEARCH_EXPIRED'; data: { searchId: string; date: string } };

/** A notification in the app's bell */
export type InboxNotification = NotificationContent & {
  id: string;
  createdAt: string; // ISO date-time
  isRead: boolean;
};

/** The app's bell: the latest notifications of a player, and how many they have not seen */
export interface NotificationInbox {
  notifications: InboxNotification[]; // Newest first
  unreadCount: number;
}

/** Marking notifications of the bell as seen */
export interface MarkNotificationsReadRequest {
  ids: string[];
}

/**
 * Where a notification leads, whatever the medium: the bell turns it into a
 * route of the app, a mail or a chat message would turn it into a link
 */
export interface NotificationTarget {
  page: 'calendar';
  date: string;                   // YYYY-MM-DD, the day to show
  mode: 'team' | 'matchmaking';
  venueId?: string;               // In matchmaking, a venue to tick: where the search is
  open?: { kind: 'scrimSearch' | 'event'; id: string }; // What to open on that day, when it is still there
}

/** A notification put in words, for any medium */
export interface NotificationDescription {
  title: string;         // What happened, in a few words
  body: string;          // Who, when and where
  detail: string | null; // A word more: the reason, the message, what to do next
  target: NotificationTarget;
}
