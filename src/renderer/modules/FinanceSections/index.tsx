import { useFinancialOperations } from '@store/financial-operations';
import { useState } from 'react';
import Installments from '@modules/Installments';
import { CreditCard, Target, Wallet } from 'lucide-react';
import CreditCards from '@modules/CreditCards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import UnderConstruction from '@components/UnderConstruction';
import MonthlyTimeline from '@modules/TimelineTransaction/MonthlyTimeline';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';

const deferredSections = [
  { id: 'weekly', label: 'sections.weekly', icon: Target },
] as const;

export default function FinanceSections({
  onReviewRecurrences,
}: {
  onReviewRecurrences?: () => void;
}) {
  const [section, setSection] = useState('timelines');
  const [createPlan, setCreatePlan] = useState(false);
  const blocked = useFinancialOperations((state) => state.pending.size > 0);
  const transactionCount = useAppStore(
    (state) =>
      state.transactions.length +
      state.invoicePayments.length +
      (state.recurrenceMonth?.occurrences.filter(
        (entry) => entry.state === 'unconfirmed',
      ).length ?? 0),
  );

  return (
    <div className="min-w-0">
      <Tabs
        value={section}
        onValueChange={(value) => {
          if (!blocked) {
            setSection(String(value));
          }
        }}
      >
        <div className="bg-card">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <fieldset
              disabled={blocked}
              inert={blocked}
              aria-busy={blocked}
              className="min-w-0 w-full overflow-x-auto"
            >
              <TabsList aria-label={t('sections.label')} activateOnFocus>
                <TabsTrigger value="timelines">
                  <Wallet aria-hidden="true" />
                  {t('sections.timeline')}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {transactionCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="cards">
                  <CreditCard aria-hidden="true" />
                  {t('cards.title')}
                </TabsTrigger>
                <TabsTrigger value="installments">
                  <CreditCard aria-hidden="true" />
                  {t('sections.installments')}
                </TabsTrigger>
                {/* {deferredSections.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id}>
                  <Icon aria-hidden="true" />
                  {t(label)}
                </TabsTrigger>
              ))} */}
              </TabsList>
            </fieldset>
          </div>
        </div>
        <TabsContent value="timelines">
          <MonthlyTimeline
            onCreateInstallment={() => {
              if (!useFinancialOperations.getState().pending.size) {
                setCreatePlan(true);
                setSection('installments');
              }
            }}
            onReviewRecurrences={() => {
              if (!useFinancialOperations.getState().pending.size) {
                onReviewRecurrences?.();
              }
            }}
          />
        </TabsContent>
        <TabsContent value="cards">
          <CreditCards />
        </TabsContent>
        <TabsContent value="installments">
          <Installments
            initialCreate={createPlan}
            onCreateClosed={() => setCreatePlan(false)}
          />
        </TabsContent>
        {deferredSections.map(({ id, label }) => (
          <TabsContent key={id} value={id}>
            <UnderConstruction title={t(label)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
