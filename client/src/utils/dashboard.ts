// The home dashboard put in words: each item what it is about, its subject in
// the colour code (docs/PRODUIT.md, *Code couleur*), when it stops being of
// use, and what to do about it, inside the app or on another site

import type { RouteLocationRaw } from 'vue-router';
import type { DashboardItem, DashboardNextMatch, Subject } from '@shared/types';
import {
  assessSlotHeadcount,
  buildEvaBookingUrl,
  competitiveRegistrationUrl,
  formatRegistrationDeadline,
  formatShortDay,
  formatVenuePlace,
  shiftDay,
  toParisTime,
  type SlotHeadcountStatus,
} from '@shared/utils';
import { calendarRoute } from '@/utils/calendar';

/** Something to do about an item: go to a page of the app, open another site, read the league again, or answer a competition */
export type DashboardAction =
  | { kind: 'route'; label: string; to: RouteLocationRaw }
  | { kind: 'link'; label: string; url: string }
  | { kind: 'checkLeague'; label: string }
  | { kind: 'answerCompetition'; label: string; answer: 'accept' | 'refuse' };

/** An item of the dashboard as a card shows it */
export interface DashboardCardView {
  subject: Subject; // Its colour and its symbol
  title: string;
  body: string;
  detail: string | null;
  // The players eva.gg counts on a match, in the colour of the state they say:
  // a full lineup, players missing, one too many. Null for any other detail.
  headcountStatus: SlotHeadcountStatus | null;
  when: string | null;  // "Aujourd'hui à 20:00", "Demain", "Dans 3 jours"
  isUrgent: boolean;    // Due before the end of tomorrow
  actions: DashboardAction[]; // The first is the main one, in the colour of the subject
}

// "1 joueur", "3 joueurs"
function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}

// The day, the hours and the place of a match, each kept on one line: on a
// narrow card the line breaks between them, never inside one
function dayHoursPlace(date: string, startTime: string, endTime: string, place: string | null): string {
  return [formatShortDay(date), `${startTime} – ${endTime}`, ...(place ? [place] : [])]
    .map(part => part.replace(/ /g, '\u00a0'))
    .join(' · ');
}

// Whole days from one day to another, both YYYY-MM-DD
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// When an item is due, from where the reader stands in Paris: today and
// tomorrow with their hour, in so many days after that
function dueIn(due: string, today: string): { when: string; isUrgent: boolean } {
  const [day, time] = due.split('T') as [string, string];
  const at = time === '00:00' ? '' : ` à ${time}`;
  if (day <= today) return { when: `Aujourd'hui${at}`, isUrgent: true };
  if (day === shiftDay(today, 1)) return { when: `Demain${at}`, isUrgent: true };
  return { when: `Dans ${daysBetween(today, day)} jours`, isUrgent: false };
}

/** What tells an item from the others of the dashboard, whatever their words */
export function dashboardItemKey(item: DashboardItem): string {
  switch (item.kind) {
    case 'MATCH': return `match-${item.data.eventId}`;
    case 'AVAILABILITY': return 'availability';
    case 'LEAGUE_REGISTRATION': return `league-${item.data.tournamentId}`;
    case 'SCRIM_PROPOSAL': return `proposal-${item.data.proposalId}`;
    case 'COMPETITION_OFFER': return `competition-${item.data.competitionId}`;
    case 'JOIN_REQUESTS': return 'join-requests';
  }
}

/** An item of the dashboard in words, as seen at `now` */
export function describeDashboardItem(item: DashboardItem, now: Date = new Date()): DashboardCardView {
  const today = toParisTime(now).day;
  const due = item.due ? dueIn(item.due, today) : { when: null, isUrgent: false };

  switch (item.kind) {
    case 'MATCH': {
      const { data } = item;
      const headcount = data.headcount && assessSlotHeadcount(data.headcount.takenSeats);
      const booking = data.isUnavailable ? null : buildEvaBookingUrl(data.evaLocationId, data.date);
      return {
        subject: 'match',
        title: data.title,
        body: dayHoursPlace(data.date, data.startTime, data.endTime, data.venueName && formatVenuePlace(data.venueName, data.arenaNumber)),
        detail: data.isUnavailable
          ? 'Tu t\'es dit indispo ce jour-là.'
          : headcount
            ? `${headcount.label} inscrits sur eva.gg${headcount.note ? `, ${headcount.note}` : ''}${data.headcount!.varies ? ' sur un des créneaux' : ''}`
            : null,
        headcountStatus: !data.isUnavailable && headcount ? headcount.status : null,
        ...due,
        actions: [
          ...(booking ? [{ kind: 'link' as const, label: 'Réserver ma place sur eva.gg', url: booking }] : []),
          {
            kind: 'route',
            label: 'Voir le match',
            to: calendarRoute({ page: 'calendar', date: data.date, mode: 'team', open: { kind: 'event', id: data.eventId } }),
          },
        ],
      };
    }
    case 'AVAILABILITY': {
      const { data } = item;
      return {
        subject: 'dispos',
        title: 'Tes dispos',
        body: `Tu n'as pas donné tes dispos pour ${data.missingDays} des ${data.horizonDays} prochains jours.`,
        detail: `À commencer par ${formatShortDay(data.firstMissingDate)}.`,
        headcountStatus: null,
        ...due,
        actions: [{
          kind: 'route',
          label: 'Donner mes dispos',
          to: calendarRoute({ page: 'calendar', date: data.firstMissingDate, mode: 'team', dispos: true }),
        }],
      };
    }
    case 'LEAGUE_REGISTRATION': {
      const { data } = item;
      return {
        subject: 'competition',
        title: 'Inscription à la ligue',
        body: `Inscris ${data.leagueTeamName} à ${data.tournamentName}, ${formatRegistrationDeadline(data.closesAt)}.`,
        detail: 'L\'inscription se fait sur competitive.eva.gg.',
        headcountStatus: null,
        ...due,
        actions: [
          { kind: 'link', label: 'S\'inscrire sur competitive.eva.gg', url: competitiveRegistrationUrl(data.tournamentId) },
          { kind: 'checkLeague', label: 'C\'est fait, vérifier' },
        ],
      };
    }
    case 'SCRIM_PROPOSAL': {
      const { data } = item;
      return {
        subject: 'matchmaking',
        title: `${data.teamName} propose un match`,
        body: dayHoursPlace(data.date, data.startTime, data.endTime, formatVenuePlace(data.venueName, data.arenaNumber)),
        detail: null,
        headcountStatus: null,
        ...due,
        actions: [{
          kind: 'route',
          label: 'Répondre',
          to: calendarRoute({
            page: 'calendar', date: data.date, mode: 'matchmaking', venueId: data.venueId,
            open: { kind: 'scrimSearch', id: data.searchId },
          }),
        }],
      };
    }
    case 'COMPETITION_OFFER': {
      const { data } = item;
      return {
        subject: 'competition',
        title: data.title,
        body: dayHoursPlace(data.date, data.startTime, data.endTime, data.venueName),
        detail: data.description ?? (data.division
          ? `La salle publie la journée de ta division, la Division ${data.division}.`
          : 'Un événement publié par la salle.'),
        headcountStatus: null,
        ...due,
        actions: [
          { kind: 'answerCompetition', label: 'Ajouter au calendrier', answer: 'accept' },
          { kind: 'answerCompetition', label: 'Refuser', answer: 'refuse' },
        ],
      };
    }
    case 'JOIN_REQUESTS': {
      const { count } = item.data;
      return {
        subject: 'team',
        title: 'Demandes pour rejoindre',
        body: `${plural(count, 'joueur')} ${count > 1 ? 'attendent' : 'attend'} une réponse pour rejoindre l'équipe.`,
        detail: null,
        headcountStatus: null,
        ...due,
        actions: [{ kind: 'route', label: 'Voir les demandes', to: { path: '/team' } }],
      };
    }
  }
}

/** The team's next match, for a dashboard with nothing to do: how far it is, what and when, and where to see it */
export function describeNextMatch(next: DashboardNextMatch, now: Date = new Date()): { lead: string; label: string; to: RouteLocationRaw } {
  const days = daysBetween(toParisTime(now).day, next.date);
  return {
    lead: `Prochain match dans ${plural(days, 'jour')} :`,
    label: `${next.title}, ${formatShortDay(next.date)} à ${next.startTime}`,
    to: calendarRoute({ page: 'calendar', date: next.date, mode: 'team', open: { kind: 'event', id: next.eventId } }),
  };
}
