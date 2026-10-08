import { Construction } from 'lucide-react';
import { t } from '@lib/i18n';

export default function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
        <Construction
          className="mb-2 size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{t('sections.pending')}</p>
      </div>
    </div>
  );
}
