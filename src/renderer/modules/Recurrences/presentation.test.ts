import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterOccurrences,
  filterRules,
  forecastEnd,
  localToday,
  monthlyEquivalent,
} from './presentation';
import { validateDefaults } from './validation';
import type {
  RecurrenceRuleDto,
  RecurrenceOccurrenceDto,
} from '@shared/contracts/recurrence';

const rule: RecurrenceRuleDto = {
  id: 1,
  name: 'Annual plan',
  status: 'active',
  anchor_date: '2026-03-12',
  last_retained_date: null,
  versions: [
    {
      id: 1,
      version: 1,
      recurrence_id: 1,
      name: 'Annual plan',
      type: 2,
      amount_cents: 120000,
      category_id: 1,
      payment_id: 1,
      credit_card_id: null,
      frequency: 4,
      interval: 1,
      start_date: '2026-03-12',
      end_date: null,
      active: 1,
    },
  ],
};

test('overview monthly equivalents preserve intervals and exclude paused or ended commitments', () => {
  assert.equal(monthlyEquivalent(rule), 10000);
  assert.equal(monthlyEquivalent({ ...rule, status: 'paused' }), 0);
  assert.equal(monthlyEquivalent({ ...rule, status: 'ended' }), 0);
  assert.equal(
    monthlyEquivalent({
      ...rule,
      versions: [{ ...rule.versions[0], frequency: 3, interval: 3 }],
    }),
    40000,
  );
  const weekly = monthlyEquivalent({
    ...rule,
    versions: [{ ...rule.versions[0], frequency: 2, interval: 2 }],
  });
  assert.ok(weekly > 240000 && weekly < 270000);
});

test('forecast anchors to local calendar today and crosses month/year boundaries by 45 days', () => {
  assert.equal(localToday(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(forecastEnd('2026-12-31'), '2027-02-14');
  assert.equal(forecastEnd('2028-02-01'), '2028-03-17');
});

test('confirmation field validation rejects incompatible classifications and archived cards before submission', () => {
  const values = {
    name: 'Subscription',
    type: 2 as const,
    amount_cents: 10000,
    category_id: 1,
    payment_id: 1,
    credit_card_id: 1,
  };
  const options = {
    categories: [
      {
        id: 1,
        name: 'Housing',
        catalog_key: 'housing',
        icon_key: 'house',
        transaction_type: 'expense' as const,
      },
    ],
    payments: [
      { id: 1, catalog_key: 'credit' as const },
      { id: 2, catalog_key: 'pix' as const },
    ],
  };
  const cards = [
    {
      id: 1,
      name: 'Card',
      closing_day: 20,
      includes_closing_day: true,
      due_days_after_closing: 7,
      archived_at: null,
    },
  ];
  assert.deepEqual(validateDefaults(values, options, cards), {});
  assert.equal(
    validateDefaults({ ...values, type: 1 }, options, cards).payment_id,
    'recurrence.invalid_payment',
  );
  assert.equal(
    validateDefaults({ ...values, type: 1 }, options, cards).category_id,
    'recurrence.invalid_category',
  );
  assert.equal(
    validateDefaults(values, options, [
      { ...cards[0], archived_at: '2026-10-01' },
    ]).credit_card_id,
    'recurrence.invalid_card',
  );
  assert.deepEqual(
    validateDefaults(
      { ...values, payment_id: 2, credit_card_id: null },
      options,
      cards,
    ),
    {},
  );
  assert.equal(
    validateDefaults({ ...values, amount_cents: 10.5 }, options, cards)
      .amount_cents,
    'recurrence.invalid_amount',
  );
});

test('search and type filters retain occurrence state and order without changing their source', () => {
  const base = {
    recurrence_id: 1,
    name: 'Café plan',
    type: 2,
    state: 'unconfirmed',
  } as RecurrenceOccurrenceDto;
  const rows = [
    base,
    {
      ...base,
      recurrence_id: 2,
      name: 'Salary',
      type: 1 as const,
      state: 'confirmed' as const,
    },
    { ...base, recurrence_id: 3, state: 'ignored' as const },
  ];
  assert.deepEqual(
    filterOccurrences(rows, ' CAFÉ ', 'all').map((row) => row.recurrence_id),
    [1, 3],
  );
  assert.deepEqual(
    filterOccurrences(rows, '', 'income').map((row) => row.recurrence_id),
    [2],
  );
  assert.deepEqual(
    filterOccurrences(rows, '', 'expense').map((row) => row.recurrence_id),
    [1, 3],
  );
  assert.deepEqual(filterOccurrences(rows, '', 'pending'), [base]);
  assert.equal(rows.length, 3);
});

test('pending rules follow the selected month and search includes paused and ended history', () => {
  const rules = [
    rule,
    { ...rule, id: 2, status: 'paused' as const },
    { ...rule, id: 3, status: 'ended' as const },
  ];
  const pending = {
    recurrence_id: 2,
    name: rule.name,
    type: 2,
    state: 'unconfirmed',
  } as RecurrenceOccurrenceDto;
  assert.deepEqual(
    filterRules(rules, 'annual', 'pending', [pending]).map((row) => row.id),
    [2],
  );
  assert.deepEqual(filterRules(rules, '', 'pending', []), []);
  assert.equal(filterRules(rules, 'ANNUAL', 'all', []).length, 3);
  assert.deepEqual(filterRules(rules, '', 'income', []), []);
  assert.equal(monthlyEquivalent(rule), 10000);
});
