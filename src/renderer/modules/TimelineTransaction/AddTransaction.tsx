import { useState } from 'react';
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
import { toast, Toaster } from '@components/ui/toast';
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';

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
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [type, setType] = useState<number | null>(types[0].value);
  const [category, setCategory] = useState<number | null>(categories[0].value);
  const [date, setDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (type !== 1 && type !== 2) {
        console.error('Invalid transaction type:', type);
        toast.add({
          title: 'Error',
          description: 'Invalid transaction type. Please select a valid type.',
        });
        return;
      }

      if (category === null || !categories.some((c) => c.value === category)) {
        console.error('Invalid category:', category);
        toast.add({
          title: 'Error',
          description: 'Invalid category. Please select a valid category.',
        });
        return;
      }

      if (date === undefined) {
        console.error('Invalid date:', date);
        toast.add({
          title: 'Error',
          description: 'Invalid date. Please select a valid date.',
        });
        return;
      }

      const formattedDate = format(date, 'yyyy-MM-dd');

      const result = await window.api.createTransaction({
        amount_cents: Math.round(amount * 100),
        name: title,
        type: type,
        category_id: category,
        payment_id: 3, // TODO: Replace with actual payment method ID
        user_id: 1, // TODO: Replace with actual user ID
        reference_date: formattedDate,
        payment_date: formattedDate,
      });

      if (!result.ok) {
        return;
      }

      toast.add({
        title: 'Success',
        description: 'Transaction added successfully.',
      });

      reset();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      toast.add({
        title: 'Error',
        description: 'Could not save the transaction. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
  };

  const reset = () => {
    setTitle('');
    setAmount(0);
    setType(types[0].value);
    setCategory(categories[0].value);
    setDate(undefined);
  };

  return (
    <Dialog onOpenChange={(open) => open && handleCancel()}>
      <DialogTrigger>
        <div className="flex items-center gap-2 bg-primary rounded-full p-1 text-black shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer">
          <Plus className="size-4" aria-hidden="true" />
        </div>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" aria-hidden="true" />
            Add transaction
          </DialogTitle>
          <DialogDescription>
            It lands on the timeline for the date you pick and re-runs the
            month's balance.
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                autoComplete="off"
                placeholder="e.g. Groceries, Rent, Salary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldMoney
                  label="Amount"
                  money={amount}
                  onMoneyChange={setAmount}
                  currencySymbol="R$"
                  showCurrencySymbol
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select<number>
                  items={types}
                  value={type}
                  onValueChange={setType}
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
                  value={category}
                  onValueChange={setCategory}
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
                  label="Date"
                  value={date}
                  onValueChange={setDate}
                  placeholder="e.g. 2024-01-01"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Input
                id="note"
                autoComplete="off"
                placeholder="Optional - e.g. Groceries for the week"
              />
            </Field>
          </FieldGroup>
        </FieldSet>
        <DialogFooter>
          <DialogClose
            render={
              <Button onClick={handleCancel} variant="ghost" type="button">
                <X aria-hidden="true" />
                Cancel
              </Button>
            }
          />
          <Button onClick={handleSubmit} type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add transaction'}
            {isSubmitting && <Spinner data-icon="inline-start" />}
          </Button>
        </DialogFooter>
        <Toaster />
      </DialogContent>
    </Dialog>
  );
}
