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
