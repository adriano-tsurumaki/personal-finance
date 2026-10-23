/** Built-in theme metadata shared by the application and its window shell. */
export const appearanceThemes = [
  {
    id: 'ledger',
    name: 'Ledger',
    background: { light: '#f8fbf8', dark: '#0d1612' },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    background: { light: '#fafafa', dark: '#141414' },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    background: { light: '#f6e6ee', dark: '#12242e' },
  },
  {
    id: 'japan-blues',
    name: 'Japan Blues',
    background: { light: '#faf9f5', dark: '#262624' },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    background: { light: '#fff9f6', dark: '#1a1412' },
  },
  { id: 'zen', name: 'Zen', background: { light: '#e9e4d8', dark: '#141414' } },
  {
    id: 'claude-plus',
    name: 'Claude Plus',
    background: { light: '#faf9f5', dark: '#262624' },
  },
] as const;

export type ThemeId = (typeof appearanceThemes)[number]['id'];
export type ColorMode = 'light' | 'dark' | 'system';
export type ResolvedColorMode = Exclude<ColorMode, 'system'>;

export interface AppearancePreference {
  themeId: ThemeId;
  colorMode: ColorMode;
}

export interface AppearanceSnapshot extends AppearancePreference {
  resolvedMode: ResolvedColorMode;
  revision: number;
}

export interface AppearanceApi {
  /** Synchronous preload snapshot, available before rendering starts. */
  initial: AppearanceSnapshot;
  update(preference: AppearancePreference): Promise<AppearanceSnapshot>;
  onChange(callback: (snapshot: AppearanceSnapshot) => void): () => void;
}

export const defaultAppearance: AppearancePreference = {
  themeId: 'ledger',
  colorMode: 'system',
};

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const preference = value as Record<string, unknown>;
  return (
    appearanceThemes.some((theme) => theme.id === preference.themeId) &&
    ['light', 'dark', 'system'].includes(preference.colorMode as string)
  );
}
