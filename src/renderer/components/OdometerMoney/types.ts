export interface OdometerMoneyProps {
  value: number;
  /** Whether to display the value as an absolute amount */
  absolute?: boolean;
  formatValue?: (value: number) => string;
}
