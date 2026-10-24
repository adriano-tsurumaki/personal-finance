import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ScreenHeaderProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
}

export default function ScreenHeader({
  id,
  title,
  description,
  icon: Icon,
  actions,
}: ScreenHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1
          id={id}
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
        >
          <Icon className="size-5 shrink-0" aria-hidden="true" />
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {actions}
    </header>
  );
}
