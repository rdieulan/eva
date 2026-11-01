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

export {
  isSubscriptionRenewalDay,
  getNextSubscriptionRenewal,
} from './subscription.utils';

export { addMinutesToTime } from './time.utils';

export { buildEvaBookingUrl, assessSlotHeadcount, type SlotHeadcount, type SlotHeadcountStatus } from './eva.utils';
