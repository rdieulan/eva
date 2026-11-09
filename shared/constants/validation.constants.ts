// Validation constants - Pure values, no imports
// This file must NOT import anything to avoid circular dependencies

// A person's name follows Discord's own bounds, since it starts as their Discord
// name: accents, spaces and emojis are fine
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 32;
export const TEAM_NAME_MIN_LENGTH = 2;
// An eva.gg tag is a display name plus a #123456 suffix; this only bounds what we forward to eva.gg
export const EVA_USERNAME_MAX_LENGTH = 64;
// An eva.gg slot id is an opaque hex string, about 80 characters long today
export const EVA_SLOT_ID_MAX_LENGTH = 200;
// A match runs on a few consecutive slots of 40 minutes; this only bounds what is stored
export const EVA_SLOTS_PER_MATCH_MAX = 6;
// A scrim search offers slots of one day: a venue runs a dozen per arena, on a few arenas
export const SCRIM_OFFER_SLOTS_MAX = 36;

// A word to the other team with a scrim proposal: a line, not a letter
export const SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH = 300;
