import assert from 'node:assert/strict';
import { test } from 'node:test';
import english from './en-US.json';
import portuguese from './pt-BR.json';
import { categoryLabel, setLocale, t } from './index';
import {
  formatCurrency,
  formatSignedCurrency,
  formatYearMonthToString,
} from '../format/currency';

function catalogEntries(catalog: object, prefix = ''): [string, string][] {
  return Object.entries(catalog).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? [[path, value]]
      : catalogEntries(value, path);
  });
}

test('catalogs stay aligned and both locales display the same BRL amounts', () => {
  const englishEntries = catalogEntries(english);
  const portugueseEntries = new Map(catalogEntries(portuguese));
  assert.deepEqual(
    [...portugueseEntries.keys()].sort(),
    englishEntries.map(([key]) => key).sort(),
  );

  for (const [key, value] of englishEntries) {
    assert.ok(value.trim());
    assert.ok(portugueseEntries.get(key)!.trim());
    assert.deepEqual(
      value.match(/\{\w+\}/g),
      portugueseEntries.get(key)!.match(/\{\w+\}/g),
    );
  }

  for (const locale of ['pt-BR', 'en-US'] as const) {
    setLocale(locale);
    assert.equal(
      t('summary.balance'),
      locale === 'pt-BR' ? portuguese.summary.balance : english.summary.balance,
    );
    assert.ok(t('profiles.menu', { name: 'Alex' }).includes('Alex'));
    assert.equal(
      formatYearMonthToString(2026, 9),
      locale === 'pt-BR' ? 'Setembro de 2026' : 'September 2026',
    );
    for (const amount of [0, 1.23, -45.67, 1234567.89]) {
      assert.equal(
        formatCurrency(amount),
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount),
      );
    }

    assert.match(formatSignedCurrency(12.34, 'expense'), /^−/);
    assert.ok(t('transactions.entries_other', { count: 2 }).startsWith('2 '));
    assert.equal(
      categoryLabel({ name: 'My food', catalog_key: 'food' }),
      'My food',
    );
    assert.equal(
      categoryLabel({ name: 'Food', catalog_key: 'food' }),
      locale === 'pt-BR' ? 'Alimentação' : 'Food',
    );
  }

  setLocale('pt-BR');
});
