// Notifications put in words and in colour. One wording for every medium: the
// app's bell shows it whole, a Discord card in pieces.

import type {
  CompetitionFacts,
  LeagueRegistrationFacts,
  NotificationContent,
  NotificationDescription,
  NotificationTarget,
  ScrimMatchFacts,
} from '@shared/types/notification.types';
import type { NotificationLook } from '@shared/types/subject.types';
import { calendarTargetPath } from '@shared/utils/calendar.utils';
import { competitiveRegistrationUrl, formatRegistrationDeadline } from '@shared/utils/competitive.utils';
import { formatShortDay } from '@shared/utils/date.utils';
import { buildEvaBookingUrl } from '@shared/utils/eva.utils';
import { describeProposalDecline, isRefusal } from '@shared/utils/scrim-proposal.utils';
import { formatVenuePlace } from '@shared/utils/venue.utils';

type Pieces = Pick<NotificationDescription, 'body' | 'who' | 'when' | 'where'>;

// A month of the league to register to: the tournament, until when, and where
function registrationPieces(facts: LeagueRegistrationFacts): Omit<NotificationDescription, 'title' | 'detail'> {
  const deadline = formatRegistrationDeadline(facts.closesAt);
  return {
    body: `${facts.tournamentName} · ${deadline}`,
    who: { name: facts.tournamentName, teamId: null },
    when: deadline.charAt(0).toUpperCase() + deadline.slice(1),
    where: null,
    quote: null,
    target: { page: 'team' },
    action: 'Voir l\'équipe',
    elsewhere: { label: 'S\'inscrire sur competitive.eva.gg', url: competitiveRegistrationUrl(facts.tournamentId) },
  };
}

// A day and its hours: "mer. 25/11 · 19:20 – 20:40"
function dayAndHours({ date, startTime, endTime }: { date: string; startTime: string; endTime: string }): string {
  return `${formatShortDay(date)} · ${startTime} – ${endTime}`;
}

// The other team, the day, the hours and the place of a match, in pieces and in one line
function matchPieces(teamName: string, teamId: string | undefined, facts: ScrimMatchFacts): Pieces {
  const when = dayAndHours(facts);
  const where = formatVenuePlace(facts.venueName, facts.arenaNumber);
  return { body: `${teamName} · ${when} · ${where}`, who: { name: teamName, teamId: teamId ?? null }, when, where };
}

// A competition of the venue: its title, its day and hours, and the venue, in
// pieces and in one line; the venue's word on it quoted
function competitionPieces(facts: CompetitionFacts): Pieces & Pick<NotificationDescription, 'quote'> {
  const when = dayAndHours(facts);
  return {
    body: `${facts.title} · ${when} · ${facts.venueName}`,
    who: { name: facts.title, teamId: null },
    when,
    where: facts.venueName,
    quote: facts.description,
  };
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
    case 'LEAGUE_REGISTRATION_OPEN':
      return {
        title: 'Inscriptions ouvertes à la ligue',
        detail: 'L\'équipe n\'y est pas encore inscrite.',
        ...registrationPieces(content.data),
      };
    case 'LEAGUE_REGISTRATION_CLOSING':
      return {
        title: 'Inscription à la ligue : dernier rappel',
        detail: 'L\'équipe n\'y est toujours pas inscrite.',
        ...registrationPieces(content.data),
      };
    case 'COMPETITION_OFFERED': {
      const { data } = content;
      return {
        title: 'Compétition proposée par la salle',
        ...competitionPieces(data),
        detail: data.description ? `« ${data.description} »` : 'À ajouter au calendrier de l\'équipe, ou à refuser.',
        target: { page: 'home' },
        action: 'Répondre',
        elsewhere: null,
      };
    }
    case 'COMPETITION_ADDED': {
      const { data } = content;
      return {
        title: 'Compétition ajoutée au calendrier',
        ...competitionPieces(data),
        detail: data.description ? `« ${data.description} »` : null,
        target: { page: 'calendar', date: data.date, mode: 'team', open: { kind: 'event', id: data.eventId } },
        action: 'Voir la compétition',
        elsewhere: null,
      };
    }
    case 'COMPETITION_WITHDRAWN': {
      const { data } = content;
      return {
        title: 'Compétition retirée par la salle',
        ...competitionPieces(data),
        detail: data.accepted ? 'Elle quitte le calendrier de l\'équipe.' : 'Elle n\'attend plus votre réponse.',
        quote: null,
        target: { page: 'calendar', date: data.date, mode: 'team' },
        action: 'Ouvrir le calendrier',
        elsewhere: null,
      };
    }
  }
}

/**
 * How a notification shows, the same in the bell and on Discord: the symbol
 * of its subject, in the subject's colour; gone wrong, in the colour of what
 * it came to, red refused or called off, grey come to nothing.
 */
export function notificationLook(content: NotificationContent): NotificationLook {
  switch (content.kind) {
    case 'SCRIM_PROPOSAL_RECEIVED':
      return { subject: 'matchmaking', tone: 'subject' };
    case 'SCRIM_MATCH_MADE':
      return { subject: 'match', tone: 'subject' };
    case 'SCRIM_MATCH_CANCELLED':
      return { subject: 'match', tone: 'refused' };
    case 'SCRIM_PROPOSAL_DECLINED':
      return { subject: 'matchmaking', tone: isRefusal(content.data.reason) ? 'refused' : 'fell-through' };
    case 'SCRIM_SEARCH_WITHDRAWN':
    case 'SCRIM_SEARCH_EXPIRED':
      return { subject: 'matchmaking', tone: 'fell-through' };
    case 'TEAM_JOIN_REQUESTED':
      return { subject: 'team', tone: 'subject' };
    case 'LEAGUE_REGISTRATION_OPEN':
    case 'LEAGUE_REGISTRATION_CLOSING':
    case 'COMPETITION_OFFERED':
    case 'COMPETITION_ADDED':
      return { subject: 'competition', tone: 'subject' };
    case 'COMPETITION_WITHDRAWN':
      return { subject: 'competition', tone: content.data.accepted ? 'refused' : 'fell-through' };
  }
}

/** Where a notification leads, as a path of the app, for a link from outside it */
export function notificationTargetPath(target: NotificationTarget): string {
  switch (target.page) {
    case 'home': return '/';
    case 'team': return '/team';
    case 'calendar': return calendarTargetPath(target);
  }
}
