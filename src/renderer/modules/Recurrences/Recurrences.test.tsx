import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { OccurrenceSummary, RecurrenceEditor } from './index';
import DefaultFields from './DefaultFields';
import { setLocale } from '@lib/i18n';
import type { RecurrenceOccurrenceDto } from '@shared/contracts/recurrence';

const occurrence: RecurrenceOccurrenceDto = {
  kind: 'projection',
  recurrence_id: 1,
  scheduled_date: '2026-05-12',
  version_id: 1,
  state: 'confirmed',
  transaction_id: 1,
  actual_reference_date: '2026-06-01',
  cash_flow_date: '2026-06-01',
  credit_card_invoice_id: null,
  coverage: 'not_required',
  issue: null,
  name: 'Rent',
  type: 2,
  amount_cents: 150000,
  category_id: 1,
  payment_id: 1,
  credit_card_id: null,
};
test('scheduled and actual transaction dates remain separately visible in both locales', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(
        <OccurrenceSummary occurrence={occurrence} />,
      );
      assert.match(html, /dateTime="2026-05-12"/);
      assert.match(
        html,
        locale === 'en-US'
          ? /Transaction reference date: 6\/1\/2026/
          : /Data de referência da transação: 01\/06\/2026/,
      );
      assert.match(html, /Rent/);
      assert.match(html, /R\$/);
    }
  } finally {
    setLocale('pt-BR');
  }
});
test('unknown invoice coverage is explicit while projected amounts stay legible', () => {
  setLocale('en-US');
  try {
    const html = renderToStaticMarkup(
      <OccurrenceSummary
        occurrence={{
          ...occurrence,
          state: 'unconfirmed',
          coverage: 'unknown',
        }}
      />,
    );
    assert.match(html, /Unconfirmed/);
    assert.match(html, /Monthly amounts are unavailable until reconciled/);
    assert.doesNotMatch(html, /opacity-/);
  } finally {
    setLocale('pt-BR');
  }
});
test('rule creation renders inline as a labeled form and keeps independent typing enabled', () => {
  setLocale('en-US');
  try {
    const html = renderToStaticMarkup(
      <RecurrenceEditor
        editor={{ action: 'create' }}
        cards={[]}
        busy={false}
        returnFocus={null}
        onClose={() => {}}
        onSave={async () => {}}
      />,
    );
    assert.match(html, /Create recurrence/);
    assert.match(html, /<form/);
    assert.match(html, /First occurrence date/);
    assert.match(html, /type="date"/);
    assert.doesNotMatch(html, /role="dialog"/);
    assert.doesNotMatch(html, /inert=""/);
  } finally {
    setLocale('pt-BR');
  }
});

test('fixed transaction type displays its localized name rather than its numeric identifier', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(
        <DefaultFields
          value={occurrence}
          onChange={() => {}}
          cards={[]}
          fixedType
        />,
      );
      assert.match(
        html,
        locale === 'en-US' ? />Expense<\/span>/ : />Despesa<\/span>/,
      );
      assert.doesNotMatch(html, />2<\/span>/);
    }
  } finally {
    setLocale('pt-BR');
  }
});
