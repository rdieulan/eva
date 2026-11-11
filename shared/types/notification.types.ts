// Notifications: what happened, told to the players of a team. Information
// only: each medium (the app's bell and the team's Discord channel today)
// tells it its own way, from the same facts and in the same words
// (describeNotification, shared/utils).

import type { CalendarTarget } from './calendar.types';
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
  'TEAM_JOIN_REQUESTED',
  'LEAGUE_REGISTRATION_OPEN',
  'LEAGUE_REGISTRATION_CLOSING',
  'COMPETITION_OFFERED',
  'COMPETITION_ADDED',
  'COMPETITION_WITHDRAWN',
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
  evaLocationId?: number | null; // The venue on eva.gg, where to book a seat; missing from the notifications told before
}

/** A month of the team's local league whose registration is open, the team not registered to it */
export interface LeagueRegistrationFacts {
  tournamentId: string;   // Its id on competitive.eva.gg
  tournamentName: string; // "NEMAUSUS LEAGUE - DÉCEMBRE"
  closesAt: string;       // ISO date-time: the registration closes then
}

/** A competition the team's venue published for it: a day of the team's division, or a tournament of the venue */
export interface CompetitionFacts {
  title: string;              // "Journée de la Division 2"
  venueName: string;
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:mm
  endTime: string;            // HH:mm
  description: string | null; // The venue's own words
}

/** What a notification tells, kind by kind: the facts it needs, as they were when it happened */
export type NotificationContent =
  | { kind: 'SCRIM_PROPOSAL_RECEIVED'; data: ScrimMatchFacts & OtherTeam<'team'> & { searchId: string; message: string | null } }
  | { kind: 'SCRIM_MATCH_MADE'; data: ScrimMatchFacts & OtherTeam<'opponent'> & { eventId: string } }
  | { kind: 'SCRIM_PROPOSAL_DECLINED'; data: ScrimMatchFacts & OtherTeam<'team'> & { searchId: string; reason: ScrimDeclineReason } }
  | { kind: 'SCRIM_SEARCH_WITHDRAWN'; data: ScrimMatchFacts & OtherTeam<'team'> }
  | { kind: 'SCRIM_MATCH_CANCELLED'; data: ScrimMatchFacts & OtherTeam<'opponent'> & { byOpponent: boolean } }
  | { kind: 'SCRIM_SEARCH_EXPIRED'; data: { searchId: string; date: string } }
  | { kind: 'TEAM_JOIN_REQUESTED'; data: { requestId: string; playerName: string; evaUsername: string | null } }
  | { kind: 'LEAGUE_REGISTRATION_OPEN'; data: LeagueRegistrationFacts }
  | { kind: 'LEAGUE_REGISTRATION_CLOSING'; data: LeagueRegistrationFacts }
  | { kind: 'COMPETITION_OFFERED'; data: CompetitionFacts }
  | { kind: 'COMPETITION_ADDED'; data: CompetitionFacts & { eventId: string } }
  | { kind: 'COMPETITION_WITHDRAWN'; data: CompetitionFacts & { accepted: boolean } }; // accepted: it was in the team's calendar

/**
 * The other team of a notification, its name and its id (for the media that
 * show its logo; missing from the notifications told before), under the name
 * the notification gives it: "team" (teamName, teamId) or "opponent"
 * (opponentName, opponentId). The team told is the notification's own.
 */
export type OtherTeam<Role extends 'team' | 'opponent'> =
  & { [K in `${Role}Name`]: string }
  & { [K in `${Role}Id`]?: string };

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

/** The page of the team told: its members, and the requests to join it */
export interface TeamPageTarget {
  page: 'team';
}

/** The home of the player told: what the team has to do, a competition to answer among it */
export interface HomePageTarget {
  page: 'home';
}

/** Where a notification leads, whatever the medium: a day of the calendar, the team page, or the home */
export type NotificationTarget = CalendarTarget | TeamPageTarget | HomePageTarget;

/**
 * A notification put in words, for any medium: whole lines for a list (the
 * bell), the same words in pieces for a card (a Discord message)
 */
export interface NotificationDescription {
  title: string;         // What happened, in a few words
  body: string;          // Who, when and where, in one line
  detail: string | null; // A word more: the reason, the message, what to do next
  target: NotificationTarget;
  who: { name: string; teamId: string | null } | null; // Who or what it is about, when there is one: the other team, the player, the tournament; a team's id, for its logo
  when: string | null;   // The day, and the hours of the match when there is one; null when nothing is dated
  where: string | null;  // The venue, and its arena when it is named
  quote: string | null;  // The other side's own words: the other team's message, the venue's word on its competition
  action: string;        // What following the target does, for a medium that shows the link
  elsewhere: { label: string; url: string } | null; // A step to take outside the app: booking on eva.gg, registering on competitive.eva.gg
}
