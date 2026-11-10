// What a venue's competitions tell the teams: offered to them, added to a
// team's calendar, withdrawn. Each function is handed the facts of what just
// happened, once it is done, and gives them to notify(): who is told is
// decided here, how they are told is not.

import type { CompetitionFacts } from '@shared/types';
import { notify, type PermissionRef } from '@services/notification.service';

// Those who answer a venue's competition for their team: those who create its events
const CAN_ANSWER: PermissionRef = { category: 'calendar', name: 'canCreateEvents' };

/** A competition published for teams: those who answer for each of them hear of it */
export async function notifyCompetitionOffered(facts: CompetitionFacts, teamIds: string[]): Promise<void> {
  for (const teamId of teamIds) {
    await notify({ kind: 'COMPETITION_OFFERED', data: facts }, { teamId, permission: CAN_ANSWER });
  }
}

/** A competition accepted into a team's calendar: the rest of the team hears of it */
export async function notifyCompetitionAdded(
  facts: CompetitionFacts,
  added: { teamId: string; eventId: string; acceptedBy: string },
): Promise<void> {
  await notify(
    { kind: 'COMPETITION_ADDED', data: { ...facts, eventId: added.eventId } },
    { teamId: added.teamId, exceptPlayerId: added.acceptedBy },
  );
}

/**
 * A competition withdrawn by its venue: a team that accepted it hears of it
 * whole, the competition gone from its calendar; one that had not answered
 * yet, those who answer for it. A team that refused it is told nothing.
 */
export async function notifyCompetitionWithdrawn(
  facts: CompetitionFacts,
  offers: { teamId: string; status: 'PENDING' | 'ACCEPTED' | 'REFUSED' }[],
): Promise<void> {
  for (const { teamId, status } of offers) {
    if (status === 'REFUSED') continue;
    const accepted = status === 'ACCEPTED';
    await notify(
      { kind: 'COMPETITION_WITHDRAWN', data: { ...facts, accepted } },
      accepted ? { teamId } : { teamId, permission: CAN_ANSWER },
    );
  }
}
