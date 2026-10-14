import { Checkbox } from '@components/ui/checkbox';
import { useEffect, useState } from 'react';
import { Spinner } from '@components/ui/spinner';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import {
  Field,
  FieldDatePicker,
  FieldContent,
  FieldTitle,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldMoney,
  FieldSet,
} from '@components/ui/field';
import { Input } from '@components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from '@components/ui/select';
import { toast } from '@components/ui/toast';
import { Pencil, Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  dialogTransactionStore,
  useDialogTransactionStore,
} from '@store/dialog-transaction';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { categoryLabel, getLocale, t } from '@lib/i18n';
import type { CreateResult } from '@shared/contracts/result';
import { paymentMethodsForType } from '@shared/lib/payment-method';
import { creditCardStore, useCreditCardStore } from '@store/credit-cards';
import { cardDate, confirmCardCorrection } from '@lib/card-corrections';
import CardDialog from '@modules/CreditCards/CardDialog';
import type {
  InvoiceDto,
  InvoicePeriodDto,
} from '@shared/contracts/credit-cards';

export default function TransactionDialog({ mode }: { mode: 'add' | 'edit' }) {
  const profile = useProfileStore((state) => state.activeProfile);
  const options = useProfileStore((state) => state.options);
  const selectedType = useDialogTransactionStore(
    (state) => state.transaction.type,
  );
  const [categoryCleared, setCategoryCleared] = useState(false);
  const cards = useCreditCardStore((state) => state.cards);
  const [cardEditor, setCardEditor] = useState(false);
  const [cardInvoices, setCardInvoices] = useState<InvoiceDto[]>([]);
  const [suggestedPeriod, setSuggestedPeriod] =
    useState<InvoicePeriodDto | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardFailed, setCardFailed] = useState(false);
  const cardId = useDialogTransactionStore(
    (state) => state.transaction.card_id ?? null,
  );

  const invoiceId = useDialogTransactionStore(
    (state) => state.transaction.credit_card_invoice_id ?? null,
  );

  const historical_card = useDialogTransactionStore(
    (state) => state.transaction.historical_card ?? false,
  );

  const categories = [
    { value: null, label: t('transactions.select_category') },
    ...options.categories
      .filter(
        (category) =>
          !selectedType ||
          !category.transaction_type ||
          category.transaction_type === 'both' ||
          category.transaction_type ===
            (selectedType === 1 ? 'income' : 'expense'),
      )
      .map((category) => ({
        value: category.id,
        label: categoryLabel(category),
      })),
  ];

  const payments = [
    { value: null, label: t('transactions.select_payment') },
    ...options.payments
      .filter((payment) =>
        paymentMethodsForType(selectedType).includes(payment.catalog_key),
      )
      .map((payment) => ({
        value: payment.id,
        label: t(`payments.${payment.catalog_key}`),
      })),
  ];

  const {
    openDialogTransaction,
    closeDialogTransaction,
    handleTransaction,
    resetTransaction,
    isOpen,
    isSubmitting,
    startSubmission,
    finishSubmission,
    isCurrentSubmission,
  } = useDialogTransactionStore((state) => ({
    openDialogTransaction: state.openDialogTransaction,
    closeDialogTransaction: state.closeDialogTransaction,
    handleTransaction: state.handleTransaction,
    resetTransaction: state.resetTransaction,
    isOpen:
      state.isDialogTransactionOpen && state.modeDialogTransaction === mode,
    isSubmitting: state.isSubmitting,
    startSubmission: state.startSubmission,
    finishSubmission: state.finishSubmission,
    isCurrentSubmission: state.isCurrentSubmission,
  }));

  const { transactionId, type, amount_cents, category_id, name, note } =
    useDialogTransactionStore((state) => ({
      transactionId: state.transactionId,
      type: state.transaction.type,
      amount_cents: state.transaction.amount_cents,
      category_id: state.transaction.category_id,
      name: state.transaction.name,
      note: state.transaction.note,
    }));

  const { payment_id, reference_date } = useDialogTransactionStore((state) => ({
    payment_id: state.transaction.payment_id,
    reference_date: state.transaction.reference_date,
  }));

  const selectedPayment = options.payments.find(
    (payment) => payment.id === payment_id,
  );

  const isCredit = selectedPayment?.catalog_key === 'credit';

  useEffect(() => {
    if (isOpen && mode === 'add') {
      void creditCardStore.getState().refresh();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    let active = true;
    setCardInvoices([]);
    setSuggestedPeriod(null);
    setCardFailed(false);

    if (isOpen && cardId !== null) {
      setCardLoading(true);
      void Promise.all([
        window.api.getCardInvoices(cardId),
        reference_date
          ? window.api
              .suggestInvoicePeriod(cardId, reference_date)
              .catch(() => null)
          : null,
      ])
        .then(([rows, period]) => {
          if (active) {
            setCardInvoices(rows);
            setSuggestedPeriod(period);
          }
        })
        .catch(() => {
          if (active) {
            setCardFailed(true);
          }
        })
        .finally(() => {
          if (active) {
            setCardLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [isOpen, cardId, reference_date]);

  useEffect(() => {
    if (isOpen && mode === 'add' && !isCredit && cardId !== null) {
      handleTransaction('card_id', null);
      handleTransaction('credit_card_invoice_id', null);
      handleTransaction('historical_card', false);
    }
  }, [isOpen, isCredit, mode, cardId, handleTransaction]);
  const types = [
    { value: 1 as const, label: t('transactions.income') },
    { value: 2 as const, label: t('transactions.expense') },
  ].filter(
    (entry) =>
      mode === 'add' ||
      entry.value === selectedType ||
      (entry.value !== null &&
        selectedPayment &&
        paymentMethodsForType(entry.value).includes(
          selectedPayment.catalog_key,
        )),
  );

  useEffect(() => {
    if (
      isOpen &&
      mode === 'add' &&
      payment_id !== 0 &&
      !options.payments.some(
        (payment) =>
          payment.id === payment_id &&
          paymentMethodsForType(selectedType).includes(payment.catalog_key),
      )
    ) {
      handleTransaction('payment_id', 0);
    }
  }, [
    isOpen,
    mode,
    payment_id,
    selectedType,
    options.payments,
    handleTransaction,
  ]);

  useEffect(() => {
    if (
      isOpen &&
      mode === 'add' &&
      category_id !== null &&
      !categories.some((category) => category.value === category_id)
    ) {
      handleTransaction('category_id', null);
      setCategoryCleared(true);
    }

    if (
      !isOpen ||
      (category_id !== null &&
        categories.some((category) => category.value === category_id))
    ) {
      setCategoryCleared(false);
    }
    // Recheck persisted compatibility whenever the type or available catalog changes.
  }, [
    selectedType,
    category_id,
    options.categories,
    mode,
    isOpen,
    handleTransaction,
  ]);

  const handleSubmit = async () => {
    const submissionId = startSubmission();

    if (submissionId === null) {
      return;
    }

    let saved = false;

    try {
      if (type !== 1 && type !== 2) {
        console.error('Invalid transaction type:', type);
        toast.add({
          title: t('common.error_title'),
          description: t('transactions.invalid_type'),
        });
        return;
      }

      if (
        mode === 'add' &&
        (category_id === null ||
          !categories.some((c) => c.value === category_id))
      ) {
        console.error('Invalid category:', category_id);
        toast.add({
          title: t('common.error_title'),
          description: t('transactions.invalid_category'),
        });
        return;
      }

      if (!reference_date) {
        console.error('Invalid reference date:', reference_date);
        toast.add({
          title: t('common.error_title'),
          description: t('transactions.invalid_date'),
        });
        return;
      }

      const formattedDate = format(parseISO(reference_date), 'yyyy-MM-dd');

      if (
        !profile ||
        (mode === 'add' &&
          !options.payments.some(
            (payment) =>
              payment.id === payment_id &&
              paymentMethodsForType(type).includes(payment.catalog_key),
          ))
      ) {
        toast.add({
          title: t('common.error_title'),
          description: t('transactions.invalid_payment'),
        });
        return;
      }

      if (
        !Number.isSafeInteger(amount_cents) ||
        amount_cents <= 0 ||
        !name.trim()
      ) {
        toast.add({
          title: t('common.error_title'),
          description: t('transactions.save_error'),
        });
        return;
      }

      const details = {
        amount_cents: Math.round(amount_cents),
        name: name,
        note: note ?? null,
        type: type,
        reference_date: formattedDate,
      };

      let result: CreateResult;

      if (mode === 'add') {
        const input = {
          ...details,
          category_id,
          payment_id,
          user_id: profile.id,
          payment_date: null,
          card_id: isCredit ? cardId : null,
          credit_card_invoice_id: isCredit ? invoiceId : null,
          historical_card,
        };

        if (isCredit) {
          const plan = await window.api.previewTransactionCreation(input);

          if (
            !isCurrentSubmission(submissionId) ||
            !plan ||
            !(await confirmCardCorrection(plan)) ||
            !isCurrentSubmission(submissionId)
          ) {
            return;
          }

          result = await window.api.createTransaction({
            ...input,
            correction_token: plan.token,
          });
        } else {
          result = await window.api.createTransaction(input);
        }
      } else {
        if (transactionId === null) {
          throw new Error('No transaction selected for editing.');
        }

        if (invoiceId !== null) {
          const plan = await window.api.previewTransactionUpdate(
            transactionId,
            details,
          );

          if (
            !isCurrentSubmission(submissionId) ||
            !(await confirmCardCorrection(plan)) ||
            !isCurrentSubmission(submissionId)
          ) {
            return;
          }

          result = await window.api.updateTransaction(transactionId, {
            ...details,
            correction_token: plan.token,
          });
        } else {
          result = await window.api.updateTransaction(transactionId, details);
        }
      }

      if (!isCurrentSubmission(submissionId)) {
        return;
      }

      if (!result.ok) {
        toast.add({
          title: t('common.error_title'),
          description: t('transactions.save_error'),
        });
        return;
      }

      saved = true;

      try {
        const { loadTransactions, loadMonthlyStatement } =
          useAppStore.getState();
        await Promise.all([
          loadTransactions(),
          loadMonthlyStatement(),
          creditCardStore.getState().refresh(),
        ]);
      } catch (error) {
        if (!isCurrentSubmission(submissionId)) {
          return;
        }

        console.error(
          'Saved the transaction but failed to refresh the timeline:',
          error,
        );
        toast.add({
          title: t('transactions.saved'),
          description: t('transactions.refresh_error'),
        });
        return;
      }

      if (!isCurrentSubmission(submissionId)) {
        return;
      }

      toast.add({
        title: t('common.success'),
        description:
          mode === 'add' ? t('transactions.added') : t('transactions.updated'),
      });
    } catch (error) {
      if (!isCurrentSubmission(submissionId)) {
        return;
      }

      console.error('Failed to create transaction:', error);
      toast.add({
        title: t('common.error_title'),
        description: t('transactions.save_error'),
      });
    } finally {
      finishSubmission(saved, submissionId);
    }
  };

  return (
    <Dialog
      onOpenChange={(open, details) => {
        if (mode === 'edit' && open) {
          return;
        }

        if (isSubmitting) {
          details.cancel();
          return;
        }

        if (open) {
          openDialogTransaction();
        } else {
          closeDialogTransaction();
          resetTransaction();
        }
      }}
      open={isOpen}
    >
      <DialogContent
        size="lg"
        showCloseButton={!isSubmitting}
        finalFocus={() => {
          const target = dialogTransactionStore.getState().returnFocus;
          return target?.isConnected ? target : false;
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'add' ? (
              <Plus className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <Pencil className="size-4 text-primary" aria-hidden="true" />
            )}
            {t(mode === 'add' ? 'transactions.add' : 'transactions.edit')}
          </DialogTitle>
          <DialogDescription>
            {t(
              mode === 'add'
                ? 'transactions.description'
                : 'transactions.edit_description',
            )}
          </DialogDescription>
        </DialogHeader>
        <FieldSet disabled={isSubmitting}>
          <FieldGroup>
            {mode === 'add' && isCredit && (
              <>
                <FieldLabel>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="transaction-historical"
                      disabled={isSubmitting}
                      checked={historical_card}
                      onCheckedChange={(checked) => {
                        handleTransaction('historical_card', checked);

                        if (
                          !checked &&
                          cards.find((card) => card.id === cardId)?.archived_at
                        ) {
                          handleTransaction('card_id', null);
                          handleTransaction('credit_card_invoice_id', null);
                        }
                      }}
                    />
                    <FieldContent>
                      <FieldTitle>{t('cards.historical')}</FieldTitle>
                    </FieldContent>
                  </Field>
                </FieldLabel>
                <Field>
                  <FieldLabel htmlFor="transaction-card">
                    {t('cards.card')}
                  </FieldLabel>

                  <Select<number>
                    items={cards.map((card) => ({
                      value: card.id,
                      label: card.name,
                    }))}
                    value={cardId}
                    onValueChange={(value) => {
                      handleTransaction('card_id', Number(value) || null);
                      handleTransaction('credit_card_invoice_id', null);
                    }}
                  >
                    <SelectTrigger id="transaction-card">
                      <SelectValue placeholder={t('cards.select_card')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {cards
                          .filter(
                            (card) => historical_card || !card.archived_at,
                          )
                          .map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.name}
                              {card.archived_at
                                ? ` (${t('cards.archived')})`
                                : ''}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCardEditor(true)}
                >
                  {t('cards.new_card')}
                </Button>
                {cardId !== null && (
                  <Field>
                    <FieldLabel htmlFor="transaction-invoice">
                      {t('cards.invoice')}
                    </FieldLabel>
                    <Select<number>
                      items={[
                        { value: null, label: t('cards.automatic') },
                        ...cardInvoices.map((invoice) => ({
                          value: invoice.id,
                          label: `${cardDate(invoice.closing_date)} · #${invoice.id}`,
                        })),
                      ]}
                      value={invoiceId}
                      onValueChange={(value) => {
                        handleTransaction(
                          'credit_card_invoice_id',
                          Number(value) || null,
                        );
                      }}
                    >
                      <SelectTrigger id="transaction-invoice">
                        <SelectValue placeholder={t('cards.automatic')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={null}>
                            {t('cards.automatic')}
                          </SelectItem>
                          {cardInvoices.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {cardDate(invoice.closing_date)} · #{invoice.id}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <FieldDescription>
                      {t('cards.override_hint')}
                    </FieldDescription>
                  </Field>
                )}
                {suggestedPeriod && invoiceId === null && (
                  <p className="text-xs text-muted-foreground">
                    {t('cards.preview')}:{' '}
                    {cardDate(suggestedPeriod.opening_date)} →{' '}
                    {cardDate(suggestedPeriod.closing_date)}
                  </p>
                )}
                {cardLoading && <p role="status">{t('common.loading')}</p>}
                {cardFailed && <p role="alert">{t('cards.save_error')}</p>}
              </>
            )}
            {mode === 'edit' && invoiceId !== null && (
              <p className="text-xs text-muted-foreground">
                {t('cards.date_correction')}
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="title">{t('transactions.name')}</FieldLabel>
              <Input
                id="title"
                autoComplete="off"
                placeholder={t('transactions.name_placeholder')}
                value={name}
                onChange={(e) => handleTransaction('name', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldMoney
                  label={t('transactions.amount')}
                  money={amount_cents / 100}
                  onMoneyChange={(amount) =>
                    handleTransaction('amount_cents', Math.round(amount * 100))
                  }
                  currencySymbol="R$"
                  decimalSeparator={getLocale() === 'pt-BR' ? ',' : '.'}
                  showCurrencySymbol
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="type">{t('transactions.type')}</FieldLabel>
                <Select<number>
                  items={types}
                  value={type}
                  onValueChange={(value) => handleTransaction('type', value)}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder={t('transactions.select_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div
              className={
                mode === 'add' ? 'grid grid-cols-2 gap-4' : 'grid gap-4'
              }
            >
              {mode === 'add' && (
                <Field>
                  <FieldLabel htmlFor="category">
                    {t('transactions.category')}
                  </FieldLabel>
                  <Select
                    items={categories}
                    value={category_id}
                    onValueChange={(value) =>
                      handleTransaction('category_id', value)
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categories.map((category) => (
                          <SelectItem
                            key={category.value}
                            value={category.value}
                          >
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {categoryCleared && (
                    <p role="status" className="text-xs text-muted-foreground">
                      {t('category_manager.incompatible')}
                    </p>
                  )}
                  {options.categories.find(
                    (category) => category.id === category_id,
                  )?.description && (
                    <p className="text-xs text-muted-foreground">
                      {
                        options.categories.find(
                          (category) => category.id === category_id,
                        )?.description
                      }
                    </p>
                  )}
                </Field>
              )}
              <Field>
                <FieldDatePicker
                  id="date"
                  label={t('transactions.date')}
                  value={reference_date ? parseISO(reference_date) : undefined}
                  onValueChange={(value) =>
                    handleTransaction(
                      'reference_date',
                      value ? format(value, 'yyyy-MM-dd') : '',
                    )
                  }
                  placeholder={t('transactions.pick_date')}
                />
              </Field>
            </div>
            {mode === 'add' && (
              <Field>
                <FieldLabel htmlFor="payment">
                  {t('transactions.payment')}
                </FieldLabel>
                <Select
                  items={payments}
                  value={payment_id || null}
                  onValueChange={(value) =>
                    handleTransaction('payment_id', value ?? 0)
                  }
                >
                  <SelectTrigger id="payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {payments.map((payment) => (
                        <SelectItem key={payment.value} value={payment.value}>
                          {payment.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {options.payments.find((payment) => payment.id === payment_id)
                  ?.catalog_key === 'credit' && (
                  <p className="text-xs text-muted-foreground">
                    {t('transactions.credit_hint')}
                  </p>
                )}
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="note">{t('transactions.note')}</FieldLabel>
              <Input
                id="note"
                value={note ?? ''}
                onChange={(event) =>
                  handleTransaction('note', event.target.value)
                }
                autoComplete="off"
                placeholder={t('transactions.note_placeholder')}
              />
            </Field>
          </FieldGroup>
        </FieldSet>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="ghost" type="button" disabled={isSubmitting}>
                <X aria-hidden="true" />
                {t('common.cancel')}
              </Button>
            }
          />
          <Button onClick={handleSubmit} type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('transactions.saving')
              : mode === 'add'
                ? t('transactions.add')
                : t('transactions.update')}
            {isSubmitting && <Spinner data-icon="inline-start" />}
          </Button>
        </DialogFooter>
      </DialogContent>
      {cardEditor && (
        <CardDialog
          card="new"
          onClose={() => setCardEditor(false)}
          onSaved={async (id) => {
            await creditCardStore.getState().refresh();
            handleTransaction('card_id', id);
            handleTransaction('credit_card_invoice_id', null);
          }}
        />
      )}
    </Dialog>
  );
}
