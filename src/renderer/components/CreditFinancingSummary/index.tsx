import type { CreditFinancingAmounts } from '@shared/contracts/credit-financing';
import { formatCurrency } from '@lib/format/currency';
import { t } from '@lib/i18n';

export default function CreditFinancingSummary({
  amounts,
}: {
  amounts?: CreditFinancingAmounts | null;
}) {
  if (!amounts) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {t('financing.breakdown', {
        principal: formatCurrency(amounts.principal_cents / 100),
        interest: formatCurrency(amounts.interest_cents / 100),
        iof: formatCurrency(amounts.iof_cents / 100),
      })}
    </p>
  );
}
