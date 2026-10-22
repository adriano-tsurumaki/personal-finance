import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale, t } from '@lib/i18n';
import Entries from './Entries';

test('invoice table renders its localized selection count and compact custom column widths', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(
        <Entries
          rows={[
            {
              id: 5,
              name: 'Purchase',
              note: null,
              reference_date: '2026-08-17',
              amount_cents: 10000,
              installment_number: null,
            },
          ]}
          returnFocus={{ current: null }}
          setAssociation={() => {}}
        />,
      );
      assert.ok(html.includes(t('cards.selected_entries', { count: 0 })));
      assert.match(html, /role="grid"/);
      assert.match(html, /120px minmax\(200px, 1fr\) 140px 112px/);
    }
  } finally {
    setLocale('pt-BR');
  }
});
