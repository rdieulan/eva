// Shared utilities barrel export

export {
  getZoneForPhase,
  isLegacyAssignment,
  migrateAssignmentToPhases,
  migrateMapConfigToPhases,
} from './map.utils';

export {
  normalizeName,
  cleanForeignName,
  validateName,
  validateTeamName,
  isValidName,
  type ValidationResult,
} from './validation.utils';

export {
  isSubscriptionRenewalDay,
  getNextSubscriptionRenewal,
} from './subscription.utils';

export { addMinutesToTime } from './time.utils';

export { formatShortDay } from './date.utils';

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

export { describeProposalDecline, type ProposalDeclineDescription } from './scrim-proposal.utils';

export {
  normalizeLinkUrl,
  isAcceptableLinkInput,
  formatVenuePlace,
  slugifyVenueName,
  freeVenueSlug,
  describeVenueBoard,
} from './venue.utils';

export { detectImageType } from './image.utils';

export { foldForSearch } from './search.utils';

export {
  assessTeamAvailability,
  windowCovers,
  isValidAvailabilityHours,
  formatAvailabilityHours,
  describeAvailabilityHours,
  type TeamAvailability,
  type TeamAvailabilityStatus,
} from './availability.utils';

export { normalizeAccountPermissions } from './permissions.utils';

export { describeNotification } from './notification.utils';

export { calendarTargetQuery, calendarTargetPath } from './calendar.utils';
