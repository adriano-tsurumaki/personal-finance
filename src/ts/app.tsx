import { useLocale } from '@lib/i18n';
import { useEffect } from 'react';
import { useAppStore } from '@store/transaction';
import MonthlyFinance from '@modules/MonthlyFinance';
import FinanceSections from '@modules/FinanceSections';
import { Toaster } from '@components/ui/toast';
import ConfirmationDialogHost from '@components/ConfirmationDialog/ConfirmationDialogHost';

function App(): React.JSX.Element {
  useLocale();
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Toaster>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <MonthlyFinance />
        <FinanceSections />
        <ConfirmationDialogHost />
      </main>
    </Toaster>
  );
}

export default App;
