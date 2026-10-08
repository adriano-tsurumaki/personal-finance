import { create } from 'zustand';

export interface ConfirmationOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmationState {
  options: ConfirmationOptions | null;
  resolve: ((confirmed: boolean) => void) | null;
}

export const useConfirmationStore = create<ConfirmationState>(() => ({
  options: null,
  resolve: null,
}));

export const confirmation = {
  /** Returns false on dismissal or when another confirmation is already open. */
  confirm(options: ConfirmationOptions): Promise<boolean> {
    if (useConfirmationStore.getState().options) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      useConfirmationStore.setState({ options: { ...options }, resolve });
    });
  },

  respond(confirmed: boolean): void {
    const { resolve } = useConfirmationStore.getState();
    useConfirmationStore.setState({ options: null, resolve: null });
    resolve?.(confirmed);
  },
};
