/** Balance in signed integer cents immediately before the inclusive start date. */
export interface IndicatorAnchorDto {
  start_date: string;
  opening_balance_cents: number;
}

export interface IndicatorAnchorApi {
  get(): Promise<IndicatorAnchorDto | null>;
  save(input: IndicatorAnchorDto): Promise<IndicatorAnchorDto>;
  remove(): Promise<void>;
}
