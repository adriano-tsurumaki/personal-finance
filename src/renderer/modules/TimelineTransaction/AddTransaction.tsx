import { Button } from '@components/ui/button';
import { Plus } from 'lucide-react';
import { t } from '@lib/i18n';
import { dialogTransactionStore } from '@store/dialog-transaction';
import { useAppStore } from '@store/transaction';

export default function AddTransaction() {
  const monthKey = useAppStore((s) => s.monthKey);

  return (
    <Button
      onClick={() =>
        dialogTransactionStore.getState().openDialogTransaction({
          reference_date: `${monthKey}-01`,
        })
      }
    >
      <Plus aria-hidden="true" />
      {t('transactions.add')}
    </Button>
  );
}
