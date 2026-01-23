// Teams API client

import type { UserPermissions, Team } from '@shared/types';
import { getAuthHeaders } from '@/api/utils';

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
  const response = await fetch(`${API_BASE}/current`, {
    headers: getAuthHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération de l\'équipe');
  }

  return response.json();
}

/**
 * Get available team locations
 */
export async function fetchTeamLocations(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/locations`);

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des localisations');
  }

  return response.json();
}

/**
 * Update team info
 */
export async function updateTeam(
  data: { name?: string; logo?: string | null; location?: string | null }
): Promise<Team> {
  const response = await fetch(`${API_BASE}/current`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la mise à jour de l\'équipe');
  }

  return response.json();
}

/**
 * Get team members
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const response = await fetch(`${API_BASE}/current/members`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des membres');
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
  const response = await fetch(`${API_BASE}/current/members/${memberId}/permissions`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ permissions }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de la mise à jour des permissions');
  }
}

/**
 * Remove member from team
 */
export async function removeMember(memberId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/current/members/${memberId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du retrait du membre');
  }
}
