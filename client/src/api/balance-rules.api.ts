// Balance rules API

import type { BalanceRule, BalanceRuleUpdate } from '@shared/types';
import { authFetch } from '@/api/utils';

/**
 * Get team's balance rules
 */
export async function getBalanceRules(): Promise<BalanceRule[]> {
  const response = await authFetch('/api/balance-rules');
  if (!response.ok) {
    throw new Error('Failed to load balance rules');
  }
  return response.json();
}

/**
 * Update a balance rule
 */
export async function updateBalanceRule(
  ruleId: string,
  data: BalanceRuleUpdate
): Promise<BalanceRule> {
  const response = await authFetch(`/api/balance-rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update balance rule');
  }
  return response.json();
}

/**
 * Reset all rules to defaults
 */
export async function resetBalanceRules(): Promise<BalanceRule[]> {
  const response = await authFetch('/api/balance-rules/reset', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reset balance rules');
  }
  return response.json();
}
