import { Button } from '@components/ui/button';
import { useFinancialOperations } from '@store/financial-operations';
import { Plus } from 'lucide-react';
import { t } from '@lib/i18n';
import { dialogTransactionStore } from '@store/dialog-transaction';
import { useAppStore } from '@store/transaction';

export default function AddTransaction() {
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const monthKey = useAppStore((s) => s.monthKey);

  return (
    <Button
      disabled={blocked}
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
