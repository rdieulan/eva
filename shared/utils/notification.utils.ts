// Notifications put in words. One wording for every medium: the app's bell
// shows it whole, a Discord card in pieces.

import type {
  NotificationContent,
  NotificationDescription,
  NotificationTarget,
  ScrimMatchFacts,
} from '@shared/types/notification.types';
import { calendarTargetPath } from '@shared/utils/calendar.utils';
import { formatShortDay } from '@shared/utils/date.utils';
import { buildEvaBookingUrl } from '@shared/utils/eva.utils';
import { describeProposalDecline } from '@shared/utils/scrim-proposal.utils';
import { formatVenuePlace } from '@shared/utils/venue.utils';

type Pieces = Pick<NotificationDescription, 'body' | 'who' | 'when' | 'where'>;

// The other team, the day, the hours and the place of a match, in pieces and in one line
function matchPieces(teamName: string, teamId: string | undefined, facts: ScrimMatchFacts): Pieces {
  const when = `${formatShortDay(facts.date)} · ${facts.startTime} – ${facts.endTime}`;
  const where = formatVenuePlace(facts.venueName, facts.arenaNumber);
  return { body: `${teamName} · ${when} · ${where}`, who: { name: teamName, teamId: teamId ?? null }, when, where };
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
        ...matchPieces(data.teamName, data.teamId, data),
        detail: data.message ? `« ${data.message} »` : null,
        quote: data.message,
        target: { page: 'calendar', date: data.date, mode: 'matchmaking', open: { kind: 'scrimSearch', id: data.searchId } },
        action: 'Répondre',
        elsewhere: null,
      };
    }
    case 'SCRIM_MATCH_MADE': {
      const { data } = content;
      const booking = buildEvaBookingUrl(data.evaLocationId ?? null, data.date);
      return {
        title: 'Match calé',
        ...matchPieces(data.opponentName, data.opponentId, data),
        detail: 'Chacun réserve sa place sur eva.gg.',
        quote: null,
        target: { page: 'calendar', date: data.date, mode: 'team', open: { kind: 'event', id: data.eventId } },
        action: 'Voir le match',
        elsewhere: booking ? { label: 'Réserver ma place sur eva.gg', url: booking } : null,
      };
    }
    case 'SCRIM_PROPOSAL_DECLINED': {
      const { data } = content;
      const { title, detail } = describeProposalDecline(data.reason);
      return {
        title,
        ...matchPieces(data.teamName, data.teamId, data),
        detail,
        quote: null,
        target: {
          page: 'calendar', date: data.date, mode: 'matchmaking', venueId: data.venueId,
          open: { kind: 'scrimSearch', id: data.searchId },
        },
        action: 'Voir leur recherche',
        elsewhere: null,
      };
    }
    case 'SCRIM_SEARCH_WITHDRAWN': {
      const { data } = content;
      return {
        title: 'Recherche retirée',
        ...matchPieces(data.teamName, data.teamId, data),
        detail: 'Votre proposition tombe avec elle.',
        quote: null,
        target: { page: 'calendar', date: data.date, mode: 'matchmaking', venueId: data.venueId },
        action: 'Voir les autres recherches',
        elsewhere: null,
      };
    }
    case 'SCRIM_MATCH_CANCELLED': {
      const { data } = content;
      const by = data.byOpponent ? 'leur équipe' : 'votre équipe';
      return {
        title: 'Match annulé',
        ...matchPieces(data.opponentName, data.opponentId, data),
        detail: `Annulé par ${by}. Les réservations faites sur eva.gg sont à annuler là-bas.`,
        quote: null,
        target: { page: 'calendar', date: data.date, mode: 'team' },
        action: 'Ouvrir le calendrier',
        elsewhere: null,
      };
    }
    case 'SCRIM_SEARCH_EXPIRED': {
      const { data } = content;
      return {
        title: 'Recherche close sans match',
        body: `Votre recherche du ${formatShortDay(data.date)}`,
        who: null,
        when: formatShortDay(data.date),
        where: null,
        detail: 'Ses créneaux ont été réservés à la salle : il n\'en reste plus pour un match.',
        quote: null,
        target: { page: 'calendar', date: data.date, mode: 'matchmaking' },
        action: 'Ouvrir le calendrier',
        elsewhere: null,
      };
    }
    case 'TEAM_JOIN_REQUESTED': {
      const { data } = content;
      return {
        title: 'Demande pour rejoindre l\'équipe',
        body: data.playerName,
        who: { name: data.playerName, teamId: null },
        when: null,
        where: null,
        detail: data.evaUsername ? `Compte eva.gg : ${data.evaUsername}` : 'Pas de compte eva.gg relié',
        quote: null,
        target: { page: 'team' },
        action: 'Répondre',
        elsewhere: null,
      };
    }
  }
}

/** Where a notification leads, as a path of the app, for a link from outside it */
export function notificationTargetPath(target: NotificationTarget): string {
  return target.page === 'team' ? '/team' : calendarTargetPath(target);
}
