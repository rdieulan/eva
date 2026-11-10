// Tests for a declined proposal put in words and in colour, for the team that sent it
import { describe, it, expect } from 'vitest';
import { describeProposalDecline, isRefusal, proposalState } from '@shared/utils';
import { SCRIM_DECLINE_REASONS, type ScrimDeclineReason } from '@shared/types';

describe('describeProposalDecline', () => {
  it('says refused only when their team said no', () => {
    expect(describeProposalDecline('BY_TEAM')).toEqual({ title: 'Proposition refusée', detail: 'Leur équipe a dit non.' });
    const refused = SCRIM_DECLINE_REASONS.filter(reason => describeProposalDecline(reason).title.includes('refusée'));
    expect(refused).toEqual(['BY_TEAM']);
  });

  it('says not retained when their team took another match, cancelled once the proposal no longer held', () => {
    const titles = Object.fromEntries(SCRIM_DECLINE_REASONS.map(reason => [reason, describeProposalDecline(reason).title]));
    expect(titles).toEqual<Record<ScrimDeclineReason, string>>({
      BY_TEAM: 'Proposition refusée',
      TIME_TAKEN: 'Proposition non retenue',
      SEARCH_FILLED: 'Proposition non retenue',
      SEARCH_CLOSED: 'Proposition annulée',
      RUN_TAKEN: 'Proposition annulée',
      SEARCH_CHANGED: 'Proposition annulée',
      SEARCH_WITHDRAWN: 'Proposition annulée',
      DAY_PASSED: 'Proposition sans réponse',
    });
  });

  it('gives each reason its own why', () => {
    expect(describeProposalDecline('RUN_TAKEN').detail).toBe('Un des créneaux a été réservé à la salle entre-temps.');
    expect(describeProposalDecline('TIME_TAKEN').detail).toBe('Leur équipe a accepté un autre match à cette heure.');
    const details = SCRIM_DECLINE_REASONS.map(reason => describeProposalDecline(reason).detail);
    expect(new Set(details).size).toBe(SCRIM_DECLINE_REASONS.length);
  });
});

describe('proposalState', () => {
  it('reads a proposal as the colour code does: awaited, accepted, refused or called off, come to nothing', () => {
    expect(proposalState({ status: 'PENDING', declineReason: null })).toBe('pending');
    expect(proposalState({ status: 'ACCEPTED', declineReason: null })).toBe('accepted');
    expect(proposalState({ status: 'CANCELLED', declineReason: null })).toBe('refused');
    expect(proposalState({ status: 'WITHDRAWN', declineReason: null })).toBe('fell-through');
  });

  it('calls refused only what their team said no to; what the app declined came to nothing', () => {
    const refused = SCRIM_DECLINE_REASONS.filter(reason => proposalState({ status: 'DECLINED', declineReason: reason }) === 'refused');

    expect(refused).toEqual(['BY_TEAM']);
    expect(SCRIM_DECLINE_REASONS.filter(isRefusal)).toEqual(refused);
  });
});
