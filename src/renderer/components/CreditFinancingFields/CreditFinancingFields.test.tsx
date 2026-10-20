import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale, t } from '@lib/i18n';
import CreditFinancingFields from './index';
import TimelineEntryRow from '@modules/TimelineTransaction/TimelineEntryRow';
import { financingAmounts } from '@shared/lib/credit-financing';
import type { CreditFinancingInput } from '@shared/contracts/credit-financing';

test('charge controls show total-rate semantics and the complete charge total in both locales', () => {
  const input: CreditFinancingInput = {
    principal_cents: 10000,
    interest: { mode: 'percent', value: 2 },
    iof: { mode: 'amount', value: 50 },
  };
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(
        <CreditFinancingFields value={input} onChange={() => {}} />,
      );
      assert.match(html, /step="0.01"/);
      assert.match(html, /min="0"/);
      assert.match(html, locale === 'en-US' ? /102\.50/ : /102,50/);
      assert.ok(html.includes(t('financing.rate_hint')));
      assert.doesNotMatch(html, /role="alert"/);
      const invalid = renderToStaticMarkup(
        <CreditFinancingFields
          value={{ ...input, interest: { mode: 'percent', value: -1 } }}
          onChange={() => {}}
        />,
      );
      assert.match(invalid, /role="alert"/);
      assert.ok(invalid.includes(t('financing.invalid')));
      const row = renderToStaticMarkup(
        <TimelineEntryRow
          entry={{
            id: 1,
            name: 'Rent',
            note: null,
            amount_cents: 10250,
            payment_method: 'boleto_credit',
            financing: financingAmounts(input),
            payment_id: 1,
            type: 2,
            reference_date: '2026-10-05',
            payment_date: null,
            category: null,
          }}
          onEdit={async () => {}}
          onCopy={async () => {}}
          onRemove={async () => {}}
          disabled={false}
        />,
      );
      assert.ok(row.includes(t('payments.boleto_credit')));
      assert.match(row, /IOF/);
      assert.match(row, locale === 'en-US' ? /Interest/ : /Juros/);
    }
  } finally {
    setLocale('pt-BR');
  }
});
