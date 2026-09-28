import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';

export type AppDatabase = ReturnType<typeof drizzle>;

export function initDb(dbPath: string, migrationsFolder: string): AppDatabase {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = drizzle(dbPath);
  try {
    db.run(sql`PRAGMA journal_mode = WAL`);
    db.run(sql`PRAGMA foreign_keys = ON`);
    migrate(db, { migrationsFolder });
    return db;
  } catch (error) {
    db.$client.close();
    throw error;
  }
}
