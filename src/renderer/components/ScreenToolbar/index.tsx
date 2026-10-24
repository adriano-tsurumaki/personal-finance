import { Search, type LucideIcon } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';

export function ScreenSearch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0 flex-[1_1_16rem]">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        className="h-8 py-0 pl-9"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label={label}
        placeholder={label}
      />
    </div>
  );
}

interface ScreenFilter<Value extends string> {
  value: Value;
  label: string;
  icon?: LucideIcon;
}

export function ScreenFilters<Value extends string>({
  label,
  value,
  items,
  onValueChange,
}: {
  label: string;
  value: Value;
  items: readonly ScreenFilter<Value>[];
  onValueChange: (value: Value) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map(({ value: itemValue, label: itemLabel, icon: Icon }) => (
        <Button
          key={itemValue}
          variant={value === itemValue ? 'default' : 'outline'}
          aria-pressed={value === itemValue}
          onClick={() => onValueChange(itemValue)}
        >
          {Icon && <Icon aria-hidden="true" />}
          {itemLabel}
        </Button>
      ))}
    </div>
  );
}
