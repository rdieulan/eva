// Notifications put in words. One wording for every medium: the app's bell
// shows it today, a mail or a chat message will reuse it.

import type {
  NotificationContent,
  NotificationDescription,
  ScrimDeclineReason,
  ScrimMatchFacts,
} from '@shared/types/notification.types';
import { formatShortDay } from '@shared/utils/date.utils';
import { formatVenuePlace } from '@shared/utils/venue.utils';

// Why a proposal was turned down, said to the team that sent it
const DECLINE_REASONS: Record<ScrimDeclineReason, string> = {
  byTeam: 'Leur équipe a dit non.',
  timeTaken: 'Un autre de leurs matchs a pris cette heure.',
  searchClosed: 'Leur recherche est close.',
  runTaken: 'Un des créneaux a été réservé à la salle entre-temps.',
  searchChanged: 'Leur recherche a changé et ne tient plus ce match.',
};

// The other team, the day, the hours and the place of a match
function matchLine(teamName: string, facts: ScrimMatchFacts): string {
  const place = formatVenuePlace(facts.venueName, facts.arenaNumber);
  return `${teamName} · ${formatShortDay(facts.date)} · ${facts.startTime} – ${facts.endTime} · ${place}`;
}

/**
 * Put a notification in words: what happened, who, when and where, a word
 * more when there is one, and where it leads.
 */
export function describeNotification(content: NotificationContent): NotificationDescription {
  switch (content.kind) {
    case 'SCRIM_PROPOSAL_RECEIVED': {
      const { data } = content;
      return {
        title: 'Match proposé',
        body: matchLine(data.teamName, data),
        detail: data.message ? `« ${data.message} »` : null,
        target: { page: 'calendar', date: data.date, mode: 'matchmaking', open: { kind: 'scrimSearch', id: data.searchId } },
      };
    }
    case 'SCRIM_MATCH_MADE': {
      const { data } = content;
      return {
        title: 'Match calé',
        body: matchLine(data.opponentName, data),
        detail: 'Chacun réserve sa place sur eva.gg.',
        target: { page: 'calendar', date: data.date, mode: 'team', open: { kind: 'event', id: data.eventId } },
      };
    }
    case 'SCRIM_PROPOSAL_DECLINED': {
      const { data } = content;
      return {
        title: 'Proposition refusée',
        body: matchLine(data.teamName, data),
        detail: DECLINE_REASONS[data.reason],
        target: {
          page: 'calendar', date: data.date, mode: 'matchmaking', venueId: data.venueId,
          open: { kind: 'scrimSearch', id: data.searchId },
        },
      };
    }
    case 'SCRIM_SEARCH_WITHDRAWN': {
      const { data } = content;
      return {
        title: 'Recherche retirée',
        body: matchLine(data.teamName, data),
        detail: 'Votre proposition tombe avec elle.',
        target: { page: 'calendar', date: data.date, mode: 'matchmaking', venueId: data.venueId },
      };
    }
    case 'SCRIM_MATCH_CANCELLED': {
      const { data } = content;
      const by = data.byOpponent ? 'leur équipe' : 'votre équipe';
      return {
        title: 'Match annulé',
        body: matchLine(data.opponentName, data),
        detail: `Annulé par ${by}. Les réservations faites sur eva.gg sont à annuler là-bas.`,
        target: { page: 'calendar', date: data.date, mode: 'team' },
      };
    }
    case 'SCRIM_SEARCH_EXPIRED': {
      const { data } = content;
      return {
        title: 'Recherche close sans match',
        body: `Votre recherche du ${formatShortDay(data.date)}`,
        detail: 'Ses créneaux ont été réservés à la salle : il n\'en reste plus pour un match.',
        target: { page: 'calendar', date: data.date, mode: 'matchmaking' },
      };
    }
  }
}
