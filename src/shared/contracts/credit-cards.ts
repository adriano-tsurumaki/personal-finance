export interface CreditCardInput {
  name: string;
  closing_day: number;
  includes_closing_day: boolean;
  due_days_after_closing: number;
}

export interface CreditCardDto {
  id: number;
  name: string;
  closing_day: number | null;
  includes_closing_day: boolean | null;
  due_days_after_closing: number | null;
  archived_at: string | null;
}

export interface InvoicePeriodDto {
  opening_date: string;
  closing_date: string;
  due_date: string;
  includes_closing_day: boolean;
}

export interface InvoiceInput extends InvoicePeriodDto {
  total_source: 'calculated' | 'statement';
  /** Integer cents; used only for statement totals. */
  amount_cents: number;
}

export interface InvoiceEntryDto {
  outside_period?: boolean;
  id: number;
  name: string;
  note: string | null;
  reference_date: string | null;
  amount_cents: number;
  installment_number: number | null;
}

export interface InvoiceDto {
  id: number;
  credit_card_id: number;
  opening_date: string | null;
  closing_date: string;
  due_date: string;
  includes_closing_day: boolean | null;
  total_source: 'calculated' | 'statement';
  /** All monetary fields are integer cents. */
  amount_cents: number;
  items_total_cents: number;
  difference_cents: number;
  paid_at: string | null;
}

export interface CardHistoryDto {
  id: number;
  operation: string;
  created_at: string;
  changes: CardHistoryChange[];
}

export interface CardHistoryChange {
  entity: 'card' | 'invoice' | 'transaction';
  id: number;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface InvoiceDetailsDto {
  invoice: InvoiceDto;
  entries: InvoiceEntryDto[];
  history: CardHistoryDto[];
}

export interface CardCorrectionPreview {
  token: string;
  changes: CardHistoryChange[];
  /** Actual payment months whose summaries can change. */
  affected_payment_months: string[];
}

export interface InvoiceAssociationInput {
  card_id: number;
  invoice_id: number | null;
}

export type UnlinkedCreditEntryDto = InvoiceEntryDto;
