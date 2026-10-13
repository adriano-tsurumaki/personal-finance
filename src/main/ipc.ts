import type { AppDatabase } from './db';
import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { createTransactionService } from './transactions';
import { createProfileService } from './profiles';
import { createMonthlyStatementService } from './monthly-statement';
import { createCategoryService } from './categories';
import { createCreditCardService } from './credit-cards';
import type {
  TransactionInput,
  TransactionUpdateInput,
} from '@shared/contracts/transaction';
import type { CreateResult } from '@shared/contracts/result';

export function registerIpcHandlers(
  db: AppDatabase,
  getContent: () => WebContents | undefined,
): void {
  const profiles = createProfileService(db);
  const categories = createCategoryService(db, () => profiles.requireActive());
  const cards = createCreditCardService(db, () => profiles.requireActive());
  const service = createTransactionService(db, () => profiles.requireActive());
  const statements = createMonthlyStatementService(db, () =>
    profiles.requireActive(),
  );

  function authorize(event: IpcMainInvokeEvent) {
    if (
      event.sender !== getContent() ||
      event.senderFrame !== event.sender.mainFrame
    ) {
      throw new Error('Unauthorized request origin.');
    }
  }

  function register<Args extends unknown[]>(
    channel: string,
    handler: (...args: Args) => unknown,
  ) {
    ipcMain.handle(channel, (event, ...args: Args) => {
      authorize(event);
      return handler(...args);
    });
  }

  register('cards:list', cards.list);
  register('cards:preview', cards.previewRegistration);
  register('cards:create', cards.create);
  register('cards:rename', cards.rename);
  register('cards:archive', cards.archive);
  register('invoices:period', cards.previewPeriod);
  register('invoices:suggest', cards.suggestPeriod);
  register('invoices:list', cards.invoices);
  register('invoices:details', cards.details);
  register('invoices:register', cards.registerInvoice);
  register('invoices:preview-correction', cards.previewCorrection);
  register('invoices:correct', cards.correctInvoice);
  register('invoices:unlinked', cards.unlinked);
  register(
    'invoices:preview-association',
    (id: number, input: Parameters<typeof cards.associate>[1]) =>
      cards.associate(id, input),
  );
  register('invoices:associate', cards.associate);
  register('transactions:preview-create', service.previewCreate);
  register('transactions:preview-update', service.previewUpdate);
  register('transactions:preview-delete', service.previewRemove);

  ipcMain.handle('categories:list', (event) => {
    authorize(event);
    return categories.list();
  });
  ipcMain.handle('categories:create', (event, input) => {
    authorize(event);
    return categories.create(input);
  });
  ipcMain.handle('categories:update', (event, id, input) => {
    authorize(event);
    return categories.update(id, input);
  });
  ipcMain.handle('categories:archive', (event, id) => {
    authorize(event);
    return categories.archive(id);
  });

  ipcMain.handle('profiles:list', (event) => {
    authorize(event);
    return profiles.list();
  });

  ipcMain.handle('profiles:current', (event) => {
    authorize(event);
    return profiles.current();
  });

  ipcMain.handle('profiles:create', (event, input) => {
    authorize(event);
    return profiles.create(input);
  });

  ipcMain.handle('profiles:enter', (event, id) => {
    authorize(event);
    return profiles.enter(id);
  });

  ipcMain.handle('profiles:leave', (event) => {
    authorize(event);
    profiles.leave();
  });

  ipcMain.handle('profiles:options', (event) => {
    authorize(event);
    return profiles.options();
  });

  ipcMain.handle('profiles:update-locale', (event, locale) => {
    authorize(event);
    return profiles.updateLocale(locale);
  });

  ipcMain.handle('transactions:list', (event, month: string) => {
    authorize(event);
    return service.list(month);
  });

  ipcMain.handle('statements:monthly', (event, month: string) => {
    authorize(event);
    return statements.get(month);
  });

  ipcMain.handle('transactions:get', (event, id: number) => {
    authorize(event);
    return service.get(id);
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
    (event, id: number, input: TransactionUpdateInput): CreateResult => {
      authorize(event);
      return service.update(id, input);
    },
  );

  ipcMain.handle('transactions:delete', (event, id: number, token?: string) => {
    authorize(event);
    return service.remove(id, token);
  });
}
