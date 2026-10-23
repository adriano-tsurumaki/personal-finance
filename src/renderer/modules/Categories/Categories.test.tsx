import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale, t } from '@lib/i18n';
import type {
  CategoryDto,
  CategoryActivityDto,
} from '@shared/contracts/categories';
import { filterCategories } from './presentation';
import CategoryCard from './CategoryCard';

const category: CategoryDto = {
  id: 1,
  name: 'Food',
  color: '#25845b',
  icon_key: 'food',
  transaction_type: 'expense',
  description: 'Daily meals',
  catalog_key: 'food',
  archived_at: null,
};

test('category search uses localized display names and combines type filters without excluding both', () => {
  const rows = [
    category,
    {
      ...category,
      id: 2,
      name: 'Café',
      catalog_key: null,
      transaction_type: 'both' as const,
    },
    {
      ...category,
      id: 3,
      name: 'Salary',
      catalog_key: 'salary',
      transaction_type: 'income' as const,
      archived_at: '2026-10-01',
    },
  ];
  try {
    setLocale('en-US');
    assert.deepEqual(
      filterCategories(rows, ' CAFE ', 'expense').map((row) => row.id),
      [2],
    );
    assert.deepEqual(
      filterCategories(rows, '', 'income').map((row) => row.id),
      [2, 3],
    );
    assert.equal(filterCategories(rows, 'missing', 'all').length, 0);
    setLocale('pt-BR');
    assert.deepEqual(
      filterCategories(rows, 'alimenta', 'all').map((row) => row.id),
      [1],
    );
    assert.deepEqual(
      filterCategories(rows, 'sal', 'archived').map((row) => row.id),
      [3],
    );
  } finally {
    setLocale('pt-BR');
  }
});

test('compact category cards distinguish real totals, zero activity and unavailable data in both locales', () => {
  const activity: CategoryActivityDto = {
    category_id: 1,
    income_cents: 2500,
    expense_cents: 12345,
    entry_count: 3,
    income_daily_cents: [2500, 0],
    expense_daily_cents: [10000, 2345],
  };
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const render = (
        available: boolean,
        value?: CategoryActivityDto,
        archived = false,
      ) =>
        renderToStaticMarkup(
          <CategoryCard
            category={{
              ...category,
              archived_at: archived ? '2026-10-01' : null,
            }}
            activity={value}
            activityAvailable={available}
            blocked
            onEdit={() => {}}
            onArchive={() => {}}
          />,
        );
      const loaded = render(true, activity);
      assert.match(loaded, /123[.,]45/);
      assert.match(loaded, /25[.,]00/);
      assert.ok(
        loaded.includes(t('category_manager.entry_count', { count: 3 })),
      );
      assert.match(loaded, /aria-haspopup="menu"/);
      assert.match(loaded, /disabled=""/);
      assert.equal((loaded.match(/<rect/g) ?? []).length, 2);
      const unavailable = render(false);
      assert.match(unavailable, /—/);
      assert.doesNotMatch(unavailable, /0[.,]00/);
      const empty = render(true);
      assert.match(empty, /0[.,]00/);
      assert.ok(
        empty.includes(t('category_manager.entry_count', { count: 0 })),
      );
      assert.ok(
        render(true, activity, true).includes(t('category_manager.archived')),
      );
    }
  } finally {
    setLocale('pt-BR');
  }
});
