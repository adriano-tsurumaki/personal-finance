import { addMonths, format, parseISO } from 'date-fns';
import type {
  InvoiceDto,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';

export interface FirstInvoiceChoice {
  month: string;
  dueDate: string;
}

/** Uses persisted due dates when present and previews missing periods without writes. */
export async function loadFirstInvoiceChoices(
  api: {
    suggestInvoicePeriod(
      cardId: number,
      date: string,
    ): Promise<InvoicePeriodDto>;
    previewInvoicePeriod(
      cardId: number,
      month: string,
    ): Promise<InvoicePeriodDto>;
  },
  cardId: number,
  purchaseDate: string,
  invoices: InvoiceDto[],
): Promise<FirstInvoiceChoice[]> {
  const current = await api.suggestInvoicePeriod(cardId, purchaseDate);
  return Promise.all(
    [0, 1, 2].map(async (offset) => {
      const month = format(
        addMonths(parseISO(`${current.closing_date.slice(0, 7)}-01`), offset),
        'yyyy-MM',
      );
      const matches = invoices.filter(
        (row) => row.closing_date.slice(0, 7) === month,
      );

      if (matches.length > 1) {
        throw new Error('ambiguous_invoice');
      }

      const period =
        matches[0] ??
        (offset === 0
          ? current
          : await api.previewInvoicePeriod(cardId, month));
      return { month, dueDate: period.due_date };
    }),
  );
}
