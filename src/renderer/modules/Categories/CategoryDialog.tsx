import { useState, type RefObject } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import {
  FieldSelect,
  Field,
  FieldGroup,
  FieldLabel,
} from '@components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
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
    label: t(`category_manager.${value as CategoryTransactionType}`),
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
            {t(category ? 'category_manager.edit' : 'category_manager.add')}
          </DialogTitle>
          <DialogDescription>
            {t('category_manager.form_hint')}
          </DialogDescription>
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
                  {t('category_manager.name')}
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
                  placeholder={t('category_manager.name_placeholder')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="category-description">
                  {t('category_manager.description')}
                </FieldLabel>
                <Input
                  id="category-description"
                  maxLength={500}
                  value={input.description ?? ''}
                  onChange={(event) =>
                    setInput({ ...input, description: event.target.value })
                  }
                  placeholder={t('category_manager.description_placeholder')}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="category-color">
                    {t('category_manager.color')}
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
                <FieldSelect
                  label={t('category_manager.type')}
                  options={types}
                  value={input.transaction_type}
                  onValueChange={(value) => {
                    if (value) {
                      setInput({ ...input, transaction_type: value });
                    }
                  }}
                />
              </div>
              <Field>
                <FieldLabel>{t('category_manager.icon')}</FieldLabel>
                <div
                  className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                  role="group"
                  aria-label={t('category_manager.icon')}
                >
                  {categoryIconKeys.map((key) => {
                    const OptionIcon = getCategoryIcon(key);
                    const label = t(`category_manager.icons.${key}`);
                    return (
                      <Button
                        key={key}
                        type="button"
                        size="icon"
                        variant="outline"
                        className={`w-full ${input.icon_key === key ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                        aria-label={label}
                        title={label}
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
                aria-label={t('category_manager.preview')}
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
                    {previewName.trim() || t('category_manager.preview')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`category_manager.${input.transaction_type}`)}
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
              {t(busy ? 'transactions.saving' : 'category_manager.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
