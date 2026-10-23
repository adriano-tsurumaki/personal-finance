import { useEffect, useState } from 'react';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { useLocale } from '@lib/i18n';
import Profiles from '@modules/Profiles';
import MonthlyFinance from '@modules/MonthlyFinance';
import FinanceSections from '@modules/FinanceSections';
import Categories from '@modules/Categories';
import { Toaster } from '@components/ui/toast';
import ConfirmationDialogHost from '@components/ConfirmationDialog/ConfirmationDialogHost';
import TransactionDialog from '@modules/TimelineTransaction/TransactionDialog';
import AppSidebar, { type AppDestination } from '@components/AppSidebar';
import { financialActionsBlocked } from '@store/financial-operations';
import { TooltipProvider } from '@components/ui/tooltip';

function FinanceHome() {
  const init = useAppStore((state) => state.init);
  const [destination, setDestination] = useState<AppDestination>('timeline');

  useEffect(() => {
    void init();
    return () => useAppStore.getState().reset();
  }, [init]);

  return (
    <>
      <AppSidebar
        destination={destination}
        onNavigate={(next) => {
          if (!financialActionsBlocked()) {
            setDestination(next);
          }
        }}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {destination === 'categories' ? (
          <Categories />
        ) : (
          <>
            <MonthlyFinance />
            <FinanceSections />
          </>
        )}
      </main>
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
          {profile ? (
            <FinanceHome key={profile.id} />
          ) : (
            <main className="min-w-0 flex-1 overflow-y-auto">
              <Profiles />
            </main>
          )}
        </div>
      </Toaster>
    </TooltipProvider>
  );
}
