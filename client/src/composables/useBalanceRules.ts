// Composable for balance rules management

import { ref, computed, watch } from 'vue';
import type { BalanceRule, BalanceRuleUpdate } from '@shared/types';
import {
  getBalanceRules as fetchBalanceRulesApi,
  updateBalanceRule,
  resetBalanceRules,
} from '@/api/balance-rules.api';
import { setBalanceRules } from '@/utils/balance';

const rules = ref<BalanceRule[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const initialized = ref(false);
// Version counter to trigger reactive recalculations in components
const rulesVersion = ref(0);

// Sync rules to balance.ts cache whenever they change
watch(rules, (newRules) => {
  setBalanceRules(newRules);
  rulesVersion.value++;
}, { deep: true });

/**
 * Composable for managing team balance rules
 */
export function useBalanceRules() {
  const enabledRules = computed(() => rules.value.filter(r => r.enabled));

  /**
   * Fetch balance rules from server
   */
  async function fetchRules(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      rules.value = await fetchBalanceRulesApi();
      initialized.value = true;
    } catch (err) {
      error.value = 'Failed to load balance rules';
      console.error('Error fetching balance rules:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update a rule
   */
  async function updateRule(
    ruleId: string,
    data: BalanceRuleUpdate
  ): Promise<boolean> {
    try {
      const updated = await updateBalanceRule(ruleId, data);
      const index = rules.value.findIndex(r => r.id === ruleId);
      if (index !== -1) {
        rules.value[index] = updated;
      }
      return true;
    } catch (err) {
      console.error('Error updating balance rule:', err);
      return false;
    }
  }

  /**
   * Reset all rules to defaults
   */
  async function resetToDefaults(): Promise<boolean> {
    loading.value = true;
    try {
      rules.value = await resetBalanceRules();
      return true;
    } catch (err) {
      console.error('Error resetting balance rules:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    rules,
    rulesVersion,
    enabledRules,
    loading,
    error,
    initialized,
    fetchRules,
    updateRule,
    resetToDefaults,
  };
}
