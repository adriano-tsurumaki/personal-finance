import { useState, type RefObject } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { getCategoryIcon } from '@lib/category-icons';
import { categoryLabel, t } from '@lib/i18n';
import {
  categoryIconKeys,
  type CategoryDto,
  type CategoryInput,
  type CategoryTransactionType,
} from '@shared/contracts/categories';

export default function CategoryDialog({
  category,
  busy,
  onClose,
  onSave,
  returnFocus,
}: {
  category: CategoryDto | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: CategoryInput) => Promise<void>;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const [input, setInput] = useState<CategoryInput>({
    name: category?.name ?? '',
    color: category?.color ?? '#25845b',
    icon_key:
      categoryIconKeys.find((key) => key === category?.icon_key) ?? 'other',
    description: category?.description ?? '',
    transaction_type: category?.transaction_type ?? 'both',
  });
  const Icon = getCategoryIcon(input.icon_key);
  const types: { value: CategoryTransactionType; label: string }[] = [
    'income',
    'expense',
    'both',
  ].map((value) => ({
    value: value as CategoryTransactionType,
    label: t(`categoryManager.${value as CategoryTransactionType}`),
  }));
  const previewName =
    category && input.name === category.name
      ? categoryLabel(category)
      : input.name;

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (busy) {
          details.cancel();
          return;
        }

        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent size="lg" showCloseButton={!busy} finalFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>
            {t(category ? 'categoryManager.edit' : 'categoryManager.add')}
          </DialogTitle>
          <DialogDescription>{t('categoryManager.formHint')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(input);
          }}
        >
          <fieldset disabled={busy}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="category-name">
                  {t('categoryManager.name')}
                </FieldLabel>
                <Input
                  id="category-name"
                  autoComplete="off"
                  required
                  maxLength={100}
                  value={input.name}
                  onChange={(event) =>
                    setInput({ ...input, name: event.target.value })
                  }
                  placeholder={t('categoryManager.namePlaceholder')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="category-description">
                  {t('categoryManager.description')}
                </FieldLabel>
                <Input
                  id="category-description"
                  maxLength={500}
                  value={input.description ?? ''}
                  onChange={(event) =>
                    setInput({ ...input, description: event.target.value })
                  }
                  placeholder={t('categoryManager.descriptionPlaceholder')}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="category-color">
                    {t('categoryManager.color')}
                  </FieldLabel>
                  <Input
                    id="category-color"
                    type="color"
                    className="h-10 cursor-pointer"
                    value={input.color}
                    onInput={(event) =>
                      setInput({ ...input, color: event.currentTarget.value })
                    }
                    onChange={(event) =>
                      setInput({ ...input, color: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="category-type">
                    {t('categoryManager.type')}
                  </FieldLabel>
                  <Select
                    items={types}
                    value={input.transaction_type}
                    onValueChange={(value) => {
                      if (value) {
                        setInput({ ...input, transaction_type: value });
                      }
                    }}
                  >
                    <SelectTrigger id="category-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>{t('categoryManager.icon')}</FieldLabel>
                <div
                  className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                  role="group"
                  aria-label={t('categoryManager.icon')}
                >
                  {categoryIconKeys.map((key) => {
                    const OptionIcon = getCategoryIcon(key);
                    return (
                      <Button
                        key={key}
                        type="button"
                        size="icon"
                        variant="outline"
                        className={`w-full ${input.icon_key === key ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                        aria-label={t(`categoryManager.icons.${key}`)}
                        title={t(`categoryManager.icons.${key}`)}
                        aria-pressed={input.icon_key === key}
                        onClick={() => setInput({ ...input, icon_key: key })}
                      >
                        <OptionIcon aria-hidden="true" />
                      </Button>
                    );
                  })}
                </div>
              </Field>
              <div
                className="flex items-center gap-3 rounded-lg border border-border bg-background p-4"
                aria-label={t('categoryManager.preview')}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    color: input.color,
                    borderColor: input.color,
                    backgroundColor: `${input.color}1a`,
                  }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="wrap-break-words text-sm font-medium">
                    {previewName.trim() || t('categoryManager.preview')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`categoryManager.${input.transaction_type}`)}
                  </p>
                </div>
              </div>
            </FieldGroup>
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || !input.name.trim()}>
              {t(busy ? 'transactions.saving' : 'categoryManager.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
