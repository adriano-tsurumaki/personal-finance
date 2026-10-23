import { resolve } from 'node:path';
import { initDb } from '../db';
import { getDevelopmentDatabasePath } from './config';
import { recreateDemoProfile } from './demo-profile';

const root = resolve('.');
const path = getDevelopmentDatabasePath(root);

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo data is available only in development.');
}

const db = initDb(path, resolve(root, 'drizzle'));
try {
  const result = recreateDemoProfile(db);
  console.log(
    `Recreated Category Demo in ${path}: ${result.categories} categories, ${result.transactions} transactions through ${result.month}.`,
  );
  console.log('Open the app and select Category Demo, then open Categories.');
} finally {
  db.$client.close();
}
