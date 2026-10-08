import { useSyncExternalStore } from 'react';
import type { ProfileLocale } from '@shared/contracts/user';
import english from './en-US.json';
import portuguese from './pt-BR.json';

type TranslationPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : `${Key}.${TranslationPaths<T[Key]>}`;
}[keyof T & string];

export type TranslationKey = TranslationPaths<typeof english>;

function resolveTranslation(catalog: object, key: string): string | undefined {
  let value: unknown = catalog;

  for (const segment of key.split('.')) {
    if (
      typeof value !== 'object' ||
      value === null ||
      !Object.hasOwn(value, segment)
    ) {
      return undefined;
    }

    value = (value as Record<string, unknown>)[segment];
  }

  return typeof value === 'string' ? value : undefined;
}
let locale: ProfileLocale = 'pt-BR';
const listeners = new Set<() => void>();

export function getLocale(): ProfileLocale {
  return locale;
}

export function setLocale(value: ProfileLocale): void {
  locale = value === 'en-US' ? 'en-US' : 'pt-BR';

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }

  listeners.forEach((listener) => listener());
}

export function useLocale(): ProfileLocale {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getLocale);
}

export function t(
  key: TranslationKey,
  values: Record<string, string | number> = {},
): string {
  const catalog = locale === 'en-US' ? english : portuguese;
  const template =
    resolveTranslation(catalog, key) || resolveTranslation(english, key);

  if (!template) {
    throw new Error(`Missing translation: ${key}`);
  }

  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? `{${name}}`),
  );
}

export function categoryLabel(category: {
  name: string;
  catalog_key?: string | null;
}): string {
  const key = `categories.${category.catalog_key}`;
  const defaultName = resolveTranslation(english, key);

  if (category.catalog_key && defaultName && category.name === defaultName) {
    return t(key as TranslationKey);
  }

  return category.name;
}
