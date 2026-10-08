import { useId, useMemo, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { format } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@lib/utils';

import { Button } from './button';
import { Calendar } from './calendar';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Label } from '@components/ui/label';
import { Separator } from '@components/ui/separator';

function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        'flex flex-col gap-3 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3',
        className,
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        'mb-1 font-sans font-medium data-[variant=label]:text-xs data-[variant=label]:text-muted-foreground data-[variant=legend]:text-sm data-[variant=legend]:text-primary',
        className,
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        'group/field-group @container/field-group flex w-full flex-col gap-3',
        className,
      )}
      {...props}
    />
  );
}

const fieldVariants = cva(
  'group/field flex w-full gap-1 data-[invalid=true]:text-destructive',
  {
    variants: {
      orientation: {
        vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
        horizontal:
          'flex-row items-center gap-3 has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
        responsive:
          'flex-col *:w-full @md/field-group:gap-3 @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  },
);

function Field({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

interface FieldDatePickerProps {
  label: string;
  /** A local calendar date, without conversion to UTC. */
  value: Date | undefined;
  onValueChange: (value: Date | undefined) => void;
  id?: string;
  /** When provided, submits the selected date as YYYY-MM-DD. */
  name?: string;
  description?: React.ReactNode;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledDates?: React.ComponentProps<typeof Calendar>['disabled'];
  className?: string;
}

function FieldDatePicker({
  label,
  value,
  onValueChange,
  id,
  name,
  description,
  error,
  placeholder = 'Pick a date',
  disabled = false,
  disabledDates,
  className,
}: FieldDatePickerProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const describedBy =
    [
      description ? `${inputId}-description` : null,
      error ? `${inputId}-error` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <Field
      className={className}
      data-disabled={disabled}
      data-invalid={!!error}
    >
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={inputId}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              data-empty={!value}
              className="h-auto w-full justify-between rounded-md border-input px-3 py-2 text-left font-normal leading-normal focus-visible:ring-2 focus-visible:ring-ring data-[empty=true]:text-muted-foreground"
            >
              <span className="truncate">
                {value ? format(value, 'PPP') : placeholder}
              </span>
              <ChevronDownIcon
                className="text-muted-foreground"
                aria-hidden="true"
              />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          aria-label={label}
          className="w-auto max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-border p-0 shadow-none ring-0 data-open:animate-none data-closed:animate-none"
        >
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            disabled={disabledDates}
            autoFocus
            onSelect={(date) => {
              onValueChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value ? format(value, 'yyyy-MM-dd') : ''}
          disabled={disabled}
        />
      )}
      {description && (
        <FieldDescription id={`${inputId}-description`}>
          {description}
        </FieldDescription>
      )}
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  );
}

interface FieldMoneyProps {
  label: string;
  /** Amount in monetary units, not cents: 1234.56 means 1,234.56. */
  money: number;
  /** Receives monetary units. Clearing the input emits zero. */
  onMoneyChange: (money: number) => void;
  currencySymbol?: string;
  showCurrencySymbol?: boolean;
  decimalSeparator?: ',' | '.';
  id?: string;
  name?: string;
  description?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

function FieldMoney({
  label,
  money,
  onMoneyChange,
  currencySymbol = 'R$',
  showCurrencySymbol = true,
  decimalSeparator = ',',
  id,
  name,
  description,
  error,
  disabled = false,
  readOnly = false,
  className,
}: FieldMoneyProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [draft, setDraft] = useState<{ text: string; money: number } | null>(
    null,
  );
  const formattedMoney = Number.isFinite(money)
    ? money.toFixed(2).replace('.', decimalSeparator)
    : '';
  const displayValue = draft?.money === money ? draft.text : formattedMoney;
  const describedBy =
    [
      showCurrencySymbol && currencySymbol ? `${inputId}-currency` : null,
      description ? `${inputId}-description` : null,
      error ? `${inputId}-error` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <Field
      className={className}
      data-disabled={disabled}
      data-invalid={!!error}
    >
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
          error && 'border-destructive focus-within:ring-destructive',
        )}
      >
        {showCurrencySymbol && currencySymbol && (
          <span
            id={`${inputId}-currency`}
            className="shrink-0 font-mono text-sm text-muted-foreground"
          >
            {currencySymbol}
          </span>
        )}
        <Input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          disabled={disabled}
          readOnly={readOnly}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className="rounded-none border-0 bg-transparent px-0 font-mono tabular-nums focus-visible:ring-0 disabled:opacity-100 aria-invalid:focus-visible:ring-0"
          onChange={(event) => {
            const text = event.target.value;

            // Preserve partial decimal input without reformatting the caret position.
            if (!/^-?\d*(?:[.,]\d{0,2})?$/.test(text)) {
              return;
            }

            const normalized = text.replace(',', '.');
            const nextMoney = ['', '-', '.', '-.'].includes(normalized)
              ? 0
              : Number(normalized);

            if (!Number.isFinite(nextMoney)) {
              return;
            }

            setDraft({ text, money: nextMoney });
            onMoneyChange(nextMoney);
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
      {name && (
        <input
          type="hidden"
          name={name}
          value={Number.isFinite(money) ? money : ''}
          disabled={disabled}
        />
      )}
      {description && (
        <FieldDescription id={`${inputId}-description`}>
          {description}
        </FieldDescription>
      )}
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        'group/field-content flex flex-1 flex-col gap-0.5 leading-snug',
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-3',
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        'flex w-fit items-center gap-2 font-sans text-xs font-medium text-muted-foreground group-data-[disabled=true]/field:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        'text-left text-xs leading-normal text-pretty font-normal text-muted-foreground group-has-data-horizontal/field:text-balance',
        '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className,
      )}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn('relative h-5 text-xs', className)}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<'div'> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn(
        'text-xs leading-normal font-normal text-destructive',
        className,
      )}
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldDatePicker,
  FieldMoney,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};

export type { FieldDatePickerProps, FieldMoneyProps };
