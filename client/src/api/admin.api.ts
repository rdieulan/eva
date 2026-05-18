// Admin API client - venue / manager / admin / player / team management

import type { AdminPermissions, Venue } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

const VENUES_BASE = '/api/admin/venues';
const MANAGERS_BASE = '/api/admin/managers';
const ADMINS_BASE = '/api/admin/admins';
const PLAYERS_BASE = '/api/admin/players';
const TEAMS_BASE = '/api/admin/teams';

export interface VenueInput {
  name: string;
  city: string;
  address: string;
  phone?: string | null;
}

export interface ManagerSummary {
  id: string;
  userId: string;
  email: string;
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

export function createManager(input: { email: string; name: string; venueIds: string[] }): Promise<CreatedManager> {
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
 * Build the activation URL a manager / admin can use to set their password.
 */
export function buildActivationUrl(activationToken: string): string {
  return `${window.location.origin}/activate/${activationToken}`;
}

// ============================================
// Admins
// ============================================

export interface AdminSummary {
  id: string;
  userId: string;
  email: string;
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
  email: string;
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
  email: string | null;
  name: string | null;
  teamId: string | null;
  teamName: string | null;
  isLeader: boolean;
  createdAt: string;
}

export function fetchAdminPlayers(): Promise<PlayerAdminSummary[]> {
  return authFetch<PlayerAdminSummary[]>(PLAYERS_BASE, undefined, ERROR.playersAdminFetchFailed);
}

// ============================================
// Teams (read-only)
// ============================================

export interface TeamAdminSummary {
  id: string;
  name: string;
  logo: string | null;
  venue: { id: string; name: string; city: string } | null;
  leader: { id: string; name: string; email: string } | null;
  memberCount: number;
  createdAt: string;
}

export interface TeamAdminMember {
  id: string;
  playerId: string;
  email: string;
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
