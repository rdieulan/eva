// Account permissions as stored, read against the full set

import { DEFAULT_PLAYER_PERMISSIONS, type AccountPermissions } from '@shared/types/permissions.types';

/**
 * A player's permissions as stored, read against the full set: every category
 * and every permission of it, granted only when stored as true. A permission
 * added since they were saved stays refused until the team's leader grants
 * it, and anything else stored is left out.
 */
export function normalizeAccountPermissions(stored: unknown): AccountPermissions {
  const source = isRecord(stored) ? stored : {};
  const permissions: Record<string, Record<string, boolean>> = {};
  for (const [category, defaults] of Object.entries(DEFAULT_PLAYER_PERMISSIONS)) {
    const storedCategory = isRecord(source[category]) ? source[category] : {};
    permissions[category] = Object.fromEntries(Object.keys(defaults).map(key => [key, storedCategory[key] === true]));
  }
  return permissions as unknown as AccountPermissions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
