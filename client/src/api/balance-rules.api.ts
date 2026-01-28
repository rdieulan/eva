// Balance rules API

import type { BalanceRule, BalanceRuleUpdate } from '@shared/types';
import { ERROR_MESSAGES } from '@shared/constants';
import { authFetch } from '@/api/utils';

/**
 * Get team's balance rules
 */
export async function getBalanceRules(): Promise<BalanceRule[]> {
  return authFetch<BalanceRule[]>(
    '/api/balance-rules',
    undefined,
    ERROR_MESSAGES.balanceRulesLoadFailed
  );
}

/**
 * Update a balance rule
 */
export async function updateBalanceRule(
  ruleId: string,
  ruleData: BalanceRuleUpdate
): Promise<BalanceRule> {
  return authFetch<BalanceRule>(
    `/api/balance-rules/${ruleId}`,
    { method: 'PUT', body: JSON.stringify(ruleData) },
    ERROR_MESSAGES.balanceRuleUpdateFailed
  );
}

/**
 * Reset all rules to defaults
 */
export async function resetBalanceRules(): Promise<BalanceRule[]> {
  return authFetch<BalanceRule[]>(
    '/api/balance-rules/reset',
    { method: 'POST' },
    ERROR_MESSAGES.balanceRulesResetFailed
  );
}
