import type { OdometerMoneyProps } from './types';
import { useLocale } from '@lib/i18n';
import NumberFlow from '@number-flow/react';

export default function OdometerMoney({
  value,
  absolute = false,
  format = {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
}: OdometerMoneyProps) {
  const locale = useLocale();

  return (
    <NumberFlow
      value={absolute ? Math.abs(value) : value}
      locales={locale}
      format={format}
    />
  );
}
