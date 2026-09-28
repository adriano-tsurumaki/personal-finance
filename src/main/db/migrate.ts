import { resolve } from 'node:path';
import { initDb } from '../db';
import { getDevelopmentDatabasePath } from './config';

const root = resolve('.');
const db = initDb(getDevelopmentDatabasePath(root), resolve(root, 'drizzle'));
db.$client.close();
console.log('Database migrations applied.');
