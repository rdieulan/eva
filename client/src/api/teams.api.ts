// Teams API client

import type { UserPermissions, Team } from '@shared/types';
import { ERROR_MESSAGES } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

const API_BASE = '/api/teams';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  permissions: UserPermissions | null;
  isLeader: boolean;
}

export interface TeamWithMembers extends Team {
  leader: { id: string; name: string; email: string };
  members: TeamMember[];
  isLeader: boolean;
}

/**
 * Get current user's team
 */
export async function fetchCurrentTeam(): Promise<TeamWithMembers | null> {
  const response = await authFetch(`${API_BASE}/current`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError([], ERROR_MESSAGES.teamFetchFailed);
  }

  return response.json();
}

/**
 * Create a new team (current user becomes leader)
 */
export async function createTeam(
  data: { name: string; logo?: string | null; location?: string | null }
): Promise<TeamWithMembers> {
  const response = await authFetch(API_BASE, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.teamCreationFailed);
  }

  return response.json();
}

/**
 * Get available team locations
 */
export async function fetchTeamLocations(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/locations`);

  if (!response.ok) {
    throw new ApiError([], ERROR_MESSAGES.teamLocationsFetchFailed);
  }

  return response.json();
}

/**
 * Update team info
 */
export async function updateTeam(
  data: { name?: string; logo?: string | null; location?: string | null }
): Promise<Team> {
  const response = await authFetch(`${API_BASE}/current`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.teamUpdateFailed);
  }

  return response.json();
}

/**
 * Get team members
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const response = await authFetch(`${API_BASE}/current/members`);

  if (!response.ok) {
    throw new ApiError([], ERROR_MESSAGES.teamMembersFetchFailed);
  }

  return response.json();
}

/**
 * Update member permissions
 */
export async function updateMemberPermissions(
  memberId: string,
  permissions: UserPermissions
): Promise<void> {
  const response = await authFetch(`${API_BASE}/current/members/${memberId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.teamPermissionsUpdateFailed);
  }
}

/**
 * Remove member from team
 */
export async function removeMember(memberId: string): Promise<void> {
  const response = await authFetch(`${API_BASE}/current/members/${memberId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.teamMemberRemoveFailed);
  }
}

/**
 * Delete the team (leader only)
 */
export async function deleteTeam(): Promise<void> {
  const response = await authFetch(`${API_BASE}/current`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.teamDeleteFailed);
  }
}

/**
 * Leave the team (for non-leader members)
 */
export async function leaveTeam(): Promise<void> {
  const response = await authFetch(`${API_BASE}/current/leave`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.teamLeaveFailed);
  }
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
  const response = await authFetch(`${API_BASE}/${teamId}/invites`, {
    method: 'POST',
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.inviteCreationFailed);
  }

  return response.json();
}

/**
 * List active invitations for the team
 */
export async function fetchInvites(teamId: string): Promise<TeamInvite[]> {
  const response = await authFetch(`${API_BASE}/${teamId}/invites`);

  if (!response.ok) {
    throw new ApiError([], ERROR_MESSAGES.inviteFetchFailed);
  }

  return response.json();
}

/**
 * Revoke an invitation
 */
export async function revokeInvite(teamId: string, inviteId: string): Promise<void> {
  const response = await authFetch(`${API_BASE}/${teamId}/invites/${inviteId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.inviteRevokeFailed);
  }
}

/**
 * Verify an invite code validity (public, no auth required for basic check)
 */
export async function verifyInviteCode(code: string): Promise<InviteValidation> {
  const response = await fetch(`/api/invites/${code}`);

  if (!response.ok) {
    throw new ApiError([], ERROR_MESSAGES.inviteValidationFailed);
  }

  return response.json();
}

/**
 * Join a team using an invite code
 */
export async function joinTeamWithCode(code: string): Promise<JoinResult> {
  const response = await authFetch(`/api/invites/${code}/join`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.joinTeamFailed);
  }

  return response.json();
}

