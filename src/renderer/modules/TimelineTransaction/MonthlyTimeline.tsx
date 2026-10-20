import { useState } from 'react';
import { ChartNoAxesCombined, List } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { t } from '@lib/i18n';
import CashFlow from '@modules/MonthlyFinance/CashFlow';
import TimelineTransaction from './index';

export default function MonthlyTimeline(
  props: Parameters<typeof TimelineTransaction>[0],
) {
  const [view, setView] = useState('entries');
  // Switching between already loaded views is local and needs no financial lock.
  return (
    <Tabs value={view} onValueChange={(value) => setView(String(value))}>
      <div className="mx-auto max-w-3xl px-5 pt-4 sm:px-8">
        <TabsList aria-label={t('monthly_views.label')} activateOnFocus>
          <TabsTrigger value="entries">
            <List aria-hidden="true" />
            {t('monthly_views.entries')}
          </TabsTrigger>
          <TabsTrigger value="cash_flow">
            <ChartNoAxesCombined aria-hidden="true" />
            {t('monthly_views.cash_flow')}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="entries">
        <TimelineTransaction {...props} />
      </TabsContent>
      <TabsContent value="cash_flow">
        <CashFlow />
      </TabsContent>
    </Tabs>
  );
}
