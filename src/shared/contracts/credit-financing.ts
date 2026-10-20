/** Charges apply once to the original principal, not monthly or compounded. */
export interface FinancingCharge {
  mode: 'amount' | 'percent';
  /** Integer BRL cents in amount mode; percent with up to two decimals otherwise. */
  value: number;
}

export interface CreditFinancingInput {
  principal_cents: number;
  interest: FinancingCharge;
  iof: FinancingCharge;
}

export interface CreditFinancingAmounts {
  principal_cents: number;
  interest_cents: number;
  iof_cents: number;
  total_cents: number;
}
