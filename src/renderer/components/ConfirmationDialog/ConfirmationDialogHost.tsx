import { confirmation, useConfirmationStore } from '@store/confirmation';
import ConfirmationDialog from './index';

export default function ConfirmationDialogHost() {
  const options = useConfirmationStore((state) => state.options);

  return (
    <ConfirmationDialog
      {...options}
      title={options?.title ?? ''}
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) {
          confirmation.respond(false);
        }
      }}
      onConfirm={() => confirmation.respond(true)}
    />
  );
}
