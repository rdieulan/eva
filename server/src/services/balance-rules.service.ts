// Balance rules service - business logic

import { prisma } from '@db/prisma';
import type { BalanceSeverity } from '@prisma/client';
import { DEFAULT_BALANCE_RULES } from '@shared/types';

/**
 * Get all balance rules for a team, creating defaults if none exist
 */
export async function getTeamRules(teamId: string) {
  let rules = await prisma.balanceRule.findMany({
    where: { teamId },
    orderBy: { ruleKey: 'asc' },
  });

  // If no rules exist, create defaults
  if (!rules.length) {
    rules = await createDefaultRules(teamId);
  }

  return rules;
}

/**
 * Create default balance rules for a team
 */
export async function createDefaultRules(teamId: string) {
  return prisma.$transaction(
    DEFAULT_BALANCE_RULES.map(rule =>
      prisma.balanceRule.create({
        data: {
          teamId,
          ruleKey: rule.ruleKey,
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          enabled: rule.enabled,
          params: rule.params as object | undefined,
        },
      })
    )
  );
}

/**
 * Update a balance rule (returns null if not found or not owned by team)
 */
export async function updateRule(
  ruleId: string,
  teamId: string,
  data: { severity?: BalanceSeverity; enabled?: boolean; params?: object }
) {
  // Verify rule belongs to team
  const rule = await prisma.balanceRule.findUnique({
    where: { id: ruleId },
  });

  if (!rule || rule.teamId !== teamId) {
    return null;
  }

  return prisma.balanceRule.update({
    where: { id: ruleId },
    data: {
      ...(data.severity !== undefined && { severity: data.severity }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.params !== undefined && { params: data.params }),
    },
  });
}

/**
 * Reset all balance rules to defaults for a team
 */
export async function resetRules(teamId: string) {
  // Delete all existing rules
  await prisma.balanceRule.deleteMany({
    where: { teamId },
  });

  // Create default rules
  return createDefaultRules(teamId);
}
