import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';
import { getDevelopmentDatabasePath } from './src/main/db/config';

export default defineConfig({
  out: './drizzle',
  schema: './src/main/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: { url: getDevelopmentDatabasePath(resolve('.')) },
});
