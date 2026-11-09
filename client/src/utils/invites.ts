// Team invitations, as a player pastes them: the whole link or its code alone

/** The code of a team invitation, from its link (…/join/CODE) or the code itself; '' when there is none */
export function inviteCodeOf(input: string): string {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/join\/([a-zA-Z0-9]+)/);
  return fromLink?.[1] ?? trimmed;
}
