import type { CreditFinancingInput } from './credit-financing';
import type { InstallmentInput } from './installment';
export type RecurrenceFrequency = 1 | 2 | 3 | 4;
export type RecurrenceStatus =
  'active' | 'paused' | 'ended' | 'repair_required';
/** Dates are Gregorian YYYY-MM-DD; all amounts are safe integer BRL cents. */
export interface RecurrenceSchedule {
  anchor_date: string;
  frequency: RecurrenceFrequency;
  interval: number;
}
export interface RecurrenceDefaults {
  name: string;
  type: 1 | 2;
  amount_cents: number;
  category_id: number | null;
  payment_id: number;
  credit_card_id: number | null;
}
export interface RecurrenceCreateInput extends RecurrenceDefaults {
  start_date: string;
  frequency: RecurrenceFrequency;
  interval: number;
}
export interface RecurrenceUpdateInput extends RecurrenceDefaults {
  recurrence_id: number;
  scheduled_date: string;
  expected_version_id: number;
}
export interface RecurrenceOccurrenceKey {
  recurrence_id: number;
  scheduled_date: string;
}
export interface RecurrenceBoundaryInput {
  recurrence_id: number;
  last_retained_date: string;
}
export interface RecurrenceBoundaryPreviewDto {
  last_retained_date: string;
  first_removed_date: string;
  confirmed_transactions: {
    id: number;
    name: string;
    scheduled_date: string;
    reference_date: string | null;
    amount_cents: number;
  }[];
}
export interface RecurrenceResumeInput {
  recurrence_id: number;
  first_date: string;
}
export interface RecurrenceRuleDto {
  id: number;
  name: string;
  status: RecurrenceStatus;
  anchor_date: string | null;
  last_retained_date: string | null;
  versions: RecurrenceVersionDto[];
}
export interface RecurrenceVersionDto {
  id: number;
  version: number;
  recurrence_id: number;
  name: string;
  type: 1 | 2 | null;
  amount_cents: number;
  category_id: number | null;
  payment_id: number | null;
  credit_card_id: number | null;
  frequency: RecurrenceFrequency;
  interval: number;
  start_date: string;
  end_date: string | null;
  active: number;
}
export interface RecurrenceOccurrenceDto
  extends RecurrenceOccurrenceKey, RecurrenceDefaults {
  kind: 'projection';
  version_id: number;
  state: 'unconfirmed' | 'confirmed' | 'ignored' | 'repair_required';
  transaction_id: number | null;
  actual_reference_date: string | null;
  cash_flow_date: string | null;
  credit_card_invoice_id: number | null;
  coverage: 'not_required' | 'unknown' | 'included' | 'excluded';
  issue: string | null;
}
export interface RecurrenceMonthDto {
  month: string;
  occurrences: RecurrenceOccurrenceDto[];
  paused_rules: RecurrenceRuleDto[];
  unconfirmed_count: number;
}
export interface RecurrenceConfirmInput
  extends RecurrenceOccurrenceKey, RecurrenceDefaults {
  expected_version_id: number;
  financing?: CreditFinancingInput | null;
  installment?: InstallmentInput;
  invoice_month?: string | null;
  reference_date: string;
  credit_card_invoice_id?: number | null;
  correction_token?: string;
}
export interface RecurrenceCoverageInput extends RecurrenceOccurrenceKey {
  credit_card_invoice_id: number;
  status: 'included' | 'excluded';
}
export type RecurrenceErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'repair_required'
  | 'internal_error';
export type RecurrenceResult<T = undefined> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: { code: RecurrenceErrorCode; message: string };
    };
export interface RecurrenceApi {
  previewBoundary(
    input: RecurrenceBoundaryInput,
  ): Promise<RecurrenceBoundaryPreviewDto>;
  dismissLegacy(id: number): Promise<RecurrenceResult>;
  list(): Promise<RecurrenceRuleDto[]>;
  month(month: string): Promise<RecurrenceMonthDto>;
  forecast(start: string, end: string): Promise<RecurrenceOccurrenceDto[]>;
  create(input: RecurrenceCreateInput): Promise<RecurrenceResult<number>>;
  update(input: RecurrenceUpdateInput): Promise<RecurrenceResult>;
  boundary(
    input: RecurrenceBoundaryInput & { action: 'pause' | 'end' },
  ): Promise<RecurrenceResult>;
  resume(input: RecurrenceResumeInput): Promise<RecurrenceResult>;
  confirm(input: RecurrenceConfirmInput): Promise<RecurrenceResult<number>>;
  ignore(input: RecurrenceOccurrenceKey): Promise<RecurrenceResult>;
  restore(input: RecurrenceOccurrenceKey): Promise<RecurrenceResult>;
  coverage(input: RecurrenceCoverageInput): Promise<RecurrenceResult>;
}
