// What became of a proposal, in words, for the team that sent it: the same on
// the sheet of the search it answered and in every medium that tells it

import type { ScrimDeclineReason } from '@shared/types/scrim.types';

/** A declined proposal in words */
export interface ProposalDeclineDescription {
  title: string;  // What became of it, in a few words
  detail: string; // Why
}

const DECLINES: Record<ScrimDeclineReason, ProposalDeclineDescription> = {
  BY_TEAM: { title: 'Proposition refusée', detail: 'Leur équipe a dit non.' },
  TIME_TAKEN: { title: 'Proposition non retenue', detail: 'Leur équipe a accepté un autre match à cette heure.' },
  SEARCH_FILLED: { title: 'Proposition non retenue', detail: 'Leur recherche a trouvé tous ses matchs.' },
  SEARCH_CLOSED: { title: 'Proposition annulée', detail: 'Leur recherche est close faute de créneaux.' },
  RUN_TAKEN: { title: 'Proposition annulée', detail: 'Un des créneaux a été réservé à la salle entre-temps.' },
  SEARCH_CHANGED: { title: 'Proposition annulée', detail: 'Leur recherche a changé : ce match n\'y a plus sa place.' },
  SEARCH_WITHDRAWN: { title: 'Proposition annulée', detail: 'Leur recherche a été retirée.' },
  DAY_PASSED: { title: 'Proposition sans réponse', detail: 'Le jour est passé sans réponse de leur équipe.' },
};

/**
 * Put a declined proposal in words. Refused only when their team said no;
 * declined by the app, it is not retained when their team took another match,
 * cancelled once it no longer held, unanswered when its day passed.
 */
export function describeProposalDecline(reason: ScrimDeclineReason): ProposalDeclineDescription {
  return DECLINES[reason];
}
