import { useFinancialOperations } from '@store/financial-operations';
import { useState } from 'react';
import Recurrences from '@modules/Recurrences';
import Installments from '@modules/Installments';
import { CreditCard, Repeat, Tags, Target, Wallet } from 'lucide-react';
import Categories from '@modules/Categories';
import CreditCards from '@modules/CreditCards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import UnderConstruction from '@components/UnderConstruction';
import TimelineTransaction from '@modules/TimelineTransaction';
import { useAppStore } from '@store/transaction';
import { t } from '@lib/i18n';

const deferredSections = [
  { id: 'weekly', label: 'sections.weekly', icon: Target },
] as const;

export default function FinanceSections() {
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
                <TabsTrigger value="categories">
                  <Tags aria-hidden="true" />
                  {t('category_manager.title')}
                </TabsTrigger>
                <TabsTrigger value="cards">
                  <CreditCard aria-hidden="true" />
                  {t('cards.title')}
                </TabsTrigger>
                <TabsTrigger value="recurring">
                  <Repeat aria-hidden="true" />
                  {t('sections.recurring')}
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
          <TimelineTransaction
            onCreateInstallment={() => {
              if (!useFinancialOperations.getState().pending.size) {
                setCreatePlan(true);
                setSection('installments');
              }
            }}
            onReviewRecurrences={() => {
              if (!useFinancialOperations.getState().pending.size) {
                setSection('recurring');
              }
            }}
          />
        </TabsContent>
        <TabsContent value="categories">
          <Categories />
        </TabsContent>
        <TabsContent value="cards">
          <CreditCards />
        </TabsContent>
        <TabsContent value="recurring">
          <Recurrences />
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
