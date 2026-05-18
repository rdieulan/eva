<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBalanceRules } from '@/composables/useBalanceRules';
import type { BalanceSeverity, BalanceRule } from '@shared/types';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

defineEmits<{
  close: [];
}>();

const {
  rules,
  loading,
  fetchRules,
  updateRule,
  resetToDefaults,
} = useBalanceRules();

const showResetConfirm = ref(false);

onMounted(() => {
  fetchRules();
});

async function handleToggle(rule: BalanceRule) {
  await updateRule(rule.id, { enabled: !rule.enabled });
}

async function handleSeverityChange(rule: BalanceRule, severity: BalanceSeverity) {
  await updateRule(rule.id, { severity });
}

async function handleParamChange(rule: BalanceRule, paramKey: string, value: number) {
  const newParams = { ...rule.params, [paramKey]: value };
  await updateRule(rule.id, { params: newParams });
}

async function handleReset() {
  showResetConfirm.value = true;
}

async function confirmReset() {
  await resetToDefaults();
  showResetConfirm.value = false;
}

// Get param label for display
function getParamLabel(paramKey: string): string {
  const labels: Record<string, string> = {
    minPlayers: 'Minimum joueurs',
    minRoles: 'Minimum rôles',
    maxRoles: 'Maximum rôles',
  };
  return labels[paramKey] || paramKey;
}

// Check if rule has editable params
function hasParams(rule: BalanceRule): boolean {
  return rule.params && Object.keys(rule.params).length > 0;
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal balance-rules-modal">
      <div class="modal-header">
        <h2>⚖️ Règles d'équilibre</h2>
      </div>

      <div class="modal-body">
        <div v-if="loading" class="loading">
          Chargement...
        </div>

        <div v-else class="rules-list">
          <div
            v-for="rule in rules"
            :key="rule.id"
            class="rule-item"
            :class="{ disabled: !rule.enabled }"
          >
            <div class="rule-header">
              <div class="rule-toggle">
                <label class="toggle">
                  <input
                    type="checkbox"
                    :checked="rule.enabled"
                    @change="handleToggle(rule)"
                  >
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="rule-info">
                <div class="rule-name">{{ rule.name }}</div>
                <div v-if="rule.description" class="rule-description">
                  {{ rule.description }}
                </div>
              </div>

              <div class="rule-severity">
                <span class="severity-label">Importance</span>
                <div class="severity-switch" :class="{ disabled: !rule.enabled }">
                  <button
                    class="severity-option"
                    :class="{ active: rule.severity === 'ERROR' }"
                    :disabled="!rule.enabled"
                    @click="handleSeverityChange(rule, 'ERROR')"
                    title="Erreur (bloquante)"
                  >
                    Erreur
                  </button>
                  <button
                    class="severity-option"
                    :class="{ active: rule.severity === 'WARNING' }"
                    :disabled="!rule.enabled"
                    @click="handleSeverityChange(rule, 'WARNING')"
                    title="Avertissement"
                  >
                    Alerte
                  </button>
                </div>
              </div>
            </div>

            <!-- Editable params -->
            <div v-if="hasParams(rule) && rule.enabled" class="rule-params">
              <div
                v-for="(value, key) in rule.params"
                :key="key"
                class="param-item"
              >
                <label>{{ getParamLabel(String(key)) }}</label>
                <input
                  type="number"
                  :value="value"
                  min="0"
                  max="10"
                  @change="handleParamChange(rule, String(key), Number(($event.target as HTMLInputElement).value))"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-reset" @click="handleReset">
          🔄 Réinitialiser
        </button>
        <button class="btn-close" @click="$emit('close')">
          Fermer
        </button>
      </div>
    </div>
  </div>

  <!-- Reset confirmation modal -->
  <ConfirmModal
    :open="showResetConfirm"
    title="Réinitialiser les règles"
    message="Voulez-vous réinitialiser toutes les règles aux valeurs par défaut ?"
    confirmText="Réinitialiser"
    cancelText="Annuler"
    :danger="true"
    @confirm="confirmReset"
    @cancel="showResetConfirm = false"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;
@use '@/styles/buttons' as *;
@use 'sass:color';

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.balance-rules-modal {
  background: $color-bg-secondary;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid $color-border;

  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: $color-text-primary;
  }
}

.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}

.loading {
  text-align: center;
  padding: 40px;
  color: $color-text-secondary;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: $color-bg-tertiary;
  border-radius: 6px;
  transition: opacity 0.2s;

  &.disabled {
    opacity: 0.5;
  }
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rule-params {
  display: flex;
  gap: 16px;
  padding-left: 54px; // Align with rule-info (toggle width + gap)

  .param-item {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      font-size: 0.85rem;
      color: $color-text-secondary;
    }

    input {
      width: 60px;
      padding: 4px 8px;
      background: $color-bg-primary;
      border: 1px solid $color-border;
      border-radius: 4px;
      color: $color-text-primary;
      font-size: 0.9rem;
      text-align: center;

      &:focus {
        outline: none;
        border-color: $color-accent;
      }
    }
  }
}

.rule-toggle {
  flex-shrink: 0;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: $color-border;
    transition: 0.3s;
    border-radius: 24px;

    &::before {
      position: absolute;
      content: '';
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }

  input:checked + .toggle-slider {
    background-color: $color-success;
  }

  input:checked + .toggle-slider::before {
    transform: translateX(18px);
  }
}

.rule-info {
  flex: 1;
  min-width: 0;
}

.rule-name {
  font-weight: 500;
  color: $color-text-primary;
}

.rule-description {
  font-size: 0.85rem;
  color: $color-text-secondary;
  margin-top: 2px;
}

.rule-severity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.severity-switch {
  display: flex;
  background: $color-bg-primary;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid $color-border;

  &.disabled {
    opacity: 0.4;
  }
}

.severity-option {
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled):not(.active) {
    color: $color-text-primary;
  }

  &.active {
    border: 1px solid $color-border;
  }

  // Error active state
  &:first-child.active {
    color: $color-danger;
    background: rgba($color-danger, 0.15);
    border-color: rgba($color-danger, 0.3);
  }

  // Warning active state
  &:last-child.active {
    color: $color-warning;
    background: rgba($color-warning, 0.15);
    border-color: rgba($color-warning, 0.3);
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.severity-label {
  font-size: 0.65rem;
  color: $color-text-secondary;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 500;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid $color-border;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.btn-reset {
  @include btn-base($color-danger);
}

.btn-close {
  @include btn-base($color-accent);
}
</style>
