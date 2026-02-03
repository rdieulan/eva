// Server entry point

import { app } from './src/app';
import { logger } from './src/utils/logger';

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});

