// Admin API client - venue / manager / admin / player / team management

import type { AccountType, AdminPermissions, Venue, VenueLinks } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

const VENUES_BASE = '/api/admin/venues';
const MANAGERS_BASE = '/api/admin/managers';
const ADMINS_BASE = '/api/admin/admins';
const PLAYERS_BASE = '/api/admin/players';
const TEAMS_BASE = '/api/admin/teams';

export interface VenueInput extends Partial<VenueLinks> {
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  arenaCount: number;
}

// A manager, or an invitation to manage not yet accepted: no account yet, the
// name the admin gave it, and its link
export interface ManagerSummary {
  id: string;
  userId: string | null;
  name: string;
  activationPending: boolean;
  activationToken: string | null;
  activationTokenExpiresAt: string | null;
  venues: { id: string; name: string; city: string }[];
}

export interface CreatedManager {
  manager: ManagerSummary;
  activationToken: string;
}

// ============================================
// Venues
// ============================================

export function fetchAdminVenues(): Promise<Venue[]> {
  return authFetch<Venue[]>(VENUES_BASE, undefined, ERROR.venuesFetchFailed);
}

export function createVenue(input: VenueInput): Promise<Venue> {
  return authFetch<Venue>(
    VENUES_BASE,
    { method: 'POST', body: JSON.stringify(input) },
    ERROR.venueCreationFailed,
  );
}

export function updateVenue(id: string, input: Partial<VenueInput>): Promise<Venue> {
  return authFetch<Venue>(
    `${VENUES_BASE}/${id}`,
    { method: 'PUT', body: JSON.stringify(input) },
    ERROR.venueUpdateFailed,
  );
}

export function deleteVenue(id: string): Promise<void> {
  return authFetch<void>(
    `${VENUES_BASE}/${id}`,
    { method: 'DELETE' },
    ERROR.venueDeleteFailed,
  );
}

// ============================================
// Managers
// ============================================

export function fetchAdminManagers(): Promise<ManagerSummary[]> {
  return authFetch<ManagerSummary[]>(MANAGERS_BASE, undefined, ERROR.managersFetchFailed);
}

export function createManager(input: { name: string; venueIds: string[] }): Promise<CreatedManager> {
  return authFetch<CreatedManager>(
    MANAGERS_BASE,
    { method: 'POST', body: JSON.stringify(input) },
    ERROR.managerCreationFailed,
  );
}

export function updateManagerVenues(id: string, venueIds: string[]): Promise<ManagerSummary> {
  return authFetch<ManagerSummary>(
    `${MANAGERS_BASE}/${id}`,
    { method: 'PUT', body: JSON.stringify({ venueIds }) },
    ERROR.managerUpdateFailed,
  );
}

export function deleteManager(id: string): Promise<void> {
  return authFetch<void>(
    `${MANAGERS_BASE}/${id}`,
    { method: 'DELETE' },
    ERROR.managerDeleteFailed,
  );
}

/**
 * The link of an invitation to a role, for the person invited to open and
 * accept by signing in with Discord
 */
export function buildActivationUrl(activationToken: string): string {
  return `${window.location.origin}/activate/${activationToken}`;
}

// ============================================
// Admins
// ============================================

// An admin, or an invitation to administer not yet accepted, as for managers
export interface AdminSummary {
  id: string;
  userId: string | null;
  name: string;
  permissions: AdminPermissions;
  isSuperAdmin: boolean;
  activationPending: boolean;
  activationToken: string | null;
  activationTokenExpiresAt: string | null;
  createdAt: string;
}

export interface CreatedAdmin {
  admin: AdminSummary;
  activationToken: string;
}

export function fetchAdminAdmins(): Promise<AdminSummary[]> {
  return authFetch<AdminSummary[]>(ADMINS_BASE, undefined, ERROR.adminsFetchFailed);
}

export function createAdmin(input: {
  name: string;
  permissions: AdminPermissions;
}): Promise<CreatedAdmin> {
  return authFetch<CreatedAdmin>(
    ADMINS_BASE,
    { method: 'POST', body: JSON.stringify(input) },
    ERROR.adminCreationFailed,
  );
}

export function updateAdminPermissions(id: string, permissions: AdminPermissions): Promise<AdminSummary> {
  return authFetch<AdminSummary>(
    `${ADMINS_BASE}/${id}`,
    { method: 'PUT', body: JSON.stringify({ permissions }) },
    ERROR.adminUpdateFailed,
  );
}

export function deleteAdmin(id: string): Promise<void> {
  return authFetch<void>(
    `${ADMINS_BASE}/${id}`,
    { method: 'DELETE' },
    ERROR.adminDeleteFailed,
  );
}

// ============================================
// Players (read-only)
// ============================================

export interface PlayerAdminSummary {
  id: string;
  userId: string | null;
  name: string | null;
  roles: AccountType[]; // A manager or an admin is a player too
  teamId: string | null;
  teamName: string | null;
  isLeader: boolean;
  createdAt: string;
}

export function fetchAdminPlayers(): Promise<PlayerAdminSummary[]> {
  return authFetch<PlayerAdminSummary[]>(PLAYERS_BASE, undefined, ERROR.playersAdminFetchFailed);
}

export function deletePlayer(id: string): Promise<void> {
  return authFetch<void>(
    `${PLAYERS_BASE}/${id}`,
    { method: 'DELETE' },
    ERROR.playerDeleteFailed,
  );
}

// ============================================
// Teams
// ============================================

export interface TeamAdminSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  venue: { id: string; name: string; city: string } | null;
  leader: { id: string; name: string } | null;
  memberCount: number;
  createdAt: string;
}

export interface TeamAdminMember {
  id: string;
  playerId: string;
  name: string;
  isLeader: boolean;
}

export interface TeamAdminDetail extends TeamAdminSummary {
  members: TeamAdminMember[];
}

export function fetchAdminTeams(): Promise<TeamAdminSummary[]> {
  return authFetch<TeamAdminSummary[]>(TEAMS_BASE, undefined, ERROR.teamsAdminFetchFailed);
}

export function fetchAdminTeamDetail(id: string): Promise<TeamAdminDetail> {
  return authFetch<TeamAdminDetail>(`${TEAMS_BASE}/${id}`, undefined, ERROR.teamsAdminFetchFailed);
}

export function deleteTeam(id: string): Promise<void> {
  return authFetch<void>(
    `${TEAMS_BASE}/${id}`,
    { method: 'DELETE' },
    ERROR.teamDeleteFailed,
  );
}
