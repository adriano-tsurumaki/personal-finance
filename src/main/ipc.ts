import type { AppDatabase } from './db';
import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { createTransactionService } from './transactions';
import type { TransactionInput } from '@shared/contracts/transaction';
import { CreateResult } from '@shared/contracts/result';

export function registerIpcHandlers(
  db: AppDatabase,
  getContent: () => WebContents | undefined,
): void {
  const service = createTransactionService(db);

  function authorize(event: IpcMainInvokeEvent) {
    if (
      event.sender !== getContent() ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error('Unauthorized request origin.');
  }

  ipcMain.handle('transactions:list', (event, month: string) => {
    authorize(event);
    return service.list(month);
  });

  ipcMain.handle(
    'transactions:create',
    (event, input: TransactionInput): CreateResult => {
      authorize(event);
      return service.create(input);
    },
  );

  ipcMain.handle(
    'transactions:update',
    (event, id: number, input: TransactionInput) => {
      authorize(event);
      return service.update(id, input);
    },
  );

  ipcMain.handle('transactions:delete', (event, id: number) => {
    authorize(event);
    return service.remove(id);
  });
}
