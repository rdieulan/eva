// Server entry point

import { app } from './src/app';
import { logger } from './src/utils/logger';
import { missingPublisherSettings } from './src/utils/publisher';
import { startScrimUpkeep } from './src/services/scrim-upkeep.service';
import { startNotificationPurge } from './src/services/notification-inbox.service';
import { startLeagueNight } from './src/services/league-night.service';

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  startScrimUpkeep();
  startNotificationPurge();
  // In development the directory and the registrations are read on demand (npm run
  // db:sync-league-teams, db:check-league-registrations): competitive.eva.gg never
  // gets a call nobody asked for from a machine at work
  if (isProduction) startLeagueNight();
  // The legal pages name who publishes the site: in production, a setting
  // left out shows on them as not given, and is said here
  const missing = missingPublisherSettings();
  if (isProduction && missing.length) {
    logger.error(`Legal pages incomplete: set ${missing.join(', ')} for this deployment`);
  }
});

