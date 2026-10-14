import { useEffect } from 'react';
import { useToastManager } from '@components/ui/toast';
import { getLocale } from '@lib/i18n';
import { watchMonthlyStatementFeedback } from './monthly-statement-feedback';

export function useMonthlyStatementFeedback(): void {
  const { add, close } = useToastManager();
  const locale = getLocale();

  useEffect(
    () => watchMonthlyStatementFeedback({ add, close }),
    [add, close, locale],
  );
}
