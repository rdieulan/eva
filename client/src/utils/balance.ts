// Balance validation utilities
// Checks if a map configuration has a balanced roster

import type { MapConfig, BalanceRule, BalanceValidation, RuleKey } from '@shared/types';
import { getPlayers } from '@/api/players.api';

export interface BalanceCheckResult {
  isBalanced: boolean;
  hasWarnings: boolean;
  errors: BalanceValidation[];
  warnings: BalanceValidation[];
}

// Cached rules for synchronous access
let cachedRules: BalanceRule[] | null = null;

/**
 * Set cached rules (called from useBalanceRules composable)
 */
export function setBalanceRules(rules: BalanceRule[]): void {
  cachedRules = rules;
}

/**
 * Get cached rules
 */
export function getBalanceRules(): BalanceRule[] | null {
  return cachedRules;
}

/**
 * Get rule by key
 */
function getRule(ruleKey: RuleKey): BalanceRule | undefined {
  return cachedRules?.find(r => r.ruleKey === ruleKey && r.enabled);
}

/**
 * Get rule param value with default fallback
 */
function getRuleParam(ruleKey: RuleKey, paramKey: string, defaultValue: number): number {
  const rule = getRule(ruleKey);
  if (!rule) return defaultValue;
  return rule.params[paramKey] ?? defaultValue;
}

/**
 * Get assignment IDs for a specific user on a map
 */
export function getPlayerAssignments(map: MapConfig, userId: string): number[] {
  const playerAssignment = map.players.find(p => p.userId === userId);
  return playerAssignment?.assignmentIds || [];
}

/**
 * Get main assignment ID for a specific user on a map
 */
export function getPlayerMainAssignment(map: MapConfig, userId: string): number | null {
  const playerAssignment = map.players.find(p => p.userId === userId);
  return playerAssignment?.mainAssignmentId ?? null;
}

/**
 * Get user IDs assigned to a specific assignment on a map
 */
export function getAssignmentPlayers(map: MapConfig, assignmentId: number): string[] {
  return map.players
    .filter(p => p.assignmentIds.includes(assignmentId))
    .map(p => p.userId);
}

/**
 * Check if a map has a balanced roster
 * Uses team rules if available, otherwise uses defaults
 */
export function checkMapBalance(map: MapConfig): BalanceCheckResult {
  const errors: BalanceValidation[] = [];
  const warnings: BalanceValidation[] = [];
  const assignmentIds = map.assignments.map(a => a.id);
  const playerList = getPlayers();

  // Build assignment to players mapping
  const assignmentToPlayers: Record<number, string[]> = {};
  for (const assignmentId of assignmentIds) {
    assignmentToPlayers[assignmentId] = getAssignmentPlayers(map, assignmentId);
  }

  // Helper to add validation result
  const addResult = (ruleKey: RuleKey, ruleName: string, message: string) => {
    const rule = getRule(ruleKey);
    const severity = rule?.severity ?? 'ERROR';
    const validation: BalanceValidation = { ruleKey, ruleName, message, severity };
    if (severity === 'ERROR') {
      errors.push(validation);
    } else {
      warnings.push(validation);
    }
  };

  // Rule 1: Each assignment must have at least X players
  const minPlayersRule = getRule('MIN_PLAYERS_PER_ROLE');
  if (minPlayersRule) {
    const minPlayers = getRuleParam('MIN_PLAYERS_PER_ROLE', 'minPlayers', 2);
    for (const [assignmentIdStr, userIds] of Object.entries(assignmentToPlayers)) {
      const assignmentId = Number(assignmentIdStr);
      if (userIds.length < minPlayers) {
        const assignment = map.assignments.find(a => a.id === assignmentId);
        const assignmentName = assignment?.name || String(assignmentId);
        if (userIds.length === 0) {
          addResult('MIN_PLAYERS_PER_ROLE', minPlayersRule.name, `${assignmentName} n'a aucun joueur`);
        } else {
          const playerNames = userIds.map(uid => playerList.find(p => p.id === uid)?.name || uid);
          addResult('MIN_PLAYERS_PER_ROLE', minPlayersRule.name, `${assignmentName} n'a que ${playerNames.join(', ')} (min: ${minPlayers})`);
        }
      }
    }
  }

  // Rule 2: Each player must have at least X assignments
  const minRolesRule = getRule('MIN_ROLES_PER_PLAYER');
  if (minRolesRule) {
    const minRoles = getRuleParam('MIN_ROLES_PER_PLAYER', 'minRoles', 2);
    for (const playerAssignment of map.players) {
      if (playerAssignment.assignmentIds.length < minRoles) {
        const playerName = playerList.find(p => p.id === playerAssignment.userId)?.name || playerAssignment.userId;
        if (playerAssignment.assignmentIds.length === 0) {
          addResult('MIN_ROLES_PER_PLAYER', minRolesRule.name, `${playerName} n'a aucun poste`);
        } else {
          const assignmentNames = playerAssignment.assignmentIds.map(aid => {
            const assignment = map.assignments.find(a => a.id === aid);
            return assignment?.name || String(aid);
          });
          addResult('MIN_ROLES_PER_PLAYER', minRolesRule.name, `${playerName} n'a que ${assignmentNames.join(', ')} (min: ${minRoles})`);
        }
      }
    }
  }

  // Rule 3: Each player must have at most X assignments
  const maxRolesRule = getRule('MAX_ROLES_PER_PLAYER');
  if (maxRolesRule) {
    const maxRoles = getRuleParam('MAX_ROLES_PER_PLAYER', 'maxRoles', 2);
    for (const playerAssignment of map.players) {
      if (playerAssignment.assignmentIds.length > maxRoles) {
        const playerName = playerList.find(p => p.id === playerAssignment.userId)?.name || playerAssignment.userId;
        addResult('MAX_ROLES_PER_PLAYER', maxRolesRule.name, `${playerName} a ${playerAssignment.assignmentIds.length} postes (max: ${maxRoles})`);
      }
    }
  }

  // Rule 4: Find duplicate pairs
  const duplicatePairsRule = getRule('NO_DUPLICATE_PAIRS');
  if (duplicatePairsRule) {
    const minPlayers = getRuleParam('MIN_PLAYERS_PER_ROLE', 'minPlayers', 2);
    const assignmentsWithMinPlayers: { assignmentId: number; userIds: string[] }[] = [];
    for (const [assignmentIdStr, userIds] of Object.entries(assignmentToPlayers)) {
      if (userIds.length === minPlayers) {
        assignmentsWithMinPlayers.push({
          assignmentId: Number(assignmentIdStr),
          userIds: userIds.sort()
        });
      }
    }

    const pairToAssignments: Record<string, number[]> = {};
    for (const { assignmentId, userIds } of assignmentsWithMinPlayers) {
      const pairKey = userIds.join('-');
      if (!pairToAssignments[pairKey]) {
        pairToAssignments[pairKey] = [];
      }
      pairToAssignments[pairKey]!.push(assignmentId);
    }

    for (const [pairKey, assignmentIdList] of Object.entries(pairToAssignments)) {
      if (assignmentIdList.length > 1) {
        const pair = pairKey.split('-');
        const playerNames = pair.map(uid => playerList.find(p => p.id === uid)?.name || uid);
        const assignmentNames = assignmentIdList.map(aid => {
          const assignment = map.assignments.find(a => a.id === aid);
          return assignment?.name || String(aid);
        });
        addResult('NO_DUPLICATE_PAIRS', duplicatePairsRule.name, `${assignmentNames.join(' et ')} sont couverts uniquement par ${playerNames.join(' et ')}`);
      }
    }
  }

  return {
    isBalanced: errors.length === 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings
  };
}

/**
 * Get the name of an assignment on a map
 */
export function getAssignmentName(maps: MapConfig[], mapId: string, assignmentId: number): string {
  const map = maps.find(m => m.id === mapId);
  if (!map) return `Assignment #${assignmentId}`;
  const assignment = map.assignments.find(a => a.id === assignmentId);
  return assignment?.name || `Assignment #${assignmentId}`;
}
