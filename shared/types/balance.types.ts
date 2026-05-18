// Balance rules types for team-specific validation configuration

/**
 * Rule severity determines how violations are displayed
 */
export type BalanceSeverity = 'ERROR' | 'WARNING';

/**
 * Available rule keys for balance validation
 * These match the actual validation rules in checkMapBalance
 */
export type RuleKey =
  | 'MIN_PLAYERS_PER_ROLE'  // Each role must have at least X players
  | 'MIN_ROLES_PER_PLAYER'  // Each player must have at least X roles
  | 'MAX_ROLES_PER_PLAYER'  // Each player must have at most X roles
  | 'NO_DUPLICATE_PAIRS';   // Two roles can't be covered by same pair only

/**
 * Rule parameters (flexible record for different rule types)
 */
export type RuleParams = Record<string, number>;

/**
 * Balance rule definition
 */
export interface BalanceRule {
  id: string;
  teamId: string;
  ruleKey: RuleKey;
  name: string;
  description?: string;
  severity: BalanceSeverity;
  enabled: boolean;
  params: RuleParams;
}

/**
 * Balance rule for creation (without id)
 */
export type BalanceRuleCreate = Omit<BalanceRule, 'id'>;

/**
 * Balance rule for update
 */
export type BalanceRuleUpdate = Partial<Pick<BalanceRule, 'severity' | 'enabled' | 'params'>>;

/**
 * Single validation result
 */
export interface BalanceValidation {
  ruleKey: RuleKey;
  ruleName: string;
  message: string;
  severity: BalanceSeverity;
}

/**
 * Complete balance check result
 */
export interface BalanceCheckResult {
  isBalanced: boolean;     // True if no errors (warnings are OK)
  hasWarnings: boolean;
  errors: BalanceValidation[];
  warnings: BalanceValidation[];
}

/**
 * Default balance rules for new teams
 * These match the current hardcoded rules in checkMapBalance
 */
export const DEFAULT_BALANCE_RULES: Omit<BalanceRule, 'id' | 'teamId'>[] = [
  {
    ruleKey: 'MIN_PLAYERS_PER_ROLE',
    name: 'Joueurs minimum par rôle',
    description: 'Chaque rôle doit avoir un nombre minimum de joueurs assignés',
    severity: 'ERROR',
    enabled: true,
    params: { minPlayers: 2 },
  },
  {
    ruleKey: 'MIN_ROLES_PER_PLAYER',
    name: 'Rôles minimum par joueur',
    description: 'Chaque joueur doit être assigné à un nombre minimum de rôles',
    severity: 'ERROR',
    enabled: true,
    params: { minRoles: 2 },
  },
  {
    ruleKey: 'MAX_ROLES_PER_PLAYER',
    name: 'Rôles maximum par joueur',
    description: 'Chaque joueur ne peut pas être assigné à plus de X rôles',
    severity: 'ERROR',
    enabled: true,
    params: { maxRoles: 2 },
  },
  {
    ruleKey: 'NO_DUPLICATE_PAIRS',
    name: 'Pas de paires dupliquées',
    description: 'Deux rôles ne peuvent pas être couverts uniquement par la même paire de joueurs',
    severity: 'ERROR',
    enabled: true,
    params: {},
  },
];
