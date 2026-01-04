import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  migrate: {
    async connect() {
      return {
        url: process.env.DATABASE_URL || 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db',
      };
    },
  },
});

