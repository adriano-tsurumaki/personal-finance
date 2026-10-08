import { t } from '@lib/i18n';
import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from '@lib/utils';
import { XIcon } from 'lucide-react';

import { Button } from './button';
import { ToastPortalTarget } from './toast';

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-overlay transition-opacity duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none data-starting-style:opacity-0 data-ending-style:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = 'default',
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  size?: 'sm' | 'default' | 'lg';
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] max-w-104 -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-card p-5 font-sans text-sm leading-normal text-card-foreground outline-none transition-[opacity,translate] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none data-starting-style:opacity-0 data-starting-style:translate-y-[calc(-50%+4px)] data-ending-style:opacity-0 data-ending-style:translate-y-[calc(-50%+4px)] data-[size=sm]:max-w-80 data-[size=lg]:max-w-136 sm:w-[calc(100%-3rem)] sm:max-h-[calc(100dvh-3rem)]',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:translate-y-0 [&_svg]:size-3.5"
                size="icon-sm"
              >
                <XIcon aria-hidden="true" />
                <span className="sr-only">{t('common.close')}</span>
              </Button>
            }
          />
        )}
      </DialogPrimitive.Popup>
      <ToastPortalTarget />
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1 pr-8', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          render={<Button variant="outline">{t('common.close')}</Button>}
        />
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'text-sm leading-normal font-semibold text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-xs leading-normal text-pretty text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
