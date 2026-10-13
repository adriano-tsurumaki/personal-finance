import { createElement } from 'react';
import type { CardCorrectionPreview } from '@shared/contracts/credit-cards';
import CardChanges from '@components/CardChanges';
import { confirmation } from '@store/confirmation';
import { t } from './i18n';
export { cardDate } from './card-history';

export async function confirmCardCorrection(
  plan: CardCorrectionPreview,
): Promise<boolean> {
  return confirmation.confirm({
    title: t('cards.review_changes'),
    description: t('cards.review_hint'),
    content: createElement(CardChanges, {
      changes: plan.changes,
      affectedMonths: plan.affected_payment_months,
    }),
    confirmLabel: t('cards.apply_changes'),
  });
}
