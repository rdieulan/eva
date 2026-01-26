// Shared utilities barrel export

export {
  getZoneForPhase,
  isLegacyAssignment,
  migrateAssignmentToPhases,
  migrateMapConfigToPhases,
} from './map.utils';

export {
  validateEmail,
  validatePassword,
  validateName,
  validateTeamName,
  validatePasswordsMatch,
  validateRegistration,
  isValidEmail,
  isValidPassword,
  isValidName,
  type ValidationResult,
  // Validation constants
  EMAIL_REGEX,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_REGEX,
  TEAM_NAME_MIN_LENGTH,
} from './validation.utils';
