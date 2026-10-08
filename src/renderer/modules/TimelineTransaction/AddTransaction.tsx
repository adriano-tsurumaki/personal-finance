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

const types = [
  { value: null, label: 'Select type' },
  { value: 1, label: 'Income' },
  { value: 2, label: 'Expense' },
];

const categories = [
  { value: null, label: 'Select category' },
  { value: 1, label: 'Groceries' },
  { value: 2, label: 'Rent' },
  { value: 3, label: 'Salary' },
  { value: 4, label: 'Entertainment' },
  { value: 5, label: 'Utilities' },
  { value: 6, label: 'Transportation' },
  { value: 7, label: 'Healthcare' },
  { value: 8, label: 'Education' },
  { value: 9, label: 'Travel' },
  { value: 10, label: 'Miscellaneous' },
];

export default function AddTransaction() {
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

  const { payment_id, user_id, reference_date } = useDialogTransactionStore(
    (state) => ({
      payment_id: state.transaction.payment_id,
      user_id: state.transaction.user_id,
      reference_date: state.transaction.reference_date,
    }),
  );

  const handleSubmit = async () => {
    if (!startSubmission()) {
      return;
    }

    let saved = false;

    try {
      if (type !== 1 && type !== 2) {
        console.error('Invalid transaction type:', type);
        toast.add({
          title: 'Error',
          description: 'Invalid transaction type. Please select a valid type.',
        });
        return;
      }

      if (
        category_id === null ||
        !categories.some((c) => c.value === category_id)
      ) {
        console.error('Invalid category:', category_id);
        toast.add({
          title: 'Error',
          description: 'Invalid category. Please select a valid category.',
        });
        return;
      }

      if (!reference_date) {
        console.error('Invalid reference date:', reference_date);
        toast.add({
          title: 'Error',
          description: 'Please select a valid reference date.',
        });
        return;
      }

      const formattedDate = format(parseISO(reference_date), 'yyyy-MM-dd');

      const transactionInput = {
        amount_cents: Math.round(amount_cents),
        name: name,
        note: note ?? null,
        type: type,
        category_id: category_id,
        payment_id: mode === 'edit' ? payment_id : 3,
        user_id: mode === 'edit' ? user_id : 1,
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
          title: 'Error',
          description: 'Something went wrong. Please try again.',
        });
        return;
      }

      if (!result.ok) {
        toast.add({ title: 'Error', description: result.error.message });
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
          title: 'Transaction saved',
          description:
            'Could not refresh the timeline. Reload it to see the changes.',
        });
        return;
      }

      toast.add({
        title: 'Success',
        description:
          mode === 'add'
            ? 'Transaction added successfully.'
            : 'Transaction updated successfully.',
      });
    } catch (error) {
      console.error('Failed to create transaction:', error);
      toast.add({
        title: 'Error',
        description: 'Could not save the transaction. Please try again.',
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
      <DialogTrigger aria-label="Add transaction" title="Add transaction">
        <div className="flex items-center gap-2 bg-primary rounded-full p-1 text-black shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer">
          <Plus className="size-4" aria-hidden="true" />
        </div>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" aria-hidden="true" />
            {mode === 'add' ? 'Add Transaction' : 'Edit Transaction'}
          </DialogTitle>
          <DialogDescription>
            The reference date determines where this transaction appears on the
            timeline.
          </DialogDescription>
        </DialogHeader>
        <FieldSet disabled={isSubmitting}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                autoComplete="off"
                placeholder="e.g. Groceries, Rent, Salary"
                value={name}
                onChange={(e) => handleTransaction('name', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldMoney
                  label="Amount"
                  money={amount_cents / 100}
                  onMoneyChange={(amount) =>
                    handleTransaction('amount_cents', Math.round(amount * 100))
                  }
                  currencySymbol="R$"
                  showCurrencySymbol
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
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
                <FieldLabel htmlFor="category">Category</FieldLabel>
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
                  label="Reference date"
                  value={reference_date ? parseISO(reference_date) : undefined}
                  onValueChange={(value) =>
                    handleTransaction(
                      'reference_date',
                      value ? format(value, 'yyyy-MM-dd') : '',
                    )
                  }
                  placeholder="e.g. 2024-01-01"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Input
                id="note"
                value={note ?? ''}
                onChange={(event) =>
                  handleTransaction('note', event.target.value)
                }
                autoComplete="off"
                placeholder="Optional - e.g. Groceries for the week"
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
                Cancel
              </Button>
            }
          />
          <Button onClick={handleSubmit} type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Adding...'
              : mode === 'add'
                ? 'Add transaction'
                : 'Update transaction'}
            {isSubmitting && <Spinner data-icon="inline-start" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
