// Teams API client

import type { AccountPermissions, Team } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

const API_BASE = '/api/teams';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  permissions: AccountPermissions | null;
  isLeader: boolean;
}

export interface TeamWithMembers extends Team {
  leader: { id: string; name: string; email: string };
  members: TeamMember[];
  isLeader: boolean;
}

/**
 * Get current user's team
 * Note: Uses raw authFetch due to special 404 handling
 */
export async function fetchCurrentTeam(): Promise<TeamWithMembers | null> {
  const response = await authFetch(`${API_BASE}/current`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw ApiError.fromResponse(errorData, ERROR.teamFetchFailed);
  }

  return response.json();
}

/**
 * Create a new team (current user becomes leader)
 */
export async function createTeam(
  teamData: { name: string; logo?: string | null; location?: string | null }
): Promise<TeamWithMembers> {
  return authFetch<TeamWithMembers>(
    API_BASE,
    { method: 'POST', body: JSON.stringify(teamData) },
    ERROR.teamCreationFailed
  );
}

/**
 * Get available team locations
 */
export async function fetchTeamLocations(): Promise<string[]> {
  return authFetch<string[]>(
    `${API_BASE}/locations`,
    undefined,
    ERROR.teamLocationsFetchFailed
  );
}

/**
 * Update team info
 */
export async function updateTeam(
  teamData: { name?: string; logo?: string | null; location?: string | null }
): Promise<Team> {
  return authFetch<Team>(
    `${API_BASE}/current`,
    { method: 'PUT', body: JSON.stringify(teamData) },
    ERROR.teamUpdateFailed
  );
}

/**
 * Get team members
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  return authFetch<TeamMember[]>(
    `${API_BASE}/current/members`,
    undefined,
    ERROR.teamMembersFetchFailed
  );
}

/**
 * Update member permissions
 */
export async function updateMemberPermissions(
  memberId: string,
  permissions: AccountPermissions
): Promise<void> {
  return authFetch<void>(
    `${API_BASE}/current/members/${memberId}/permissions`,
    { method: 'PUT', body: JSON.stringify({ permissions }) },
    ERROR.teamPermissionsUpdateFailed
  );
}

/**
 * Remove member from team
 */
export async function removeMember(memberId: string): Promise<void> {
  return authFetch<void>(
    `${API_BASE}/current/members/${memberId}`,
    { method: 'DELETE' },
    ERROR.teamMemberRemoveFailed
  );
}

/**
 * Delete the team (leader only)
 */
export async function deleteTeam(): Promise<void> {
  return authFetch<void>(
    `${API_BASE}/current`,
    { method: 'DELETE' },
    ERROR.teamDeleteFailed
  );
}

/**
 * Leave the team (for non-leader members)
 */
export async function leaveTeam(): Promise<void> {
  return authFetch<void>(
    `${API_BASE}/current/leave`,
    { method: 'POST' },
    ERROR.teamLeaveFailed
  );
}

// ========== Team Invitations ==========

export interface TeamInvite {
  id: string;
  code: string;
  url: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  createdBy?: string;
  createdAt?: string;
}

export interface InviteValidation {
  valid: boolean;
  reason?: string;
  teamName?: string;
  teamLogo?: string | null;
  expiresAt?: string;
}

export interface JoinResult {
  message: string;
  teamId: string;
  teamName: string;
}

/**
 * Create an invitation link for the team
 */
export async function createInvite(
  teamId: string,
  options: { expiresInHours?: number; maxUses?: number } = {}
): Promise<TeamInvite> {
  return authFetch<TeamInvite>(
    `${API_BASE}/${teamId}/invites`,
    { method: 'POST', body: JSON.stringify(options) },
    ERROR.inviteCreationFailed
  );
}

/**
 * List active invitations for the team
 */
export async function fetchInvites(teamId: string): Promise<TeamInvite[]> {
  return authFetch<TeamInvite[]>(
    `${API_BASE}/${teamId}/invites`,
    undefined,
    ERROR.inviteFetchFailed
  );
}

/**
 * Revoke an invitation
 */
export async function revokeInvite(teamId: string, inviteId: string): Promise<void> {
  return authFetch<void>(
    `${API_BASE}/${teamId}/invites/${inviteId}`,
    { method: 'DELETE' },
    ERROR.inviteRevokeFailed
  );
}

/**
 * Verify an invite code validity
 */
export async function verifyInviteCode(code: string): Promise<InviteValidation> {
  return authFetch<InviteValidation>(
    `/api/invites/${code}`,
    undefined,
    ERROR.inviteValidationFailed
  );
}

/**
 * Join a team using an invite code
 */
export async function joinTeamWithCode(code: string): Promise<JoinResult> {
  return authFetch<JoinResult>(
    `/api/invites/${code}/join`,
    { method: 'POST' },
    ERROR.joinTeamFailed
  );
}
