// Validation constants - Pure values, no imports
// This file must NOT import anything to avoid circular dependencies

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MIN_LENGTH = 3;
export const NAME_REGEX = /^[a-zA-Z0-9]+$/;
export const TEAM_NAME_MIN_LENGTH = 2;
// An eva.gg tag is a display name plus a #123456 suffix; this only bounds what we forward to eva.gg
export const EVA_USERNAME_MAX_LENGTH = 64;
