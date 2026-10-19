import type { CardCorrectionPreview, InvoiceDto } from './credit-cards';

export interface InstallmentInput {
  request_id: string;
  name: string;
  note: string | null;
  total_amount_cents: number;
  total_installments: number;
  purchase_at: string;
  start_date: string;
  payment_id: number;
  category_id: number | null;
  card_id: number | null;
  historical_card: boolean;
  /** Optional explicit invoice per position; null selects the suggested period. */
  invoice_ids: (number | null)[];
  /** Optional explicit positive integer cents for every position; must sum to the total. */
  installment_amounts_cents?: number[];
  /** Keeps the first reference date; later card entries use their invoice opening date. */
  use_invoice_opening_date?: boolean;
}

export interface InstallmentEntryDto {
  id: number;
  installment_number: number;
  reference_date: string;
  amount_cents: number;
  payment_date: string | null;
  invoice: InvoiceDto | null;
}

export interface InstallmentPlanDto {
  id: number;
  name: string;
  note: string | null;
  total_amount_cents: number;
  total_installments: number;
  purchase_at: string;
  start_date: string;
  end_date: string;
  repair_required: boolean;
  entries: InstallmentEntryDto[];
}

export interface InstallmentPreviewDto {
  plan: InstallmentPlanDto;
  correction: CardCorrectionPreview;
}

export interface InstallmentApi {
  list(): Promise<InstallmentPlanDto[]>;
  preview(input: InstallmentInput): Promise<InstallmentPreviewDto>;
  create(input: InstallmentInput, token: string): Promise<number>;
  rename(id: number, name: string, note: string | null): Promise<void>;
  previewRemove(id: number): Promise<InstallmentPreviewDto>;
  remove(id: number, token: string): Promise<void>;
}
