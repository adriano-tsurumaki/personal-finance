import { config } from 'dotenv';
import { resolve } from 'node:path';

export function getDevelopmentDatabasePath(projectRoot: string): string {
  config({ path: resolve(projectRoot, '.env'), quiet: true });
  const filename = process.env.DB_FILE_NAME || './personal_finance.db';
  // Accept the local file: prefix from the SQLite getting-started guide.
  return resolve(projectRoot, filename.replace(/^file:/, ''));
}
