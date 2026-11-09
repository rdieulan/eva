// Server entry point

import { app } from './src/app';
import { logger } from './src/utils/logger';
import { startScrimUpkeep } from './src/services/scrim-upkeep.service';
import { startNotificationPurge } from './src/services/notification-inbox.service';
import { startLeagueDirectorySync } from './src/services/league-directory.service';

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  startScrimUpkeep();
  startNotificationPurge();
  // In development the directory is read on demand (npm run db:sync-league-teams):
  // competitive.eva.gg never gets a call nobody asked for from a machine at work
  if (isProduction) startLeagueDirectorySync();
});

