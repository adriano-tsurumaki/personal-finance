import type Database from 'better-sqlite3';
import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { createTransactionService } from './transactions';
import type { TransactionInput } from '../shared/types';

export function registerIpcHandlers(
  db: Database.Database,
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
  ipcMain.handle('transactions:options', (event) => {
    authorize(event);
    return service.options();
  });
  ipcMain.handle('transactions:list', (event, month: string) => {
    authorize(event);
    return service.list(month);
  });
  ipcMain.handle('transactions:create', (event, input: TransactionInput) => {
    authorize(event);
    return service.create(input);
  });
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
