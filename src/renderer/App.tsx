import { useEffect } from 'react';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { useLocale } from '@lib/i18n';
import Profiles from '@modules/Profiles';
import MonthlyFinance from '@modules/MonthlyFinance';
import FinanceSections from '@modules/FinanceSections';
import { Toaster } from '@components/ui/toast';
import ConfirmationDialogHost from '@components/ConfirmationDialog/ConfirmationDialogHost';
import TransactionDialog from '@modules/TimelineTransaction/TransactionDialog';
import AppSidebar from '@components/AppSidebar';
import { TooltipProvider } from '@components/ui/tooltip';

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
      <TransactionDialog mode="add" />
      <TransactionDialog mode="edit" />
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
    <TooltipProvider>
      <Toaster key={profile?.id ?? 'profiles'}>
        <div className="flex min-h-0 flex-1">
          {profile && <AppSidebar key={profile.id} />}
          <main className="min-w-0 flex-1 overflow-y-auto">
            {profile ? <FinanceHome key={profile.id} /> : <Profiles />}
          </main>
        </div>
      </Toaster>
    </TooltipProvider>
  );
}
