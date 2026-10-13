import { createStore, useStore } from 'zustand';
import type { Api } from '@shared/contracts/api';
import type {
  CreditCardDto,
  InvoiceDetailsDto,
  InvoiceDto,
  UnlinkedCreditEntryDto,
} from '@shared/contracts/credit-cards';
import { currentMonthKey } from '@shared/lib/calc';

interface CardState {
  cards: CreditCardDto[];
  invoices: InvoiceDto[];
  details: InvoiceDetailsDto | null;
  unlinked: UnlinkedCreditEntryDto[];
  cardId: number | null;
  invoiceId: number | null;
  periodMonth: string;
  loading: boolean;
  failed: boolean;
  reset: () => void;
  selectCard: (id: number | null) => Promise<void>;
  selectInvoice: (id: number | null) => Promise<void>;
  setPeriodMonth: (month: string) => void;
  refresh: () => Promise<void>;
}

/** Profile-owned navigation; request generations reject stale selection/session responses. */
export function createCreditCardStore(
  api: () => Pick<
    Api,
    | 'getCreditCards'
    | 'getCardInvoices'
    | 'getInvoiceDetails'
    | 'getUnlinkedCreditEntries'
  > = () => window.api,
) {
  let generation = 0;
  const empty = () => ({
    cards: [],
    invoices: [],
    details: null,
    unlinked: [],
    cardId: null,
    invoiceId: null,
    periodMonth: currentMonthKey(),
    loading: false,
    failed: false,
  });
  return createStore<CardState>((set, get) => ({
    ...empty(),
    reset: () => {
      generation++;
      set(empty());
    },
    selectCard: async (cardId) => {
      generation++;
      set({ cardId, invoiceId: null, invoices: [], details: null });
      await get().refresh();
    },
    selectInvoice: async (invoiceId) => {
      generation++;
      set({ invoiceId, details: null });
      await get().refresh();
    },
    setPeriodMonth: (periodMonth) => {
      generation++;
      const selected =
        get().invoices.find(
          (row) =>
            row.id === get().invoiceId &&
            row.closing_date.slice(0, 7) === periodMonth,
        ) ??
        get().invoices.find(
          (row) => row.closing_date.slice(0, 7) === periodMonth,
        );
      set({ periodMonth, invoiceId: selected?.id ?? null, details: null });
      void get().refresh();
    },
    refresh: async () => {
      const request = ++generation;
      const { cardId, invoiceId } = get();
      set({ loading: true, failed: false });
      try {
        const [cards, unlinked, invoices, details] = await Promise.all([
          api().getCreditCards(),
          api().getUnlinkedCreditEntries(),
          cardId === null ? [] : api().getCardInvoices(cardId),
          invoiceId === null ? null : api().getInvoiceDetails(invoiceId),
        ]);

        if (request === generation) {
          set({
            cards,
            unlinked,
            invoices,
            details,
            loading: false,
            periodMonth:
              details?.invoice.closing_date.slice(0, 7) ?? get().periodMonth,
          });
        }
      } catch {
        if (request === generation) {
          set({ failed: true, loading: false });
        }
      }
    },
  }));
}

export const creditCardStore = createCreditCardStore();
export function useCreditCardStore<T>(selector: (state: CardState) => T): T {
  return useStore(creditCardStore, selector);
}
