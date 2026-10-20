import type { Format } from '@number-flow/react';

export interface OdometerMoneyProps {
  value: number;
  /** Whether to display the value as an absolute amount */
  absolute?: boolean;
  format?: Format;
}
