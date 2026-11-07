// eva.gg constants shared by the server integration and the links we build

// "EVA BATTLE ARENA" (AFTER_H_BATTLE_ARENA), the competitive game our teams
// play. A venue also runs arenas for their other games, which we ignore.
export const COMPETITIVE_GAME_ID = 1;

// Booking calendar of their web app, where a player picks a slot and pays
export const EVA_BOOKING_CALENDAR_URL = 'https://app.eva.gg/fr-FR/booking/calendar';

// A match is 4 against 4: the lineup a team needs on a day, and the headcount
// of a full slot. eva.gg often shows a capacity of 10 on these slots, a known
// glitch on their side, so the headcount we check is ours.
export const TEAM_PLAYER_COUNT = 4;
export const MATCH_PLAYER_COUNT = 2 * TEAM_PLAYER_COUNT;

// A slot of their calendar lasts 40 minutes of play
export const EVA_SLOT_DURATION_MINUTES = 40;

// How many consecutive 40-minute slots a scrim takes: two as a rule, a search
// can ask for one to four
export const SCRIM_MATCH_SLOTS_DEFAULT = 2;
export const SCRIM_MATCH_SLOTS_MIN = 1;
export const SCRIM_MATCH_SLOTS_MAX = 4;

// How many matches a search asks for on its day: one as a rule; a team may
// want to play several the same evening, against one opponent or more
export const SCRIM_MATCH_COUNT_DEFAULT = 1;
export const SCRIM_MATCH_COUNT_MIN = 1;
export const SCRIM_MATCH_COUNT_MAX = 4;

// How many venues the matchmaking calendar shows at once, and a search offers
// slots in: each one is a day of slots to read from eva.gg
export const SCRIM_SEARCH_VENUES_MAX = 4;
