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

export {
  followsOn,
  isOneRun,
  orderRunSlots,
  slotStreaks,
  runSpan,
  spansOverlap,
  countMatches,
  type RunSlot,
  type TimeSpan,
} from './scrim.utils';

export { normalizeLinkUrl, isAcceptableLinkInput } from './venue.utils';

export { detectImageType } from './image.utils';

export { assessTeamAvailability, type TeamAvailability, type TeamAvailabilityStatus } from './availability.utils';

export { normalizeAccountPermissions } from './permissions.utils';
