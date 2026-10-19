import { readFileSync, renameSync, writeFileSync } from 'node:fs';

/** Stores a local profile selection beside its database, without financial data. */
export function createProfileSession(databasePath: string) {
  const filename = `${databasePath}.session.json`;
  const persistent = databasePath !== ':memory:' && databasePath !== '';

  return {
    read(): number | null {
      if (!persistent) {
        return null;
      }

      try {
        const value: unknown = JSON.parse(readFileSync(filename, 'utf8'));

        if (
          typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value > 0
        ) {
          return value;
        }
      } catch {
        // Missing or unreadable preferences must not prevent opening the app.
      }

      return null;
    },
    write(profileId: number | null): void {
      if (!persistent) {
        return;
      }

      try {
        writeFileSync(`${filename}.tmp`, JSON.stringify(profileId), 'utf8');
        renameSync(`${filename}.tmp`, filename);
      } catch (error) {
        console.error('Failed to remember the local profile:', error);
      }
    },
  };
}
