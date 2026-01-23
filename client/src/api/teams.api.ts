// Teams API client

import type { UserPermissions, Team } from '@shared/types';

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
export async function fetchCurrentTeam(token: string): Promise<TeamWithMembers | null> {
  const response = await fetch(`${API_BASE}/current`, {
    headers: { Authorization: `Bearer ${token}` },
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
  token: string,
  data: { name?: string; logo?: string | null; location?: string | null }
): Promise<Team> {
  const response = await fetch(`${API_BASE}/current`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
export async function fetchTeamMembers(token: string): Promise<TeamMember[]> {
  const response = await fetch(`${API_BASE}/current/members`, {
    headers: { Authorization: `Bearer ${token}` },
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
  token: string,
  memberId: string,
  permissions: UserPermissions
): Promise<void> {
  const response = await fetch(`${API_BASE}/current/members/${memberId}/permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
export async function removeMember(token: string, memberId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/current/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du retrait du membre');
  }
}
