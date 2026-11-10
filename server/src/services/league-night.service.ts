// The night's work on competitive.eva.gg: the directory of league teams read
// again, then the registrations of our linked teams to their local league
// checked, one after the other. The night is due when the directory is: never
// read, or read more than 20 hours ago and it is night in Paris.

import {
  LEAGUE_DIRECTORY_CHECK_INTERVAL_MS,
  isLeagueDirectoryDue,
  syncLeagueDirectory,
} from '@services/league-directory.service';
import { checkLeagueRegistrations } from '@services/league-registrations.service';
import { logger } from '../utils/logger';

let isRunning = false;

// The directory, then the registrations, these whatever came of the directory:
// they read other lists of the site
async function runNight(): Promise<void> {
  if (!(await isLeagueDirectoryDue())) return;
  try {
    logger.info('League directory read', await syncLeagueDirectory());
  } catch (error) {
    logger.error('League directory read failed', error);
  }
  logger.info('League registrations checked', await checkLeagueRegistrations());
}

/**
 * Check every hour whether the night's work is due, and do it when it is. The
 * first check comes an hour after the server starts: a server restarted again
 * and again never reads the site at each start.
 */
export function startLeagueNight(): void {
  setInterval(() => {
    if (isRunning) return;
    isRunning = true;
    runNight()
      .catch(error => logger.error('League night failed', error))
      .finally(() => {
        isRunning = false;
      });
  }, LEAGUE_DIRECTORY_CHECK_INTERVAL_MS);
}
