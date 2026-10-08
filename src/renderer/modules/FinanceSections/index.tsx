import { CreditCard, Repeat, Target, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import UnderConstruction from '@components/UnderConstruction';
import TimelineTransaction from '@modules/TimelineTransaction';
import { useAppStore } from '@store/transaction';

const deferredSections = [
  { id: 'installments', label: 'Installments', icon: CreditCard },
  { id: 'weekly', label: 'Weekly Goals', icon: Target },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
];

export default function FinanceSections() {
  const transactionCount = useAppStore((state) => state.transactions.length);

  return (
    <Tabs defaultValue="timelines">
      <div className="bg-card">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="overflow-x-auto">
            <TabsList aria-label="Monthly finance sections" activateOnFocus>
              <TabsTrigger value="timelines">
                <Wallet aria-hidden="true" />
                Timelines
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {transactionCount}
                </span>
              </TabsTrigger>
              {deferredSections.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </div>
      <TabsContent value="timelines">
        <TimelineTransaction />
      </TabsContent>
      {deferredSections.map(({ id, label }) => (
        <TabsContent key={id} value={id}>
          <UnderConstruction title={label} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
