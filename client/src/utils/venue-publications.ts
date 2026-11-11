// What came of a venue's publications among the teams, in words: the
// competitions it offers, and the events open to all the teams add to their
// calendar. The manager reads them in the lists of their tabs and in the
// venue's calendar.

import type { VenueCompetitionView } from '@shared/types';

/** What the teams a competition went to said of it */
export function describeCompetitionAnswers({ pending, accepted, refused }: VenueCompetitionView['answers']): string {
  const sent = pending + accepted + refused;
  if (!sent) return 'Aucune équipe de l\'app n\'est concernée pour l\'instant.';
  const parts = [`Proposée à ${sent} équipe${sent > 1 ? 's' : ''}`];
  if (accepted) parts.push(`${accepted} l'${accepted > 1 ? 'ont' : 'a'} ajoutée`);
  if (refused) parts.push(`${refused} refus`);
  if (pending) parts.push(`${pending} sans réponse`);
  return `${parts.join(' · ')}.`;
}

/** How many teams put an event of the venue in their calendar */
export function describeTeamsAdding(teamsAdding: number): string {
  if (!teamsAdding) return 'Aucune équipe ne l\'a ajouté à son calendrier pour l\'instant.';
  return `Ajouté au calendrier de ${teamsAdding} équipe${teamsAdding > 1 ? 's' : ''}.`;
}

/** What a competition is, beside its title: a division's day, or a tournament of the venue */
export function competitionKind({ division }: Pick<VenueCompetitionView, 'division'>): string {
  return division ? `Division ${division}` : 'Tournoi';
}
