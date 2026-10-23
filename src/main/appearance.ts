import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import {
  defaultAppearance,
  isAppearancePreference,
  type AppearancePreference,
  type AppearanceSnapshot,
} from '../shared/contracts/appearance';

/** App-wide preferences are separate from profile and financial data. */
export function createAppearanceService(filename: string) {
  let preference: AppearancePreference = { ...defaultAppearance };
  let revision = 0;

  try {
    const saved: unknown = JSON.parse(readFileSync(filename, 'utf8'));

    if (isAppearancePreference(saved)) {
      preference = { themeId: saved.themeId, colorMode: saved.colorMode };
    }
  } catch {
    // Missing, invalid, or unreadable preferences use the default appearance.
  }

  return {
    snapshot(systemDark: boolean): AppearanceSnapshot {
      return {
        ...preference,
        resolvedMode:
          preference.colorMode === 'system'
            ? systemDark
              ? 'dark'
              : 'light'
            : preference.colorMode,
        revision,
      };
    },
    update(value: unknown): AppearancePreference {
      if (!isAppearancePreference(value)) {
        throw new Error('Invalid appearance preference.');
      }

      const next = { themeId: value.themeId, colorMode: value.colorMode };
      // Commit to disk before publishing; failed writes preserve the current theme.
      writeFileSync(`${filename}.tmp`, JSON.stringify(next), 'utf8');
      renameSync(`${filename}.tmp`, filename);
      preference = next;
      revision += 1;
      return { ...preference };
    },
    systemChanged(): void {
      revision += 1;
    },
  };
}
