import { useEffect } from 'react';
import { useAppStore } from '@store/transaction';
import MonthlyFinance from '@modules/MonthlyFinance';
import TimelineTransaction from '@modules/TimelineTransaction';
import { Toaster } from '@components/ui/toast';

function App(): React.JSX.Element {
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <MonthlyFinance />
      <TimelineTransaction />
      <Toaster />
    </main>
  );
}

export default App;
