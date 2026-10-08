import { useEffect } from 'react';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { useLocale } from '@lib/i18n';
import Profiles from '@modules/Profiles';
import MonthlyFinance from '@modules/MonthlyFinance';
import FinanceSections from '@modules/FinanceSections';
import { Toaster } from '@components/ui/toast';
import ConfirmationDialogHost from '@components/ConfirmationDialog/ConfirmationDialogHost';

function FinanceHome() {
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    void init();
    return () => useAppStore.getState().reset();
  }, [init]);

  return (
    <>
      <MonthlyFinance />
      <FinanceSections />
      <ConfirmationDialogHost />
    </>
  );
}

export default function App(): React.JSX.Element {
  const profile = useProfileStore((state) => state.activeProfile);
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <Toaster>
      <main className="flex-1 min-h-0 overflow-y-auto">
        {profile ? <FinanceHome key={profile.id} /> : <Profiles />}
      </main>
    </Toaster>
  );
}
