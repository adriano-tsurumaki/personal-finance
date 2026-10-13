import { Button } from '@components/ui/button';
import { Plus } from 'lucide-react';
import { t } from '@lib/i18n';
import { dialogTransactionStore } from '@store/dialog-transaction';

export default function AddTransaction() {
  return (
    <Button
      onClick={() => dialogTransactionStore.getState().openDialogTransaction()}
    >
      <Plus aria-hidden="true" />
      {t('transactions.add')}
    </Button>
  );
}
