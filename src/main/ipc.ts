import type { AppDatabase } from './db';
import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { createTransactionService } from './transactions';
import { createInstallmentService } from './installments';
import { createProfileService } from './profiles';
import { createMonthlyStatementService } from './monthly-statement';
import { createCategoryService } from './categories';
import { createCreditCardService } from './credit-cards';
import { createRecurrenceService } from './recurrences';
import { createFinancialMonthService } from './financial-month';
import { createIndicatorAnchorService } from './indicator-anchor';
import type { IndicatorAnchorDto } from '@shared/contracts/indicator-anchor';
import type {
  RecurrenceErrorCode,
  RecurrenceResult,
} from '@shared/contracts/recurrence';
import { previewRecurrenceBoundary } from './recurrences/boundary-preview';
import type { RecurrenceBoundaryInput } from '@shared/contracts/recurrence';
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
  const indicatorAnchor = createIndicatorAnchorService(db, () =>
    profiles.requireActive(),
  );
  const categories = createCategoryService(db, () => profiles.requireActive());
  const cards = createCreditCardService(db, () => profiles.requireActive());
  const service = createTransactionService(db, () => profiles.requireActive());
  const installments = createInstallmentService(db, () =>
    profiles.requireActive(),
  );
  const statements = createMonthlyStatementService(db, () =>
    profiles.requireActive(),
  );
  const recurrences = createRecurrenceService(db, () =>
    profiles.requireActive(),
  );
  const financialMonths = createFinancialMonthService(db, () =>
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

  function mutation<Args extends unknown[], Value>(
    handler: (...args: Args) => Value,
  ): (...args: Args) => RecurrenceResult<Value> {
    return (...args) => {
      try {
        return { ok: true, value: handler(...args) };
      } catch (error) {
        const candidate = error as { code?: string; message?: string } | null;
        const codes: RecurrenceErrorCode[] = [
          'invalid_input',
          'not_found',
          'conflict',
          'repair_required',
          'internal_error',
        ];
        const code = codes.includes(candidate?.code as RecurrenceErrorCode)
          ? (candidate!.code as RecurrenceErrorCode)
          : 'internal_error';
        return {
          ok: false,
          error: {
            code,
            message: candidate?.message ?? 'The recurrence action failed.',
          },
        };
      }
    };
  }

  register('financial:month', financialMonths.get);
  register('installments:list', installments.list);
  register('installments:preview', installments.preview);
  register('installments:create', installments.create);
  register('installments:rename', installments.rename);
  register('installments:preview-remove', installments.previewRemove);
  register('installments:remove', installments.remove);
  register('recurrences:list', recurrences.list);
  register('recurrences:preview-boundary', (input: RecurrenceBoundaryInput) =>
    previewRecurrenceBoundary(db, profiles.requireActive().id, input),
  );
  register('recurrences:dismiss-legacy', mutation(recurrences.dismissLegacy));
  register('recurrences:month', recurrences.month);
  register('recurrences:forecast', recurrences.forecast);
  register('recurrences:create', mutation(recurrences.create));
  register('recurrences:update', mutation(recurrences.update));
  register('recurrences:boundary', mutation(recurrences.boundary));
  register('recurrences:resume', mutation(recurrences.resume));
  register('recurrences:confirm', mutation(recurrences.confirm));
  register('recurrences:ignore', mutation(recurrences.ignore));
  register('recurrences:restore', mutation(recurrences.restore));
  register('recurrences:coverage', mutation(recurrences.coverage));

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

  register('indicator-anchor:get', () => indicatorAnchor.get());
  register('indicator-anchor:save', (input: IndicatorAnchorDto) =>
    indicatorAnchor.save(input),
  );
  register('indicator-anchor:remove', () => indicatorAnchor.remove());

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
