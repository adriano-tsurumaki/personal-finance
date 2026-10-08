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
  DialogTrigger,
} from '@components/ui/dialog';
import {
  Field,
  FieldDatePicker,
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
import { Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDialogTransactionStore } from '@store/dialog-transaction';
import type { CreateResult } from '@shared/contracts/result';
import { useAppStore } from '@store/transaction';
import { useProfileStore } from '@store/profile';
import { categoryLabel, getLocale, t } from '@lib/i18n';

export default function AddTransaction() {
  const profile = useProfileStore((state) => state.activeProfile);
  const options = useProfileStore((state) => state.options);
  const types = [
    { value: null, label: t('transactions.selectType') },
    { value: 1, label: t('transactions.income') },
    { value: 2, label: t('transactions.expense') },
  ];
  const categories = [
    { value: null, label: t('transactions.selectCategory') },
    ...options.categories.map((category) => ({
      value: category.id,
      label: categoryLabel(category),
    })),
  ];
  const payments = [
    { value: null, label: t('transactions.selectPayment') },
    ...options.payments.map((payment) => ({
      value: payment.id,
      label: t(`payments.${payment.catalog_key}`),
    })),
  ];
  const {
    openDialogTransaction,
    closeDialogTransaction,
    handleTransaction,
    resetTransaction,
    mode,
    isOpen,
    isSubmitting,
    startSubmission,
    finishSubmission,
  } = useDialogTransactionStore((state) => ({
    openDialogTransaction: state.openDialogTransaction,
    closeDialogTransaction: state.closeDialogTransaction,
    handleTransaction: state.handleTransaction,
    resetTransaction: state.resetTransaction,
    mode: state.modeDialogTransaction,
    isOpen: state.isDialogTransactionOpen,
    isSubmitting: state.isSubmitting,
    startSubmission: state.startSubmission,
    finishSubmission: state.finishSubmission,
  }));

  const {
    transactionId,
    type,
    amount_cents,
    category_id,
    name,
    note,
    payment_date,
  } = useDialogTransactionStore((state) => ({
    transactionId: state.transactionId,
    type: state.transaction.type,
    amount_cents: state.transaction.amount_cents,
    category_id: state.transaction.category_id,
    name: state.transaction.name,
    note: state.transaction.note,
    payment_date: state.transaction.payment_date,
  }));

  const { payment_id, reference_date } = useDialogTransactionStore((state) => ({
    payment_id: state.transaction.payment_id,
    reference_date: state.transaction.reference_date,
  }));

  const handleSubmit = async () => {
    if (!startSubmission()) {
      return;
    }

    let saved = false;

    try {
      if (type !== 1 && type !== 2) {
        console.error('Invalid transaction type:', type);
        toast.add({
          title: t('common.errorTitle'),
          description: t('transactions.invalidType'),
        });
        return;
      }

      if (
        category_id === null ||
        !categories.some((c) => c.value === category_id)
      ) {
        console.error('Invalid category:', category_id);
        toast.add({
          title: t('common.errorTitle'),
          description: t('transactions.invalidCategory'),
        });
        return;
      }

      if (!reference_date) {
        console.error('Invalid reference date:', reference_date);
        toast.add({
          title: t('common.errorTitle'),
          description: t('transactions.invalidDate'),
        });
        return;
      }

      const formattedDate = format(parseISO(reference_date), 'yyyy-MM-dd');

      if (
        !profile ||
        !options.payments.some((payment) => payment.id === payment_id)
      ) {
        toast.add({
          title: t('common.errorTitle'),
          description: t('transactions.invalidPayment'),
        });
        return;
      }

      if (
        !Number.isSafeInteger(amount_cents) ||
        amount_cents <= 0 ||
        !name.trim()
      ) {
        toast.add({
          title: t('common.errorTitle'),
          description: t('transactions.saveError'),
        });
        return;
      }

      const transactionInput = {
        amount_cents: Math.round(amount_cents),
        name: name,
        note: note ?? null,
        type: type,
        category_id: category_id,
        payment_id,
        user_id: profile.id,
        reference_date: formattedDate,
        payment_date: mode === 'edit' ? payment_date : null,
      };

      let result: CreateResult | undefined;

      if (mode === 'add') {
        result = await window.api.createTransaction(transactionInput);
      } else if (mode === 'edit' && transactionId !== null) {
        result = await window.api.updateTransaction(
          transactionId,
          transactionInput,
        );
      } else {
        toast.add({
          title: t('common.errorTitle'),
          description: t('common.error'),
        });
        return;
      }

      if (!result.ok) {
        toast.add({
          title: t('common.errorTitle'),
          description: t('transactions.saveError'),
        });
        return;
      }

      saved = true;

      try {
        await useAppStore.getState().loadTransactions();
      } catch (error) {
        console.error(
          'Saved the transaction but failed to refresh the timeline:',
          error,
        );
        toast.add({
          title: t('transactions.saved'),
          description: t('transactions.refreshError'),
        });
        return;
      }

      toast.add({
        title: t('common.success'),
        description:
          mode === 'add' ? t('transactions.added') : t('transactions.updated'),
      });
    } catch (error) {
      console.error('Failed to create transaction:', error);
      toast.add({
        title: t('common.errorTitle'),
        description: t('transactions.saveError'),
      });
    } finally {
      finishSubmission(saved);
    }
  };

  return (
    <Dialog
      onOpenChange={(open, details) => {
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
      <DialogTrigger
        render={
          <Button type="button">
            <Plus aria-hidden="true" />
            {t('transactions.add')}
          </Button>
        }
      />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" aria-hidden="true" />
            {t(mode === 'add' ? 'transactions.add' : 'transactions.edit')}
          </DialogTitle>
          <DialogDescription>{t('transactions.description')}</DialogDescription>
        </DialogHeader>
        <FieldSet disabled={isSubmitting}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">{t('transactions.name')}</FieldLabel>
              <Input
                id="title"
                autoComplete="off"
                placeholder={t('transactions.namePlaceholder')}
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
                    <SelectValue />
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
            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
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
                  placeholder={t('transactions.pickDate')}
                />
              </Field>
            </div>
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
                  {t('transactions.creditHint')}
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="note">{t('transactions.note')}</FieldLabel>
              <Input
                id="note"
                value={note ?? ''}
                onChange={(event) =>
                  handleTransaction('note', event.target.value)
                }
                autoComplete="off"
                placeholder={t('transactions.notePlaceholder')}
              />
            </Field>
          </FieldGroup>
        </FieldSet>
        <DialogFooter>
          <DialogClose
            render={
              <Button
                onClick={resetTransaction}
                variant="ghost"
                type="button"
                disabled={isSubmitting}
              >
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
    </Dialog>
  );
}
