import OdometerMoney from '@components/OdometerMoney';
import type { OdometerMoneyProps } from '@components/OdometerMoney/types';
import { t } from '@lib/i18n';

export default function SummaryStat({
  label,
  available,
  value,
  format,
  tone,
  icon,
  hint,
}: {
  label: string;
  available: boolean;
  value: number;
  format?: OdometerMoneyProps['format'];
  tone: 'income' | 'expense' | 'neutral';
  icon?: React.ReactNode;
  hint?: string;
}): React.JSX.Element {
  const toneClass =
    tone === 'income'
      ? 'text-income'
      : tone === 'expense'
        ? 'text-expense'
        : 'text-foreground';

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd
        className={`relative mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}
      >
        <span>
          {available ? <OdometerMoney value={value} format={format} /> : '—'}
          {available && hint ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {t('summary.net', { amount: hint })}
            </span>
          ) : null}
        </span>
      </dd>
    </div>
  );
}
