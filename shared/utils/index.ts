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
} from './validation.utils';
