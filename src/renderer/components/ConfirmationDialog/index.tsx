import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Spinner } from '@components/ui/spinner';
import { t } from '@lib/i18n';

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The caller closes the dialog after the action succeeds and handles errors. */
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  isConfirming?: boolean;
  destructive?: boolean;
}

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = t('common.confirm'),
  cancelLabel = t('common.cancel'),
  pendingLabel = t('common.confirming'),
  isConfirming = false,
  destructive = false,
}: ConfirmationDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isConfirming) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent size="sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="ghost" disabled={isConfirming}>
                {cancelLabel}
              </Button>
            }
          />
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={isConfirming}
            onClick={onConfirm}
          >
            {isConfirming && <Spinner />}
            {isConfirming ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
