import type { RecurrenceResult } from '@shared/contracts/recurrence';
import {
  financialActionsBlocked,
  useFinancialOperations,
} from '@store/financial-operations';

export type RecurrenceMutationOutcome =
  | { status: 'blocked' | 'stale' | 'cancelled' | 'saved' }
  | { status: 'error' | 'refresh_failed'; code: string };
/** Owns the operation through persistence and refresh; saved state is never submitted twice. */
export async function performRecurrenceMutation({
  current,
  persist,
  onSaved,
  refresh,
}: {
  current: () => boolean;
  persist: () => Promise<RecurrenceResult<unknown>>;
  onSaved: () => void;
  refresh: () => Promise<boolean>;
}): Promise<RecurrenceMutationOutcome> {
  if (financialActionsBlocked() || !current()) {
    return { status: 'blocked' };
  }

  const release = useFinancialOperations.getState().begin('mutation');
  let saved = false;
  try {
    const result = await persist();

    if (!current()) {
      return { status: 'stale' };
    }

    if (!result.ok && result.error.message === 'Cancelled') {
      return { status: 'cancelled' };
    }

    if (!result.ok) {
      return { status: 'error', code: result.error.code };
    }

    saved = true;
    onSaved();
    const refreshed = await refresh();

    if (!current()) {
      return { status: 'stale' };
    }

    return refreshed
      ? { status: 'saved' }
      : { status: 'refresh_failed', code: 'refresh' };
  } catch (error) {
    if (!current()) {
      return { status: 'stale' };
    }

    return {
      status: saved ? 'refresh_failed' : 'error',
      code: error instanceof Error ? error.message : 'internal_error',
    };
  } finally {
    release();
  }
}
