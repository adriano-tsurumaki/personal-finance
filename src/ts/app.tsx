import { useEffect } from 'react';
import { useAppStore } from '@store/transaction';
import MonthlyFinance from '@modules/MonthlyFinance';

function App(): React.JSX.Element {
  const init = useAppStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <MonthlyFinance />
    </main>
  );
}

export default App;
