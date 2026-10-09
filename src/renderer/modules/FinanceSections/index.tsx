import { CreditCard, Repeat, Tags, Target, Wallet } from 'lucide-react';
import Categories from '@modules/Categories';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import UnderConstruction from '@components/UnderConstruction';
import TimelineTransaction from '@modules/TimelineTransaction';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';

const deferredSections = [
  { id: 'installments', label: 'sections.installments', icon: CreditCard },
  { id: 'weekly', label: 'sections.weekly', icon: Target },
  { id: 'recurring', label: 'sections.recurring', icon: Repeat },
] as const;

export default function FinanceSections() {
  const transactionCount = useAppStore((state) => state.transactions.length);

  return (
    <Tabs defaultValue="timelines">
      <div className="bg-card">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="overflow-x-auto">
            <TabsList aria-label={t('sections.label')} activateOnFocus>
              <TabsTrigger value="timelines">
                <Wallet aria-hidden="true" />
                {t('sections.timeline')}
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {transactionCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="categories">
                <Tags aria-hidden="true" />
                {t('categoryManager.title')}
              </TabsTrigger>
              {deferredSections.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon aria-hidden="true" />
                  {t(label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </div>
      <TabsContent value="timelines">
        <TimelineTransaction />
      </TabsContent>
      <TabsContent value="categories">
        <Categories />
      </TabsContent>
      {deferredSections.map(({ id, label }) => (
        <TabsContent key={id} value={id}>
          <UnderConstruction title={t(label)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
