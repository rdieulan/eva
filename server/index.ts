// Server entry point

import { app } from './src/app';

const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});

