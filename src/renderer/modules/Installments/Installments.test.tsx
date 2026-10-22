import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLocale, t } from '@lib/i18n';
import type { InstallmentPlanDto } from '@shared/contracts/installment';
import PlanPreview, { PlanSchedule } from './PlanPreview';
import { Choice, FirstInvoiceField } from './PlanDialog';
import TimelineEntryRow from '../TimelineTransaction/TimelineEntryRow';
import { installmentInvoiceSelection } from '../Recurrences/invoice-selection';

const plan: InstallmentPlanDto = {
  id: 1,
  name: 'Purchase',
  note: null,
  total_amount_cents: 10000,
  total_installments: 3,
  purchase_at: '2027-01-15',
  start_date: '2027-01-31',
  end_date: '2027-03-31',
  repair_required: false,
  entries: [
    {
      id: 1,
      installment_number: 1,
      reference_date: '2027-01-31',
      amount_cents: 3334,
      payment_date: null,
      invoice: null,
    },
    {
      id: 2,
      installment_number: 2,
      reference_date: '2027-02-28',
      amount_cents: 3333,
      payment_date: null,
      invoice: {
        id: 5,
        credit_card_id: 1,
        opening_date: '2027-02-01',
        closing_date: '2027-02-20',
        includes_closing_day: true,
        due_date: '2027-03-01',
        paid_at: '2027-03-02',
        total_source: 'statement',
        amount_cents: 8000,
        items_total_cents: 3333,
        difference_cents: 4667,
      },
    },
  ],
};

test('first invoice selection shows localized due dates and retains a deferred choice', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const choices = [
        { month: '2026-08', dueDate: '2026-09-07' },
        { month: '2026-09', dueDate: '2026-10-07' },
        { month: '2026-10', dueDate: '2026-11-07' },
      ];
      for (const [index, key] of [
        'installments.current_invoice',
        'installments.next_invoice',
        'installments.two_invoices_later',
      ].entries()) {
        const html = renderToStaticMarkup(
          <FirstInvoiceField
            choices={choices}
            selectedMonth={index === 0 ? null : choices[index].month}
            onChange={() => {}}
          />,
        );
        const date = new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'long',
        }).format(new Date(`${choices[index].dueDate}T12:00:00`));
        assert.ok(html.includes(t(key as Parameters<typeof t>[0], { date })));
        assert.doesNotMatch(html, /type="month"/);
      }
      const loading = renderToStaticMarkup(
        <FirstInvoiceField
          choices={[]}
          selectedMonth={null}
          onChange={() => {}}
        />,
      );
      assert.ok(loading.includes(t('installments.select_first_invoice')));
    }
  } finally {
    setLocale('pt-BR');
  }
});

test('recurrence invoice months outside the normal choices remain visible without changing the inherited instruction', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const inherited = installmentInvoiceSelection('2026-12', null);
      const choices = [
        { month: '2026-08', dueDate: '2026-09-07' },
        { month: '2026-09', dueDate: '2026-10-07' },
        { month: '2026-10', dueDate: '2026-11-07' },
      ];
      for (const available of [choices, []]) {
        const html = renderToStaticMarkup(
          <FirstInvoiceField
            choices={available}
            selectedMonth={inherited.first_invoice_month}
            onChange={() =>
              assert.fail('Rendering must preserve the inherited choice')
            }
          />,
        );
        const month = new Intl.DateTimeFormat(locale, {
          month: 'long',
          year: 'numeric',
        }).format(new Date(2026, 11, 1));
        assert.ok(
          html.includes(t('installments.retained_first_invoice', { month })),
        );
        assert.ok(html.includes(t('installments.change_first_invoice')));
        assert.ok(!html.includes(t('installments.select_first_invoice')));
        assert.equal(inherited.first_invoice_month, '2026-12');
      }
    }
  } finally {
    setLocale('pt-BR');
  }
});

test('installment rows distinguish scheduled reference dates, actual payment evidence and invoice dates in both locales', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(<PlanSchedule plan={plan} />);
      assert.match(html, /dateTime="2027-01-31"/);
      assert.match(html, /dateTime="2027-02-28"/);
      assert.match(html, /1\/3/);
      assert.match(html, /2\/3/);
      assert.match(html, locale === 'en-US' ? /33\.34/ : /33,34/);
      assert.match(
        html,
        locale === 'en-US'
          ? /Payment not recorded/
          : /Pagamento não registrado/,
      );
      assert.match(html, locale === 'en-US' ? /Paid/ : /Paga/);
      assert.match(html, locale === 'en-US' ? /3\/1\/2027/ : /01\/03\/2027/);
      assert.match(
        html,
        locale === 'en-US'
          ? /Reference date outside invoice period/
          : /Referência fora do período da fatura/,
      );
    }
  } finally {
    setLocale('pt-BR');
  }
});

test('timeline installments identify their group position and disable individual changes while preserving copy', () => {
  setLocale('en-US');
  try {
    const html = renderToStaticMarkup(
      <TimelineEntryRow
        entry={{
          id: 1,
          name: 'Purchase',
          note: null,
          amount_cents: 3334,
          type: 2,
          reference_date: '2027-01-31',
          payment_date: null,
          payment_id: 3,
          category: null,
          installment_id: 1,
          installment_number: 1,
          total_installments: 3,
        }}
        onEdit={async () => {}}
        onCopy={async () => {}}
        onRemove={async () => {}}
        disabled={false}
      />,
    );
    assert.match(html, /1\/3/);
    assert.equal((html.match(/ disabled=""/g) ?? []).length, 2);
    assert.match(html, /Manage this purchase in Installments/);
    const copy = html.match(/<button[^>]*aria-label="Copy[^>]*>/)?.[0];
    assert.ok(copy);
    assert.doesNotMatch(copy, / disabled=""/);
  } finally {
    setLocale('pt-BR');
  }
});

test('unselected payment and card choices render localized placeholders while automatic invoice options retain their labels', () => {
  try {
    for (const locale of ['en-US', 'pt-BR'] as const) {
      setLocale(locale);
      const payment = renderToStaticMarkup(
        <Choice
          label={t('transactions.payment')}
          placeholder={t('transactions.select_payment')}
          value={0}
          items={[{ value: 3, label: 'PIX' }]}
          onChange={() => {}}
        />,
      );
      const card = renderToStaticMarkup(
        <Choice
          label={t('cards.card')}
          placeholder={t('cards.select_card')}
          value={null}
          items={[{ value: 1, label: 'My card' }]}
          onChange={() => {}}
        />,
      );
      assert.ok(payment.includes(t('transactions.select_payment')));
      assert.ok(card.includes(t('cards.select_card')));
      assert.doesNotMatch(payment + card, /<span[^>]*>0<\/span>/);
      const invoice = renderToStaticMarkup(
        <Choice
          label="Invoice"
          value={null}
          items={[{ value: 0, label: t('installments.automatic') }]}
          onChange={() => {}}
        />,
      );
      assert.ok(invoice.includes(t('installments.automatic')));
    }
  } finally {
    setLocale('pt-BR');
  }
});

test('creation preview exposes amount editing and locks without rendering before and after invoice panels', () => {
  setLocale('en-US');
  try {
    const html = renderToStaticMarkup(
      <PlanPreview
        preview={{
          plan,
          correction: {
            token: 'preview',
            affected_payment_months: ['2027-03'],
            changes: [
              {
                entity: 'invoice',
                id: 5,
                before: { amount_cents: 8000 },
                after: { amount_cents: 11000 },
              },
            ],
          },
        }}
        amountEditor={{
          locked: [true, false],
          disabled: false,
          onAmountChange: () => {},
          onLockChange: () => {},
        }}
      />,
    );
    assert.match(html, /Lock amount/);
    assert.match(html, /aria-checked="true"/);
    assert.equal((html.match(/inputMode="decimal"/g) ?? []).length, 2);
    assert.doesNotMatch(html, />Before<|>After</);
    assert.match(html, /2027-03/);
  } finally {
    setLocale('pt-BR');
  }
});
