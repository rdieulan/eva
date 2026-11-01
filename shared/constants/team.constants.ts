// Team constants

// A team logo is stored in the database, so it stays small: a square icon, not a poster
export const TEAM_LOGO_MAX_BYTES = 256 * 1024;

// Image formats a team logo can be. The server checks the file content, never the extension.
export const TEAM_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type TeamLogoMimeType = typeof TEAM_LOGO_MIME_TYPES[number];

// Favorite venues are the quick-access row of the venue pickers: a handful, not a list of every venue
export const TEAM_FAVORITE_VENUES_MAX = 6;
